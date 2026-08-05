import { DeclarationMode } from "@/generated/prisma/enums";
import { isRichTextEmpty } from "@/domain/rich-text";
import type { AppSettings } from "@/domain/settings/app-settings";
import { EDITABLE_STEPS, type ApplicationStepSlug } from "./steps";
import type { ApplicationDto } from "./types";

/**
 * Which steps are finished, and what is still missing.
 *
 * This is the single answer used by the wizard's progress list, the review
 * screen and the server-side submit guard — so the button a student sees and
 * the rule the server enforces cannot disagree.
 */

export interface StepStatus {
  slug: ApplicationStepSlug;
  complete: boolean;
  /** Whether the step must be complete before the application can be sent. */
  required: boolean;
  missing: string[];
}

export interface CompletenessReport {
  steps: StepStatus[];
  /** 0–100, over required steps only. */
  percentComplete: number;
  canSubmit: boolean;
  blockingReasons: string[];
}

const filled = (value: string | null | undefined) => Boolean(value && value.trim().length > 0);
const filledRich = (value: string | null | undefined) => !isRichTextEmpty(value);

function applicantMissing(application: ApplicationDto): string[] {
  const missing: string[] = [];
  if (!filled(application.applicantPhone)) missing.push("Contact phone number");
  if (!application.schoolId) missing.push("School");
  if (!application.sectionId) missing.push("Section");
  if (!filled(application.program)) missing.push("Programme of study");
  if (!application.yearLevel) missing.push("Year level");
  return missing;
}

function teamMissing(application: ApplicationDto, settings: AppSettings): string[] {
  const missing: string[] = [];
  const team = application.team;

  if (!team) return ["Team details"];

  if (!filled(team.name)) missing.push("Team name");
  if (!filled(team.leaderName)) missing.push("Team leader's name");
  if (!filled(team.leaderStudentId)) missing.push("Team leader's student ID");
  if (!filled(team.leaderEmail)) missing.push("Team leader's contact email");
  if (!filled(team.leaderPhone)) missing.push("Team leader's phone number");

  const roster = team.members.length;
  const minSize = settings["team.minSize"];
  const maxSize = settings["team.maxSize"];

  if (roster < minSize) {
    missing.push(
      `At least ${minSize} team member${minSize === 1 ? "" : "s"} (currently ${roster})`,
    );
  }
  if (roster > maxSize) {
    missing.push(`No more than ${maxSize} team members (currently ${roster})`);
  }

  const incomplete = team.members.filter(
    (member) => !filled(member.studentId) || !filled(member.firstName) || !filled(member.surname),
  );
  if (incomplete.length > 0) {
    missing.push(`${incomplete.length} team member row(s) are incomplete`);
  }

  return missing;
}

function ventureMissing(application: ApplicationDto): string[] {
  const missing: string[] = [];
  if (!filled(application.projectTitle)) missing.push("Project title");
  if (!filled(application.theme)) missing.push("Theme");
  if (application.sdgAlignment.length === 0) missing.push("SDG alignment");
  if (!filledRich(application.problemStatement)) missing.push("Problem statement");
  if (!filledRich(application.proposedSolution)) missing.push("Tech-driven solution");
  if (!filledRich(application.innovation)) missing.push("Innovation");
  if (!filledRich(application.objectives)) missing.push("Objectives");
  if (!filledRich(application.targetUsers)) missing.push("Target users and beneficiaries");
  return missing;
}

function prototypeMissing(application: ApplicationDto): string[] {
  const missing: string[] = [];
  if (!filled(application.prototypeType)) missing.push("Prototype type");
  if (!filledRich(application.prototypeFeatures)) missing.push("Prototype features");
  if (!filledRich(application.developmentTools)) missing.push("Development tools and platforms");
  return missing;
}

function alternativesMissing(application: ApplicationDto): string[] {
  const missing: string[] = [];
  if (!filledRich(application.alternatives)) missing.push("Alternative solutions");
  if (!filledRich(application.justification)) missing.push("Justification");
  return missing;
}

function impactMissing(application: ApplicationDto): string[] {
  const missing: string[] = [];
  if (!filledRich(application.valueProposition)) missing.push("Value proposition");
  if (!filledRich(application.implementationPlan)) missing.push("Implementation plan");
  if (!filledRich(application.expectedImpact)) missing.push("Expected impact");
  if (!filledRich(application.timeline)) missing.push("Timeline");
  return missing;
}

function declarationMissing(application: ApplicationDto, settings: AppSettings): string[] {
  const declaration = application.declaration;
  const allowed = settings["declaration.mode"];

  if (!declaration) return ["Declaration"];

  if (allowed !== "BOTH") {
    const required = allowed === "ELECTRONIC" ? DeclarationMode.ELECTRONIC : DeclarationMode.SIGNED_UPLOAD;
    if (declaration.mode !== required) {
      return [
        required === DeclarationMode.ELECTRONIC
          ? "The electronic declaration (the signed-upload option is no longer accepted)"
          : "A signed declaration document (the electronic option is no longer accepted)",
      ];
    }
  }

  const missing: string[] = [];
  if (declaration.mode === DeclarationMode.ELECTRONIC) {
    if (!declaration.accepted) missing.push("Confirmation of the declaration");
    if (!filled(declaration.signatoryName)) missing.push("Team leader's full name");
    if (!declaration.signedAt) missing.push("Declaration date");
  } else {
    if (!declaration.signedDocumentId) missing.push("Signed declaration document");
    if (!filled(declaration.signatoryName)) missing.push("Team leader's full name");
    if (!declaration.signedAt) missing.push("Declaration date");
  }

  return missing;
}

/** Attachments are optional, so this step is always "complete". */
const ATTACHMENTS_ARE_OPTIONAL = true;

export function assessCompleteness(
  application: ApplicationDto,
  settings: AppSettings,
): CompletenessReport {
  const missingBySlug: Record<ApplicationStepSlug, string[]> = {
    applicant: applicantMissing(application),
    team: teamMissing(application, settings),
    venture: ventureMissing(application),
    prototype: prototypeMissing(application),
    alternatives: alternativesMissing(application),
    impact: impactMissing(application),
    attachments: [],
    declaration: declarationMissing(application, settings),
    review: [],
  };

  const steps: StepStatus[] = EDITABLE_STEPS.map((step) => {
    const required = !(step.slug === "attachments" && ATTACHMENTS_ARE_OPTIONAL);
    const missing = missingBySlug[step.slug];
    return {
      slug: step.slug,
      required,
      missing,
      complete: missing.length === 0,
    };
  });

  const requiredSteps = steps.filter((step) => step.required);
  const completedRequired = requiredSteps.filter((step) => step.complete).length;

  const blockingReasons = steps
    .filter((step) => step.required && !step.complete)
    .flatMap((step) => step.missing);

  return {
    steps,
    percentComplete:
      requiredSteps.length === 0
        ? 100
        : Math.round((completedRequired / requiredSteps.length) * 100),
    canSubmit: blockingReasons.length === 0,
    blockingReasons,
  };
}
