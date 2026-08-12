"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AttachmentKind, DeclarationMode } from "@/generated/prisma/enums";
import {
  alternativesDraftSchema,
  alternativesSchema,
  applicantSectionDraftSchema,
  applicantSectionSchema,
  createTeamSchema,
  createVentureSchema,
  declarationSchema,
  impactDraftSchema,
  impactSchema,
  prototypeDraftSchema,
  prototypeSchema,
  teamDraftSchema,
  ventureDraftSchema,
} from "@/domain/application/schemas";
import type { ApplicationDto } from "@/domain/application/types";
import { requireStudentForAction } from "@/lib/auth/session";
import { nullifyBlank, parseOrThrow, runAction } from "@/lib/action-helpers";
import { AppError, type ActionResult } from "@/lib/errors";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { ROUTES } from "@/lib/routes";
import { sanitizePlainText, sanitizeRichText } from "@/lib/sanitize.server";
import {
  getOrCreateDraft,
  saveApplicationFields,
  saveDeclaration,
  saveTeam,
  submitApplication,
  withdrawApplication,
} from "@/services/application/application-service";
import {
  deleteAttachment,
  uploadAttachment,
} from "@/services/storage/attachment-service";
import { sendSubmissionEmails } from "@/services/notifications/notification-service";
import { getAppSettings } from "@/services/settings/settings-service";

/**
 * Server Actions for the student wizard.
 *
 * Each step accepts a `complete` flag: `false` is the autosave path, which
 * validates shape but tolerates blanks, and `true` is "save and continue",
 * which enforces the full rule set. Both sanitise before writing — the browser
 * is never trusted to have done it.
 */

function revalidateApplication() {
  revalidatePath(ROUTES.application, "layout");
  revalidatePath(ROUTES.dashboard);
}

type StepResult = ActionResult<ApplicationDto>;

// ---------------------------------------------------------------------------
// Section A — applicant details
// ---------------------------------------------------------------------------

export async function saveApplicantStep(input: {
  applicationId: string;
  values: unknown;
  complete: boolean;
}): Promise<StepResult> {
  return runAction(async () => {
    const user = await requireStudentForAction();
    enforceRateLimit(`draft:${user.id}`, RATE_LIMITS.draftSave);

    const values = input.complete
      ? parseOrThrow(applicantSectionSchema, input.values)
      : parseOrThrow(applicantSectionDraftSchema, input.values);

    const application = await saveApplicationFields(
      user,
      input.applicationId,
      {
        applicantPhone: sanitizePlainText(values.applicantPhone ?? null),
        school: values.schoolId ? { connect: { id: values.schoolId } } : { disconnect: true },
        section: values.sectionId ? { connect: { id: values.sectionId } } : { disconnect: true },
        program: sanitizePlainText(values.program ?? null),
        yearLevel: values.yearLevel ?? null,
      },
      { step: "applicant" },
    );

    revalidateApplication();
    return application;
  });
}

// ---------------------------------------------------------------------------
// Section B — team
// ---------------------------------------------------------------------------

export async function saveTeamStep(input: {
  applicationId: string;
  values: unknown;
  complete: boolean;
}): Promise<StepResult> {
  return runAction(async () => {
    const user = await requireStudentForAction();
    enforceRateLimit(`draft:${user.id}`, RATE_LIMITS.draftSave);

    const settings = await getAppSettings();

    if (!input.complete) {
      // Autosave only persists once the team has a name and a leader; a
      // half-typed roster is kept in the browser until then, because the write
      // replaces the whole roster and would otherwise drop rows mid-edit.
      const draft = parseOrThrow(teamDraftSchema, input.values);

      if (!draft.name?.trim() || !draft.leaderName?.trim() || !draft.leaderStudentId) {
        const { application } = await getOrCreateDraft(user);
        return application;
      }
    }

    const schema = createTeamSchema({
      minSize: settings["team.minSize"],
      maxSize: settings["team.maxSize"],
    });

    const values = parseOrThrow(schema, input.values);

    const application = await saveTeam(user, input.applicationId, {
      name: sanitizePlainText(values.name) ?? "",
      leaderName: sanitizePlainText(values.leaderName) ?? "",
      leaderStudentId: values.leaderStudentId,
      leaderEmail: values.leaderEmail,
      leaderPhone: nullifyBlank(values.leaderPhone),
      supervisorName: sanitizePlainText(nullifyBlank(values.supervisorName ?? null)),
      supervisorEmail: nullifyBlank(values.supervisorEmail ?? null),
      members: values.members.map((member) => ({
        studentId: member.studentId,
        firstName: sanitizePlainText(member.firstName) ?? "",
        surname: sanitizePlainText(member.surname) ?? "",
        sectionId: nullifyBlank(member.sectionId ?? null),
        sectionLabel: sanitizePlainText(nullifyBlank(member.sectionLabel ?? null)),
        role: sanitizePlainText(nullifyBlank(member.role)),
        email: nullifyBlank(member.email ?? null),
        phone: nullifyBlank(member.phone ?? null),
      })),
    });

    revalidateApplication();
    return application;
  });
}

// ---------------------------------------------------------------------------
// Section C — venture
// ---------------------------------------------------------------------------

export async function saveVentureStep(input: {
  applicationId: string;
  values: unknown;
  complete: boolean;
}): Promise<StepResult> {
  return runAction(async () => {
    const user = await requireStudentForAction();
    enforceRateLimit(`draft:${user.id}`, RATE_LIMITS.draftSave);

    const settings = await getAppSettings();

    const values = input.complete
      ? parseOrThrow(createVentureSchema({ themes: settings["challenge.themes"] }), input.values)
      : parseOrThrow(ventureDraftSchema, input.values);

    const application = await saveApplicationFields(
      user,
      input.applicationId,
      {
        projectTitle: sanitizePlainText(values.projectTitle ?? null),
        theme: sanitizePlainText(values.theme ?? null),
        sdgAlignment: values.sdgAlignment ?? [],
        problemStatement: await sanitizeRichText(values.problemStatement),
        proposedSolution: await sanitizeRichText(values.proposedSolution),
        innovation: await sanitizeRichText(values.innovation),
        objectives: await sanitizeRichText(values.objectives),
        targetUsers: await sanitizeRichText(values.targetUsers),
      },
      { step: "venture" },
    );

    revalidateApplication();
    return application;
  });
}

// ---------------------------------------------------------------------------
// Prototype details
// ---------------------------------------------------------------------------

export async function savePrototypeStep(input: {
  applicationId: string;
  values: unknown;
  complete: boolean;
}): Promise<StepResult> {
  return runAction(async () => {
    const user = await requireStudentForAction();
    enforceRateLimit(`draft:${user.id}`, RATE_LIMITS.draftSave);

    const values = input.complete
      ? parseOrThrow(prototypeSchema, input.values)
      : parseOrThrow(prototypeDraftSchema, input.values);

    const application = await saveApplicationFields(
      user,
      input.applicationId,
      {
        prototypeType: sanitizePlainText(values.prototypeType ?? null),
        prototypeFeatures: await sanitizeRichText(values.prototypeFeatures),
        developmentTools: await sanitizeRichText(values.developmentTools),
      },
      { step: "prototype" },
    );

    revalidateApplication();
    return application;
  });
}

// ---------------------------------------------------------------------------
// Alternatives vs this solution
// ---------------------------------------------------------------------------

export async function saveAlternativesStep(input: {
  applicationId: string;
  values: unknown;
  complete: boolean;
}): Promise<StepResult> {
  return runAction(async () => {
    const user = await requireStudentForAction();
    enforceRateLimit(`draft:${user.id}`, RATE_LIMITS.draftSave);

    const values = input.complete
      ? parseOrThrow(alternativesSchema, input.values)
      : parseOrThrow(alternativesDraftSchema, input.values);

    const application = await saveApplicationFields(
      user,
      input.applicationId,
      {
        alternatives: await sanitizeRichText(values.alternatives),
        justification: await sanitizeRichText(values.justification),
      },
      { step: "alternatives" },
    );

    revalidateApplication();
    return application;
  });
}

// ---------------------------------------------------------------------------
// Impact & feasibility
// ---------------------------------------------------------------------------

export async function saveImpactStep(input: {
  applicationId: string;
  values: unknown;
  complete: boolean;
}): Promise<StepResult> {
  return runAction(async () => {
    const user = await requireStudentForAction();
    enforceRateLimit(`draft:${user.id}`, RATE_LIMITS.draftSave);

    const values = input.complete
      ? parseOrThrow(impactSchema, input.values)
      : parseOrThrow(impactDraftSchema, input.values);

    const budget =
      values.budgetAmount === "" || values.budgetAmount == null ? null : values.budgetAmount;

    const application = await saveApplicationFields(
      user,
      input.applicationId,
      {
        valueProposition: await sanitizeRichText(values.valueProposition),
        implementationPlan: await sanitizeRichText(values.implementationPlan),
        expectedImpact: await sanitizeRichText(values.expectedImpact),
        sustainability: await sanitizeRichText(values.sustainability),
        timeline: await sanitizeRichText(values.timeline),
        budgetAmount: budget,
        budgetNotes: await sanitizeRichText(values.budgetNotes),
      },
      { step: "impact" },
    );

    revalidateApplication();
    return application;
  });
}

// ---------------------------------------------------------------------------
// Declaration
// ---------------------------------------------------------------------------

export async function saveDeclarationStep(input: {
  applicationId: string;
  values: unknown;
}): Promise<StepResult> {
  return runAction(async () => {
    const user = await requireStudentForAction();
    enforceRateLimit(`draft:${user.id}`, RATE_LIMITS.draftSave);

    const values = parseOrThrow(declarationSchema, input.values);

    const application = await saveDeclaration(user, input.applicationId, {
      mode:
        values.mode === "ELECTRONIC" ? DeclarationMode.ELECTRONIC : DeclarationMode.SIGNED_UPLOAD,
      accepted: values.mode === "ELECTRONIC" ? values.accepted : true,
      signatoryName: sanitizePlainText(values.signatoryName) ?? "",
      signedAt: new Date(values.signedDate),
      signedDocumentId:
        values.mode === "SIGNED_UPLOAD" ? (values.signedDocumentId ?? null) : null,
    });

    revalidateApplication();
    return application;
  });
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

const attachmentKindSchema = z.enum([
  AttachmentKind.SUPPORTING_DOCUMENT,
  AttachmentKind.PROTOTYPE_ASSET,
  AttachmentKind.SIGNED_DECLARATION,
]);

export async function uploadAttachmentAction(formData: FormData) {
  return runAction(async () => {
    const user = await requireStudentForAction();
    enforceRateLimit(`upload:${user.id}`, RATE_LIMITS.upload);

    const applicationId = String(formData.get("applicationId") ?? "");
    const file = formData.get("file");
    const kind = parseOrThrow(
      attachmentKindSchema.default(AttachmentKind.SUPPORTING_DOCUMENT),
      formData.get("kind") ?? undefined,
    );

    if (!applicationId) {
      throw new AppError("VALIDATION", "The application could not be identified.");
    }
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION", "Choose a file to upload.");
    }

    const attachment = await uploadAttachment(user, applicationId, file, kind);
    revalidateApplication();
    return attachment;
  });
}

export async function deleteAttachmentAction(attachmentId: string) {
  return runAction(async () => {
    const user = await requireStudentForAction();
    await deleteAttachment(user, attachmentId);
    revalidateApplication();
  });
}

// ---------------------------------------------------------------------------
// Submit / withdraw
// ---------------------------------------------------------------------------

export async function submitApplicationAction(applicationId: string) {
  return runAction(async () => {
    const user = await requireStudentForAction();
    enforceRateLimit(`submit:${user.id}`, RATE_LIMITS.submit);

    const result = await submitApplication(user, applicationId);

    // Best-effort: the submission is already committed, so a mail failure is
    // logged rather than surfaced as a failed submit.
    await sendSubmissionEmails({
      applicationId,
      isResubmission: result.isResubmission,
    });

    revalidateApplication();

    return {
      referenceNumber: result.referenceNumber,
      isResubmission: result.isResubmission,
      status: result.application.status,
    };
  });
}

export async function withdrawApplicationAction(input: {
  applicationId: string;
  reason: string;
}) {
  return runAction(async () => {
    const user = await requireStudentForAction();

    const reason = parseOrThrow(
      z.string().trim().min(10, "Tell us briefly why you are withdrawing.").max(1000),
      input.reason,
    );

    const application = await withdrawApplication(user, input.applicationId, reason);
    revalidateApplication();
    return application;
  });
}
