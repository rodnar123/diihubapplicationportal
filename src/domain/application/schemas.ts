import { z } from "zod";

import { YearLevel } from "@/generated/prisma/enums";
import { SDG_CODES } from "@/domain/challenge/constants";
import { STUDENT_ID_PATTERN, isStudentEmail } from "@/domain/identity/email";
import { optionalRichTextField, richTextField } from "@/domain/rich-text";

/**
 * Validation for every section of the DiiHub BizTech Challenge application.
 *
 * Two strengths exist for each step:
 *   * the strict schema, used when the step is submitted or the whole
 *     application is sent for review;
 *   * the `…DraftSchema`, used by autosave, which validates *shape* (a phone
 *     number still has to look like one) but never *presence*, so a student
 *     can leave and come back mid-sentence.
 *
 * Anything that depends on runtime configuration — team size, allowed themes —
 * is a factory taking those values, so the rule and the setting cannot drift
 * apart.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const trimmed = z.string().trim();

export const studentIdSchema = trimmed
  .min(1, "Student ID is required.")
  .regex(STUDENT_ID_PATTERN, "A student ID is 6–10 digits, for example 25530061.");

export const personNameSchema = trimmed
  .min(2, "Enter at least 2 characters.")
  .max(80, "Use 80 characters or fewer.")
  .regex(
    /^[\p{L}][\p{L}\p{M}'’\-. ]*$/u,
    "Use letters, spaces, hyphens and apostrophes only.",
  );

/** PNG numbers are commonly written as +675 7XXX XXXX or 7XXX XXXX. */
export const phoneSchema = trimmed
  .min(7, "Enter a valid phone number.")
  .max(24, "Enter a valid phone number.")
  .regex(/^\+?[\d\s()\-]{7,24}$/, "Use digits, spaces, +, - and brackets only.");

export const optionalPhoneSchema = z.union([phoneSchema, z.literal("")]).nullish();

export const studentEmailSchema = trimmed
  .toLowerCase()
  .refine((value) => isStudentEmail(value), {
    message: "Use an official @student.pnguot.ac.pg address.",
  });

export const optionalStudentEmailSchema = z
  .union([studentEmailSchema, z.literal("")])
  .nullish();

/** Staff supervisors hold a `@pnguot.ac.pg` mailbox. */
export const optionalStaffEmailSchema = z
  .union([
    trimmed.toLowerCase().refine((value) => /@(?:[a-z0-9-]+\.)*pnguot\.ac\.pg$/.test(value), {
      message: "Use an official PNGUoT staff address.",
    }),
    z.literal(""),
  ])
  .nullish();

// ---------------------------------------------------------------------------
// Student profile (onboarding, and Section A of the form)
// ---------------------------------------------------------------------------

export const studentProfileSchema = z.object({
  studentId: studentIdSchema,
  firstName: personNameSchema,
  surname: personNameSchema,
  phone: phoneSchema,
  schoolId: trimmed.min(1, "Select your school."),
  sectionId: trimmed.min(1, "Select your section."),
  program: trimmed
    .min(3, "Enter your programme of study.")
    .max(140, "Use 140 characters or fewer."),
  yearLevel: z.enum(YearLevel, { message: "Select your year level." }),
});

export type StudentProfileInput = z.infer<typeof studentProfileSchema>;

/** Section A as it appears on an individual application. */
export const applicantSectionSchema = z.object({
  applicantPhone: phoneSchema,
  schoolId: trimmed.min(1, "Select your school."),
  sectionId: trimmed.min(1, "Select your section."),
  program: trimmed.min(3, "Enter your programme of study.").max(140),
  yearLevel: z.enum(YearLevel, { message: "Select your year level." }),
});

export const applicantSectionDraftSchema = applicantSectionSchema.partial().extend({
  applicantPhone: optionalPhoneSchema,
});

export type ApplicantSectionInput = z.infer<typeof applicantSectionSchema>;

// ---------------------------------------------------------------------------
// Team Information
// ---------------------------------------------------------------------------

export const teamMemberSchema = z.object({
  /** Present when editing an existing row. */
  id: z.string().optional(),
  studentId: studentIdSchema,
  firstName: personNameSchema,
  surname: personNameSchema,
  sectionId: trimmed.min(1, "Select a section.").nullish(),
  sectionLabel: trimmed.max(80).nullish(),
  role: trimmed
    .min(2, "Describe this member's role.")
    .max(80, "Use 80 characters or fewer."),
  email: optionalStudentEmailSchema,
  phone: optionalPhoneSchema,
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

/** Autosave counterpart: a half-typed row must not raise an error. */
export const teamMemberDraftSchema = z.object({
  id: z.string().optional(),
  studentId: z.union([studentIdSchema, z.literal("")]).nullish(),
  firstName: z.union([personNameSchema, z.literal("")]).nullish(),
  surname: z.union([personNameSchema, z.literal("")]).nullish(),
  sectionId: trimmed.nullish(),
  sectionLabel: trimmed.max(80).nullish(),
  role: trimmed.max(80).nullish(),
  email: optionalStudentEmailSchema,
  phone: optionalPhoneSchema,
});

/**
 * The team step. `minSize`/`maxSize` come from application settings, so the
 * message a student sees always matches the configured limit.
 *
 * Note the member list excludes the leader: the leader is captured by the
 * dedicated fields above it and is added to the roster server-side. That
 * mirrors the paper form, where the leader is named separately and then
 * appears as row 1 of the member table.
 */
export function createTeamSchema(options: { minSize: number; maxSize: number }) {
  const { minSize, maxSize } = options;
  const maxAdditionalMembers = Math.max(0, maxSize - 1);
  const minAdditionalMembers = Math.max(0, minSize - 1);

  return z
    .object({
      name: trimmed
        .min(2, "Enter a team name.")
        .max(80, "Use 80 characters or fewer.")
        .regex(
          /^[\p{L}\p{N}][\p{L}\p{N}'’\-.&() ]*$/u,
          "Use letters, numbers, spaces and basic punctuation only.",
        ),
      leaderName: personNameSchema,
      leaderStudentId: studentIdSchema,
      leaderEmail: studentEmailSchema,
      leaderPhone: phoneSchema,
      supervisorName: z.union([personNameSchema, z.literal("")]).nullish(),
      supervisorEmail: optionalStaffEmailSchema,
      members: z
        .array(teamMemberSchema)
        .min(
          minAdditionalMembers,
          minAdditionalMembers === 0
            ? "Add your team members."
            : `Add at least ${minAdditionalMembers} member${minAdditionalMembers === 1 ? "" : "s"} besides the team leader.`,
        )
        .max(
          maxAdditionalMembers,
          `A team may have at most ${maxSize} members, including the leader.`,
        ),
    })
    .superRefine((value, ctx) => {
      // A student may appear once. The leader is compared too, because the
      // roster the reviewer sees includes them.
      const seen = new Map<string, number>();
      seen.set(value.leaderStudentId, -1);

      value.members.forEach((member, index) => {
        const previous = seen.get(member.studentId);
        if (previous !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["members", index, "studentId"],
            message:
              previous === -1
                ? "This is the team leader's student ID — they are already on the team."
                : "This student is already listed on the team.",
          });
        } else {
          seen.set(member.studentId, index);
        }
      });

      if (value.supervisorEmail && !value.supervisorName) {
        ctx.addIssue({
          code: "custom",
          path: ["supervisorName"],
          message: "Enter the supervisor's name as well as their email.",
        });
      }
    });
}

export type TeamInput = z.infer<ReturnType<typeof createTeamSchema>>;

export const teamDraftSchema = z.object({
  name: trimmed.max(80).nullish(),
  leaderName: z.union([personNameSchema, z.literal("")]).nullish(),
  leaderStudentId: z.union([studentIdSchema, z.literal("")]).nullish(),
  leaderEmail: optionalStudentEmailSchema,
  leaderPhone: optionalPhoneSchema,
  supervisorName: trimmed.max(80).nullish(),
  supervisorEmail: optionalStaffEmailSchema,
  members: z.array(teamMemberDraftSchema).max(50).optional(),
});

export type TeamDraftInput = z.infer<typeof teamDraftSchema>;

// ---------------------------------------------------------------------------
// Venture (Project)
// ---------------------------------------------------------------------------

export function createVentureSchema(options: { themes: readonly string[] }) {
  return z.object({
    projectTitle: trimmed
      .min(6, "Give your venture a title.")
      .max(180, "Use 180 characters or fewer."),
    theme: trimmed.refine((value) => options.themes.includes(value), {
      message: "Choose one of the listed themes.",
    }),
    sdgAlignment: z
      .array(z.enum(SDG_CODES as [string, ...string[]]))
      .min(1, "Select at least one Sustainable Development Goal.")
      .max(5, "Select no more than five goals — pick the ones you contribute to most."),
    problemStatement: richTextField({
      label: "Problem statement",
      min: 120,
      max: 3000,
    }),
    proposedSolution: richTextField({
      label: "Tech-driven solution",
      min: 120,
      max: 3000,
    }),
    innovation: richTextField({ label: "Innovation", min: 60, max: 2000 }),
    objectives: richTextField({ label: "Objectives", min: 60, max: 2000 }),
    targetUsers: richTextField({
      label: "Target users and beneficiaries",
      min: 40,
      max: 1500,
    }),
  });
}

export type VentureInput = z.infer<ReturnType<typeof createVentureSchema>>;

export const ventureDraftSchema = z.object({
  projectTitle: trimmed.max(180).nullish(),
  theme: trimmed.max(120).nullish(),
  sdgAlignment: z.array(z.string()).max(17).optional(),
  problemStatement: optionalRichTextField({ label: "Problem statement", max: 3000 }),
  proposedSolution: optionalRichTextField({ label: "Tech-driven solution", max: 3000 }),
  innovation: optionalRichTextField({ label: "Innovation", max: 2000 }),
  objectives: optionalRichTextField({ label: "Objectives", max: 2000 }),
  targetUsers: optionalRichTextField({ label: "Target users", max: 1500 }),
});

// ---------------------------------------------------------------------------
// Prototype Details
// ---------------------------------------------------------------------------

export const prototypeSchema = z.object({
  prototypeType: trimmed
    .min(2, "Select or describe your prototype type.")
    .max(80, "Use 80 characters or fewer."),
  prototypeFeatures: richTextField({
    label: "Prototype features",
    min: 60,
    max: 2000,
  }),
  developmentTools: richTextField({
    label: "Development tools and platforms",
    min: 20,
    max: 1000,
  }),
});

export type PrototypeInput = z.infer<typeof prototypeSchema>;

export const prototypeDraftSchema = z.object({
  prototypeType: trimmed.max(80).nullish(),
  prototypeFeatures: optionalRichTextField({ label: "Prototype features", max: 2000 }),
  developmentTools: optionalRichTextField({ label: "Development tools", max: 1000 }),
});

// ---------------------------------------------------------------------------
// Alternative Solutions vs This Solution
// ---------------------------------------------------------------------------

export const alternativesSchema = z.object({
  alternatives: richTextField({
    label: "Alternative solutions",
    // The official form asks for three existing solutions; the floor is set so
    // that a one-line answer cannot pass, while the count itself is a
    // judgement the reviewer makes.
    min: 150,
    max: 3000,
  }),
  justification: richTextField({ label: "Justification", min: 60, max: 2000 }),
});

export type AlternativesInput = z.infer<typeof alternativesSchema>;

export const alternativesDraftSchema = z.object({
  alternatives: optionalRichTextField({ label: "Alternative solutions", max: 3000 }),
  justification: optionalRichTextField({ label: "Justification", max: 2000 }),
});

// ---------------------------------------------------------------------------
// Impact & Feasibility
// ---------------------------------------------------------------------------

export const impactSchema = z.object({
  valueProposition: richTextField({ label: "Value proposition", min: 60, max: 2000 }),
  implementationPlan: richTextField({ label: "Implementation plan", min: 80, max: 3000 }),
  expectedImpact: richTextField({ label: "Expected impact", min: 60, max: 2000 }),
  sustainability: optionalRichTextField({ label: "Sustainability", max: 2000 }),
  timeline: richTextField({ label: "Timeline", min: 40, max: 2000 }),
  budgetAmount: z
    .union([
      z
        .number()
        .nonnegative("A budget cannot be negative.")
        .max(99_999_999.99, "Enter a budget under K100,000,000."),
      z.literal(""),
    ])
    .nullish(),
  budgetNotes: optionalRichTextField({ label: "Budget notes", max: 1500 }),
});

export type ImpactInput = z.infer<typeof impactSchema>;

export const impactDraftSchema = z.object({
  valueProposition: optionalRichTextField({ label: "Value proposition", max: 2000 }),
  implementationPlan: optionalRichTextField({ label: "Implementation plan", max: 3000 }),
  expectedImpact: optionalRichTextField({ label: "Expected impact", max: 2000 }),
  sustainability: optionalRichTextField({ label: "Sustainability", max: 2000 }),
  timeline: optionalRichTextField({ label: "Timeline", max: 2000 }),
  budgetAmount: z.union([z.number().nonnegative().max(99_999_999.99), z.literal("")]).nullish(),
  budgetNotes: optionalRichTextField({ label: "Budget notes", max: 1500 }),
});

// ---------------------------------------------------------------------------
// Declaration
// ---------------------------------------------------------------------------

/**
 * Flat rather than a discriminated union: the form keeps both branches' fields
 * mounted so that switching declaration mode does not discard what the student
 * already typed, and `superRefine` applies whichever rule the current mode
 * demands.
 */
export const declarationSchema = z
  .object({
    mode: z.enum(["ELECTRONIC", "SIGNED_UPLOAD"]),
    accepted: z.boolean(),
    signatoryName: personNameSchema,
    signedDate: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Enter a valid date." })
      .refine(
        (value) => {
          // A declaration cannot be dated in the future.
          const signed = new Date(value);
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          return signed <= endOfToday;
        },
        { message: "The declaration date cannot be in the future." },
      ),
    signedDocumentId: z.string().nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "ELECTRONIC" && value.accepted !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["accepted"],
        message: "You must confirm the declaration before continuing.",
      });
    }

    if (value.mode === "SIGNED_UPLOAD" && !value.signedDocumentId?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["signedDocumentId"],
        message: "Upload the signed declaration to continue.",
      });
    }
  });

export type DeclarationInput = z.infer<typeof declarationSchema>;

// ---------------------------------------------------------------------------
// Review / decision (admin)
// ---------------------------------------------------------------------------

export const decisionSchema = z
  .object({
    status: z.enum(["UNDER_REVIEW", "REVISION_REQUESTED", "APPROVED", "REJECTED"]),
    note: trimmed.max(4000, "Use 4000 characters or fewer.").optional(),
    /** Shares the note with the applicant as a comment. */
    notifyApplicant: z.boolean(),
  })
  .superRefine((value, ctx) => {
    // A team cannot act on "please revise" without being told what to change,
    // and a rejection without a reason is not reviewable.
    const requiresNote =
      value.status === "REVISION_REQUESTED" || value.status === "REJECTED";

    if (requiresNote && (!value.note || value.note.trim().length < 20)) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message:
          value.status === "REVISION_REQUESTED"
            ? "Explain what the team needs to change (at least 20 characters)."
            : "Give a reason for the rejection (at least 20 characters).",
      });
    }
  });

export type DecisionInput = z.infer<typeof decisionSchema>;

export const commentSchema = z.object({
  body: trimmed
    .min(2, "Write a comment before saving.")
    .max(4000, "Use 4000 characters or fewer."),
  visibility: z.enum(["INTERNAL", "SHARED"]),
});

export type CommentInput = z.infer<typeof commentSchema>;
