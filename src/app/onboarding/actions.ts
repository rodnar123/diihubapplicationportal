"use server";

import { revalidatePath } from "next/cache";

import { studentProfileSchema } from "@/domain/application/schemas";
import { Role } from "@/generated/prisma/enums";
import { parseOrThrow, runAction } from "@/lib/action-helpers";
import { requireUserForAction } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { conflict, forbidden } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import { sanitizePlainText } from "@/lib/sanitize.server";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { claimTeamMemberships } from "@/services/application/membership-service";

/**
 * Completes (or edits) the student profile that Section A of every
 * application is pre-filled from.
 */
export async function saveStudentProfile(values: unknown) {
  return runAction(async () => {
    const user = await requireUserForAction();

    if (user.role !== Role.STUDENT) {
      throw forbidden("Only students have a student profile.");
    }

    const input = parseOrThrow(studentProfileSchema, values);

    /*
     * Both checks are independent, and every round trip here is a round trip to
     * a pooler that is not in the same datacentre. Run them together: this is
     * the first thing a new student does, on a cold function, and the sequential
     * version of this action measured 11.7s end to end.
     */
    const [clash, section] = await Promise.all([
      // The student ID is the identity the whole challenge is keyed on, so it
      // must not already belong to somebody else.
      prisma.studentProfile.findFirst({
        where: { studentId: input.studentId, userId: { not: user.id } },
        select: { id: true },
      }),
      // The section must genuinely belong to the chosen school.
      prisma.section.findFirst({
        where: { id: input.sectionId, schoolId: input.schoolId, isActive: true },
        select: { id: true },
      }),
    ]);

    if (clash) {
      throw conflict("That student ID is already registered to another account.", {
        studentId: [
          "This student ID is already in use. Check the number, or contact the challenge office.",
        ],
      });
    }

    if (!section) {
      throw conflict("That section is not part of the selected school.", {
        sectionId: ["Choose a section from the selected school."],
      });
    }

    const firstName = sanitizePlainText(input.firstName) ?? input.firstName;
    const surname = sanitizePlainText(input.surname) ?? input.surname;

    let claimed = 0;

    await prisma.$transaction(async (tx) => {
      await tx.studentProfile.upsert({
        where: { userId: user.id },
        update: {
          studentId: input.studentId,
          firstName,
          surname,
          phone: input.phone,
          schoolId: input.schoolId,
          sectionId: input.sectionId,
          program: sanitizePlainText(input.program),
          yearLevel: input.yearLevel,
        },
        create: {
          userId: user.id,
          studentId: input.studentId,
          firstName,
          surname,
          phone: input.phone,
          schoolId: input.schoolId,
          sectionId: input.sectionId,
          program: sanitizePlainText(input.program),
          yearLevel: input.yearLevel,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { name: `${firstName} ${surname}`.trim() },
      });

      /*
       * Attach this account to any roster line a team leader has already typed
       * their student number onto.
       *
       * This is the moment it becomes possible: the student number is what
       * links the two, and this action is where the portal first learns it.
       * Inside the transaction so a claim cannot survive a profile write that
       * rolls back — the link would then point at a student number the account
       * no longer holds.
       */
      claimed = await claimTeamMemberships(tx, user.id, input.studentId);
    });

    await recordAudit({
      action: AUDIT_ACTIONS.profileUpdated,
      entityType: "StudentProfile",
      entityId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      metadata: { studentId: input.studentId },
    });

    if (claimed > 0) {
      await recordAudit({
        action: AUDIT_ACTIONS.teamMembershipClaimed,
        entityType: "TeamMember",
        actorId: user.id,
        actorEmail: user.email,
        metadata: { studentId: input.studentId, claimed },
      });
    }

    revalidatePath(ROUTES.onboarding);
    revalidatePath(ROUTES.dashboard);

    return { redirectTo: ROUTES.dashboard };
  });
}
