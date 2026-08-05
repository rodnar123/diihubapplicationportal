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

    // The student ID is the identity the whole challenge is keyed on, so it
    // must not already belong to somebody else.
    const clash = await prisma.studentProfile.findFirst({
      where: { studentId: input.studentId, userId: { not: user.id } },
      select: { id: true },
    });

    if (clash) {
      throw conflict("That student ID is already registered to another account.", {
        studentId: [
          "This student ID is already in use. Check the number, or contact the challenge office.",
        ],
      });
    }

    // The section must genuinely belong to the chosen school.
    const section = await prisma.section.findFirst({
      where: { id: input.sectionId, schoolId: input.schoolId, isActive: true },
      select: { id: true },
    });

    if (!section) {
      throw conflict("That section is not part of the selected school.", {
        sectionId: ["Choose a section from the selected school."],
      });
    }

    const firstName = sanitizePlainText(input.firstName) ?? input.firstName;
    const surname = sanitizePlainText(input.surname) ?? input.surname;

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
    });

    await recordAudit({
      action: AUDIT_ACTIONS.profileUpdated,
      entityType: "StudentProfile",
      entityId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      metadata: { studentId: input.studentId },
    });

    revalidatePath(ROUTES.onboarding);
    revalidatePath(ROUTES.dashboard);

    return { redirectTo: ROUTES.dashboard };
  });
}
