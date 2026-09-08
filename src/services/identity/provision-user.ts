import "server-only";

import { Role } from "@/generated/prisma/enums";
import {
  evaluateEmailPolicy,
  givenNameFromEmail,
  isStaffEmail,
  isStudentEmail,
  normalizeEmail,
  studentIdFromEmail,
} from "@/domain/identity/email";
import { prisma } from "@/lib/db/prisma";
import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Turns a verified Google identity into a local `User` row.
 *
 * Google owns authentication; this table owns authorisation and everything the
 * domain needs. Keeping them separate means a role can never be forged by
 * editing a token claim — the role is read from our database on every request.
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
 * Students and staff are both provisioned from their domain. The panel is
 * staffed from across the schools and changes between cycles, and requiring an
 * administrator to name each assessor in an environment variable made adding
 * one a deploy; a `@pnguot.ac.pg` mailbox is therefore enough to sign in, as a
 * reviewer.
 *
 * That is deliberately a small thing to be. A reviewer reads entries and marks
 * the ones an administrator has allocated to them. Approving or rejecting an
 * entry, allocating the work, and everything behind Users, Settings and the
 * audit log stay with `ADMIN`, which is still granted only by
 * `ADMIN_EMAIL_ALLOWLIST`. The wide door leads to a small room.
 *
 * Order matters below, and the default is last for two reasons. An address that
 * already has a row keeps whatever role an administrator gave it, so a
 * promotion or a demotion survives the next sign-in rather than being reset to
 * the domain default. And an account that has been deactivated or deleted keeps
 * its refusal, because only an address with no row of its own reaches the
 * default at all — otherwise the wide door would quietly reopen every account
 * the challenge office had closed.
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

  // No row yet: a university address joins the panel, anything else does not.
  // `evaluateEmailPolicy` has already refused a domain we do not recognise, so
  // this is a second reading of the same rule rather than the only one.
  if (!existing && isStaffEmail(email, serverEnv.STAFF_EMAIL_DOMAIN)) {
    return { ok: true, role: Role.REVIEWER };
  }

  return { ok: false, reason: "STAFF_NOT_AUTHORISED" };
}

export async function provisionUser(input: {
  email: string;
  /** Google's stable `sub` claim. Null when the provider did not supply one. */
  authProviderId: string | null;
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
      authProviderId: input.authProviderId,
      lastLoginAt: new Date(),
      // An allowlisted address is promoted on sign-in; a student is never
      // demoted by this path.
      ...(roleResult.role === Role.ADMIN ? { role: Role.ADMIN } : {}),
    },
    create: {
      email,
      name: displayName,
      role: roleResult.role,
      authProviderId: input.authProviderId,
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
