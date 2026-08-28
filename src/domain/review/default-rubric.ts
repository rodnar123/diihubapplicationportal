/**
 * The rubric a new challenge year starts with.
 *
 * Deliberately derived from the form's own sections rather than invented. A
 * student answering "Problem Statement" and "Target Users" should be able to
 * see which line of the rubric those answers are marked under; a rubric that
 * asks about something the form never requested is one no applicant can
 * prepare for, and one no reviewer can point at when explaining a mark.
 *
 * Weights sum to 100 so they read as percentages, but nothing depends on that
 * — {@link summariseScores} divides by whatever the weights actually total.
 * The challenge office edits all of this from the admin console; these values
 * are only the starting point for a cycle that has no rubric yet.
 */

export interface RubricTemplateEntry {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly weight: number;
  readonly maxValue: number;
  readonly sortOrder: number;
}

export const DEFAULT_RUBRIC: readonly RubricTemplateEntry[] = [
  {
    code: "PROBLEM",
    name: "Problem definition",
    description:
      "Is the problem real, clearly stated, and does the team show they understand who has it? Marks the Problem Statement and Target Users answers.",
    weight: 20,
    maxValue: 5,
    sortOrder: 0,
  },
  {
    code: "INNOVATION",
    name: "Innovation and technology",
    description:
      "How original is the approach, and is the technology a genuine part of the answer rather than decoration? Marks the Proposed Solution and Innovation answers.",
    weight: 25,
    maxValue: 5,
    sortOrder: 1,
  },
  {
    code: "PROTOTYPE",
    name: "Prototype and feasibility",
    description:
      "Is there something built or credibly buildable by this team, with the tools they name? Marks the prototype section and any supporting evidence attached.",
    weight: 20,
    maxValue: 5,
    sortOrder: 2,
  },
  {
    code: "IMPACT",
    name: "Impact and value",
    description:
      "If this worked, who is better off and by how much? Marks the Expected Impact and Value Proposition answers.",
    weight: 20,
    maxValue: 5,
    sortOrder: 3,
  },
  {
    code: "VIABILITY",
    name: "Implementation and sustainability",
    description:
      "Is there a plan, a timeline and a budget that hold together, and does the venture survive past the challenge? Marks the implementation, timeline, budget and sustainability answers.",
    weight: 15,
    maxValue: 5,
    sortOrder: 4,
  },
];

/** Sanity check used by the seed and the admin screen. */
export function totalWeight(entries: readonly { weight: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.weight, 0);
}
