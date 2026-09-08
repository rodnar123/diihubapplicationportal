/**
 * The official BizTech Ideation Pitch marking sheet, as data.
 *
 * This is a transcription, not a design. It follows *Evaluation Criteria –
 * BizTech Ideation Pitch* (School of Business Studies, Semester 2, 2026) line
 * for line: eight sections, twenty-seven marked lines, one hundred marks. An
 * assessor holding the paper sheet and an assessor holding this screen must be
 * filling in the same form, in the same order, with the same wording — anything
 * else turns "type up your sheet" into a translation exercise, and translation
 * is where marks get entered against the wrong line.
 *
 * ## Why `weight` equals `maxValue` on every line
 *
 * The paper sheet has no weight column. A line worth 5 is worth 5 of the 100,
 * and that *is* its weight — the two ideas the code keeps apart are one idea on
 * the sheet. Setting them equal makes {@link scoreCard} reproduce the sheet's
 * arithmetic exactly rather than approximately:
 *
 *     normalisedValue(v, c) * weight  =  (v / maxValue) * maxValue  =  v
 *
 * so the weighted sum is the plain sum of the marks awarded, the weights total
 * 100, and the percentage the panel sees is the sheet's own total out of 100.
 * Nothing in `rubric.ts` special-cases this; it falls out of the arithmetic
 * already there, which is why the rubric could change shape this much without
 * the scoring code changing at all.
 *
 * Keep them equal when editing. A line whose weight drifts from its maximum
 * still scores, but it stops matching the paper the assessors marked on.
 */

export interface RubricTemplateEntry {
  /** Section this line sits under, e.g. "INNOVATION". */
  readonly groupCode: string;
  readonly groupName: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly weight: number;
  readonly maxValue: number;
  readonly sortOrder: number;
}

interface RubricSection {
  readonly code: string;
  readonly name: string;
  readonly lines: ReadonlyArray<{
    readonly code: string;
    readonly name: string;
    readonly description: string;
    readonly max: number;
  }>;
}

/**
 * The sheet, in its printed order.
 *
 * Nested rather than flat so that a section total can be read off by eye
 * against the printed form, and so `sortOrder` cannot drift out of step with
 * the running order — it is assigned below rather than typed twenty-seven
 * times.
 */
const RUBRIC_SECTIONS: readonly RubricSection[] = [
  {
    code: "PROBLEM",
    name: "Problem definition",
    lines: [
      {
        code: "PROB_OPPORTUNITY",
        name: "Problem, issue or an opportunity",
        description:
          "Clearly defined root cause of the problem (and its symptoms), or an opportunity for a disruptive, value-added creation.",
        max: 5,
      },
    ],
  },
  {
    code: "SOLUTION",
    name: "Intended solution",
    lines: [
      {
        code: "SOL_RELEVANCE",
        name: "Relevance to the problem",
        description:
          "Addresses the defined problem and is relevant to the identified users or customers as an innovative solution.",
        max: 5,
      },
      {
        code: "SOL_BIZTECH",
        name: "Relevance to the BizTech Innovators Challenge 2026",
        description:
          "Incorporates both the business proposition and the related digital solution.",
        max: 4,
      },
      {
        code: "SOL_ORIGINAL",
        name: "Original idea",
        description:
          "Demonstrates fresh thinking by integrating different concepts, approaches or perspectives into a unique idea.",
        max: 5,
      },
    ],
  },
  {
    code: "GOALS",
    name: "Alignment with development goals",
    lines: [
      {
        code: "GOALS_NATIONAL",
        name: "PNG's goals and national priorities",
        description:
          "Clear, specific and relevant alignment to Vision 2050, the MTDP IV SPAs, the DSP and related national priorities.",
        max: 5,
      },
      {
        code: "GOALS_UN",
        name: "Global goals (UN)",
        description:
          "Clear, specific and relevant alignment to the UN Sustainable Development Goals.",
        max: 3,
      },
    ],
  },
  {
    code: "INNOVATION",
    name: "Innovation",
    lines: [
      {
        code: "INNO_ORIGINALITY",
        name: "Originality",
        description: "The idea is unique and fresh compared to existing solutions.",
        max: 5,
      },
      {
        code: "INNO_CREATIVITY",
        name: "Creativity",
        description:
          "Originality in combining concepts, approaches or perspectives into an innovative solution.",
        max: 5,
      },
      {
        code: "INNO_DIGITAL",
        name: "Digital innovation",
        description:
          "Effective and imaginative use of the intended digital tools, platforms or emerging technologies.",
        max: 5,
      },
      {
        code: "INNO_ENTREPRENEURIAL",
        name: "Entrepreneurial innovation",
        description:
          "The idea integrates business potential, market viability and entrepreneurial thinking.",
        max: 5,
      },
    ],
  },
  {
    code: "IMPACT",
    name: "Impact potential",
    lines: [
      {
        code: "IMPACT_REACH",
        // "Breath of Reach" on the printed sheet. Corrected here because the
        // intent is unambiguous and the misspelling reads as a portal typo.
        name: "Breadth of reach",
        description: "Can immediately impact the targeted audience.",
        max: 4,
      },
      {
        code: "IMPACT_DEPTH",
        name: "Depth of change",
        description: "Benefits will be meaningful or transformative.",
        max: 5,
      },
      {
        code: "IMPACT_SUSTAINABILITY",
        name: "Sustainability",
        description: "Potential to continue over time.",
        max: 5,
      },
      {
        code: "IMPACT_SCALABILITY",
        name: "Scalability",
        description: "Can be scaled beyond the initial target users or customers.",
        max: 4,
      },
    ],
  },
  {
    code: "FEASIBILITY",
    name: "Feasibility",
    lines: [
      {
        code: "FEAS_DELIVERABLES",
        name: "Challenge deliverables",
        description:
          "Can the team realistically deliver the outputs the competition requires — concept paper, prototype, business plan — within the given timeframe, resources and student capacity?",
        max: 3,
      },
      {
        code: "FEAS_IMPLEMENTATION",
        name: "Actual implementation (beyond this challenge)",
        description:
          "Is the idea practical to implement in the real world beyond this student challenge, considering technology readiness, infrastructure, business opportunity, market and adoption?",
        max: 3,
      },
    ],
  },
  {
    code: "PRESENTATION",
    name: "Presentation",
    lines: [
      {
        code: "PRES_STRUCTURE",
        name: "Structure and flow",
        description: "Logical sequence, smooth transitions, clear storyline.",
        max: 3,
      },
      {
        code: "PRES_CLARITY",
        name: "Clarity of communication",
        description: "Simplicity, accessibility, avoidance of jargon.",
        max: 3,
      },
      {
        code: "PRES_ENGAGEMENT",
        name: "Engagement and delivery",
        description: "Confidence, enthusiasm, audience connection.",
        max: 3,
      },
      {
        code: "PRES_VISUALS",
        name: "Use of visuals",
        description: "Quality, clarity and relevance of supporting materials.",
        max: 3,
      },
      {
        code: "PRES_PERSUASIVENESS",
        name: "Persuasiveness",
        description: "Strength of argument, impact and closing statement.",
        max: 3,
      },
      {
        code: "PRES_QUESTIONS",
        name: "Responses to questions",
        description: "Ability to respond to questions.",
        max: 3,
      },
      {
        code: "PRES_TIMING",
        name: "Timing (12–15 minutes)",
        description: "Within the time range.",
        max: 2,
      },
    ],
  },
  {
    code: "TEAM",
    name: "Team",
    lines: [
      {
        code: "TEAM_UNIFIED",
        name: "Unified efforts",
        description: "Effort is visible among all members.",
        max: 2,
      },
      {
        code: "TEAM_READINESS",
        name: "Readiness to present",
        description: "Prepared to start immediately after the previous group.",
        max: 2,
      },
      {
        code: "TEAM_COMPOSITION",
        name: "Composition",
        description: "Fair representation as per the flyer requirements.",
        max: 3,
      },
      {
        code: "TEAM_ATTIRE",
        name: "Attire",
        description: "Consistency or coordinated dress style.",
        max: 2,
      },
    ],
  },
];

/**
 * The rubric a challenge year starts with, flattened into rows.
 *
 * `sortOrder` runs 0..26 across the whole sheet rather than restarting per
 * section, so the single `ORDER BY sortOrder` in `getRubric` reproduces the
 * printed running order and the sections come back contiguous.
 */
export const DEFAULT_RUBRIC: readonly RubricTemplateEntry[] = RUBRIC_SECTIONS.flatMap(
  (section, sectionIndex) =>
    section.lines.map((line, lineIndex) => ({
      groupCode: section.code,
      groupName: section.name,
      code: line.code,
      name: line.name,
      description: line.description,
      // See the note at the top of this file: equal by design.
      weight: line.max,
      maxValue: line.max,
      sortOrder:
        RUBRIC_SECTIONS.slice(0, sectionIndex).reduce(
          (count, earlier) => count + earlier.lines.length,
          0,
        ) + lineIndex,
    })),
);

/** Sanity check used by the seed and the admin screen. */
export function totalWeight(entries: readonly { weight: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.weight, 0);
}
