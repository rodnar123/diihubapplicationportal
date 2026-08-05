import "server-only";

import { Role } from "@/generated/prisma/enums";
import {
  evaluateEmailPolicy,
  givenNameFromEmail,
  isStudentEmail,
  normalizeEmail,
  studentIdFromEmail,
} from "@/domain/identity/email";
import { prisma } from "@/lib/db/prisma";
import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Turns a verified Supabase identity into a local `User` row.
 *
 * Supabase owns authentication; this table owns authorisation and everything
 * the domain needs. Keeping them separate means a role can never be forged by
 * editing a JWT claim — the role is read from our database on every request.
 */

export type ProvisionResult =
  | { ok: true; userId: string; role: Role; isNew: boolean }
  | { ok: false; reason: "DOMAIN_NOT_ALLOWED" | "STAFF_NOT_AUTHORISED" | "ACCOUNT_DISABLED"; message: string };

const STAFF_NOT_AUTHORISED_MESSAGE =
  "This staff account has not been granted access to the challenge portal. Contact the challenge office to be added.";

const ACCOUNT_DISABLED_MESSAGE =
  "This account has been deactivated. Contact the challenge office if you believe this is a mistake.";

/**
 * Decides what role an address is entitled to.
 *
 * Students are provisioned automatically. Staff are not: an administrator must
 * either be named in `ADMIN_EMAIL_ALLOWLIST` or already exist as an active
 * reviewer/administrator row. This stops anyone who happens to hold a
 * `@pnguot.ac.pg` mailbox from reaching the review console.
 */
async function resolveRole(email: string): Promise<
  { ok: true; role: Role } | { ok: false; reason: "STAFF_NOT_AUTHORISED" }
> {
  if (isStudentEmail(email, clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN)) {
    return { ok: true, role: Role.STUDENT };
  }

  if (serverEnv.ADMIN_EMAIL_ALLOWLIST.includes(email)) {
    return { ok: true, role: Role.ADMIN };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { role: true, isActive: true, deletedAt: true },
  });

  if (
    existing &&
    existing.isActive &&
    !existing.deletedAt &&
    (existing.role === Role.ADMIN || existing.role === Role.REVIEWER)
  ) {
    return { ok: true, role: existing.role };
  }

  return { ok: false, reason: "STAFF_NOT_AUTHORISED" };
}

export async function provisionUser(input: {
  email: string;
  supabaseUserId: string;
  fullNameHint?: string | null;
}): Promise<ProvisionResult> {
  const email = normalizeEmail(input.email);

  const policy = evaluateEmailPolicy(email, {
    studentDomain: clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN,
    staffDomain: serverEnv.STAFF_EMAIL_DOMAIN,
    allowStaff: true,
  });

  if (!policy.ok) {
    return { ok: false, reason: "DOMAIN_NOT_ALLOWED", message: policy.message };
  }

  const roleResult = await resolveRole(email);
  if (!roleResult.ok) {
    return { ok: false, reason: "STAFF_NOT_AUTHORISED", message: STAFF_NOT_AUTHORISED_MESSAGE };
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && (!existing.isActive || existing.deletedAt)) {
    return { ok: false, reason: "ACCOUNT_DISABLED", message: ACCOUNT_DISABLED_MESSAGE };
  }

  const displayName =
    input.fullNameHint?.trim() ||
    existing?.name ||
    givenNameFromEmail(email) ||
    email.split("@")[0];

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      supabaseUserId: input.supabaseUserId,
      lastLoginAt: new Date(),
      // An allowlisted address is promoted on sign-in; a student is never
      // demoted by this path.
      ...(roleResult.role === Role.ADMIN ? { role: Role.ADMIN } : {}),
    },
    create: {
      email,
      name: displayName,
      role: roleResult.role,
      supabaseUserId: input.supabaseUserId,
      lastLoginAt: new Date(),
    },
  });

  // Give a brand-new student a profile shell pre-filled from their address, so
  // onboarding is a confirmation rather than a blank form.
  if (roleResult.role === Role.STUDENT) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      const derivedStudentId = studentIdFromEmail(email);
      const alreadyTaken = derivedStudentId
        ? await prisma.studentProfile.findUnique({ where: { studentId: derivedStudentId } })
        : null;

      await prisma.studentProfile.create({
        data: {
          userId: user.id,
          // Fall back to a placeholder the student must replace during
          // onboarding; `studentId` is unique so it cannot be left blank.
          studentId: derivedStudentId && !alreadyTaken ? derivedStudentId : `PENDING-${user.id.slice(-8)}`,
          firstName: givenNameFromEmail(email) ?? "",
          surname: "",
        },
      });
    }
  }

  return { ok: true, userId: user.id, role: user.role, isNew: !existing };
}
