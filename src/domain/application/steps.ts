/**
 * The application wizard, described once.
 *
 * The order and slugs here drive the sidebar progress list, the "next"/"back"
 * buttons, the completeness summary and the URL. Sections follow the printed
 * DiiHub BizTech Challenge form so a student filling one in alongside the
 * other never has to hunt for a field.
 */

export const APPLICATION_STEPS = [
  {
    slug: "applicant",
    title: "Your details",
    shortTitle: "Your details",
    formSection: "Section A",
    description:
      "Confirm the contact and enrolment details that will appear on your application.",
  },
  {
    slug: "team",
    title: "Team information",
    shortTitle: "Team",
    formSection: "Section B",
    description:
      "Name your team, nominate a leader, and list every member with their student ID, section and role.",
  },
  {
    slug: "venture",
    title: "Venture (project)",
    shortTitle: "Venture",
    formSection: "Section C",
    description:
      "The problem you are solving, your tech-driven solution, and who benefits from it.",
  },
  {
    slug: "prototype",
    title: "Prototype details",
    shortTitle: "Prototype",
    formSection: "Section D",
    description: "What you have built, what it demonstrates, and the tools you used.",
  },
  {
    slug: "alternatives",
    title: "Alternatives vs this solution",
    shortTitle: "Alternatives",
    formSection: "Section E",
    description:
      "Three existing solutions to the same problem, and why yours is preferred.",
  },
  {
    slug: "impact",
    title: "Impact & feasibility",
    shortTitle: "Impact",
    formSection: "Section F",
    description:
      "Your value proposition, how you will implement it, and the impact you expect.",
  },
  {
    slug: "attachments",
    title: "Attachments",
    shortTitle: "Attachments",
    formSection: "Section G",
    description:
      "Supporting documents, prototype screenshots or a demonstration package. Optional.",
  },
  {
    slug: "declaration",
    title: "Declaration",
    shortTitle: "Declaration",
    formSection: "Section H",
    description:
      "Confirm that the proposal and prototype are your team's original work.",
  },
  {
    slug: "review",
    title: "Review & submit",
    shortTitle: "Review",
    formSection: "",
    description: "Check everything, then send your application to the challenge office.",
  },
] as const;

export type ApplicationStepSlug = (typeof APPLICATION_STEPS)[number]["slug"];
export type ApplicationStep = (typeof APPLICATION_STEPS)[number];

/** Steps that hold answers, i.e. everything except the final review screen. */
export const EDITABLE_STEPS = APPLICATION_STEPS.filter(
  (step) => step.slug !== "review",
) as ReadonlyArray<ApplicationStep>;

export const STEP_SLUGS = APPLICATION_STEPS.map((step) => step.slug);

export function isApplicationStepSlug(value: string): value is ApplicationStepSlug {
  return (STEP_SLUGS as readonly string[]).includes(value);
}

export function getStep(slug: ApplicationStepSlug): ApplicationStep {
  const step = APPLICATION_STEPS.find((candidate) => candidate.slug === slug);
  if (!step) throw new Error(`Unknown application step: ${slug}`);
  return step;
}

export function stepIndex(slug: ApplicationStepSlug): number {
  return APPLICATION_STEPS.findIndex((step) => step.slug === slug);
}

export function nextStep(slug: ApplicationStepSlug): ApplicationStep | null {
  return APPLICATION_STEPS[stepIndex(slug) + 1] ?? null;
}

export function previousStep(slug: ApplicationStepSlug): ApplicationStep | null {
  const index = stepIndex(slug);
  return index > 0 ? APPLICATION_STEPS[index - 1] : null;
}
