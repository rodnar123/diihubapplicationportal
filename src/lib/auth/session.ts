import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { Role, type YearLevel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { forbidden as forbiddenError, unauthenticated } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionUser } from "@/services/identity/provision-user";

/**
 * The authenticated principal, as the application understands it.
 *
 * Note that `role` comes from our own `users` table, never from a JWT claim:
 * Supabase authenticates, Prisma authorises.
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  supabaseUserId: string | null;
  profile: {
    id: string;
    studentId: string;
    firstName: string;
    surname: string;
    phone: string | null;
    schoolId: string | null;
    sectionId: string | null;
    program: string | null;
    yearLevel: YearLevel | null;
    isComplete: boolean;
  } | null;
}

/**
 * A student profile is complete once it carries everything Section A of the
 * form needs. Until then the student is held at onboarding.
 */
function profileIsComplete(profile: {
  studentId: string;
  firstName: string;
  surname: string;
  schoolId: string | null;
  sectionId: string | null;
  program: string | null;
  yearLevel: YearLevel | null;
}): boolean {
  return (
    !profile.studentId.startsWith("PENDING-") &&
    profile.firstName.trim().length > 0 &&
    profile.surname.trim().length > 0 &&
    Boolean(profile.schoolId) &&
    Boolean(profile.sectionId) &&
    Boolean(profile.program?.trim()) &&
    Boolean(profile.yearLevel)
  );
}

/**
 * Resolves the current user, or null when the request is anonymous.
 *
 * Wrapped in `cache` so that a page rendering ten server components performs
 * one Supabase verification and one database read, not ten of each.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;

  let user = await prisma.user.findUnique({
    where: { email: authUser.email.toLowerCase() },
    include: { studentProfile: true },
  });

  // Self-healing: a verified Supabase identity with no local row (for example
  // after a database restore) is provisioned on the spot rather than being
  // stranded in a redirect loop.
  if (!user) {
    const provisioned = await provisionUser({
      email: authUser.email,
      supabaseUserId: authUser.id,
      fullNameHint: (authUser.user_metadata?.full_name as string | undefined) ?? null,
    });

    if (!provisioned.ok) return null;

    user = await prisma.user.findUnique({
      where: { id: provisioned.userId },
      include: { studentProfile: true },
    });
  }

  if (!user || !user.isActive || user.deletedAt) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    supabaseUserId: user.supabaseUserId,
    profile: user.studentProfile
      ? {
          id: user.studentProfile.id,
          studentId: user.studentProfile.studentId,
          firstName: user.studentProfile.firstName,
          surname: user.studentProfile.surname,
          phone: user.studentProfile.phone,
          schoolId: user.studentProfile.schoolId,
          sectionId: user.studentProfile.sectionId,
          program: user.studentProfile.program,
          yearLevel: user.studentProfile.yearLevel,
          isComplete: profileIsComplete(user.studentProfile),
        }
      : null,
  };
});

/**
 * Requires any authenticated user. Redirects to sign-in otherwise.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(ROUTES.signIn);
  return user;
}

/**
 * Requires a student whose profile is complete. Sends them to onboarding if it
 * is not — every downstream form assumes Section A is already answered.
 */
export async function requireStudent(): Promise<SessionUser & { profile: NonNullable<SessionUser["profile"]> }> {
  const user = await requireUser();

  if (user.role !== Role.STUDENT) {
    // Staff have no student workspace; send them where they belong.
    redirect(ROUTES.admin);
  }

  if (!user.profile) redirect(ROUTES.onboarding);
  if (!user.profile.isComplete) redirect(ROUTES.onboarding);

  return user as SessionUser & { profile: NonNullable<SessionUser["profile"]> };
}

export function isReviewer(role: Role): boolean {
  return role === Role.ADMIN || role === Role.REVIEWER;
}

export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN;
}

/**
 * Requires reviewer-or-above. Used by the whole `/admin` tree.
 */
export async function requireReviewer(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isReviewer(user.role)) redirect(ROUTES.accessDenied);
  return user;
}

/**
 * Requires a full administrator — settings and destructive actions only.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect(ROUTES.accessDenied);
  return user;
}

/*
 * Server Action variants. These throw an `AppError` rather than redirecting so
 * that the caller can return a typed failure to the form instead of triggering
 * a navigation mid-submit.
 */

export async function requireUserForAction(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthenticated();
  return user;
}

export async function requireStudentForAction(): Promise<
  SessionUser & { profile: NonNullable<SessionUser["profile"]> }
> {
  const user = await requireUserForAction();
  if (user.role !== Role.STUDENT || !user.profile) {
    throw forbiddenError("Only students can work on an application.");
  }
  return user as SessionUser & { profile: NonNullable<SessionUser["profile"]> };
}

export async function requireReviewerForAction(): Promise<SessionUser> {
  const user = await requireUserForAction();
  if (!isReviewer(user.role)) {
    throw forbiddenError("This action is restricted to the review panel.");
  }
  return user;
}

export async function requireAdminForAction(): Promise<SessionUser> {
  const user = await requireUserForAction();
  if (!isAdmin(user.role)) {
    throw forbiddenError("This action is restricted to administrators.");
  }
  return user;
}
