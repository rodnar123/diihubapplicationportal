import "server-only";

import { ReviewAssignmentStatus } from "@/generated/prisma/enums";
import { groupCriteria, type Criterion } from "@/domain/review/rubric";
import { prisma } from "@/lib/db/prisma";
import { getRubric } from "@/services/admin/scoring-service";
import { getAppSettings } from "@/services/settings/settings-service";

/**
 * The panel's marking, shaped the way the marking sheet is read.
 *
 * This is the assessors' own document rebuilt from what the portal holds: the
 * rubric down the page, one column per marker across it, section subtotals
 * against section totals, and the office's decision note underneath. It is
 * deliberately the same shape as the paper, because the people reading it are
 * the people who filled the paper in.
 *
 * Reporting only, and additive: nothing here writes, and no other module reads
 * it. Both exports — the workbook and the PDF — are rendered from this one
 * structure so they can never quietly disagree about a number.
 *
 * ## Which marks are shown
 *
 * A card that has not been submitted is still a draft, and a draft is private
 * to its reviewer: `getReviewPanel` withholds it from the rest of the panel so
 * nobody anchors on marks their author may still change. That reasoning does
 * not expire when the marks reach a report, so an unsubmitted card appears here
 * as a named column with no figures in it. The column is kept rather than
 * dropped because "this assessor has not finished" is itself something the
 * office needs to see; a missing column would read as an assessor who was never
 * allocated the entry at all.
 *
 * A recused card is omitted entirely. Its marks were deleted when the reviewer
 * stepped away, and the conflict of interest that produced them is exactly the
 * reason they must not be reported.
 */

export interface ScoreReportMarker {
  assignmentId: string;
  name: string;
  /** Committed. Only a committed card contributes marks and totals. */
  submitted: boolean;
  submittedAt: string | null;
  /** Raw total out of the rubric maximum. Null while the card is a draft. */
  total: number | null;
}

export interface ScoreReportLine {
  criterionId: string;
  name: string;
  description: string | null;
  maxValue: number;
  /** One entry per marker, in the same order as `markers`. */
  marks: (number | null)[];
  notes: (string | null)[];
}

export interface ScoreReportGroup {
  code: string;
  name: string;
  /** Marks available across the section — the printed sheet's section total. */
  maxTotal: number;
  lines: ScoreReportLine[];
  /** Section subtotal per marker, aligned with `markers`. */
  subtotals: (number | null)[];
}

export interface ScoreReportEntry {
  applicationId: string;
  referenceNumber: string | null;
  projectTitle: string | null;
  teamName: string | null;
  theme: string | null;
  status: string;
  decisionNote: string | null;
  markers: ScoreReportMarker[];
  groups: ScoreReportGroup[];
  /** The rubric's own maximum, so a reader can check it still totals 100. */
  maxTotal: number;
  /** Mean of the submitted markers' totals. Null when none are submitted. */
  average: number | null;
  submittedMarkers: number;
}

export interface ScoreReport {
  challengeYear: number;
  generatedAt: Date;
  criteriaCount: number;
  entries: ScoreReportEntry[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Builds the report for a set of applications, in the order given.
 *
 * The caller has already decided which entries these are — the export routes
 * pass the ids the reviewer's current filter resolved to, so a report always
 * covers what was on screen when it was asked for.
 */
export async function buildScoreReport(applicationIds: string[]): Promise<ScoreReport> {
  const settings = await getAppSettings();
  const challengeYear = settings["challenge.year"];

  const [criteria, applications, assignments] = await Promise.all([
    getRubric(challengeYear),
    prisma.application.findMany({
      where: { id: { in: applicationIds } },
      select: {
        id: true,
        referenceNumber: true,
        projectTitle: true,
        theme: true,
        status: true,
        decisionNote: true,
        team: { select: { name: true } },
      },
    }),
    prisma.reviewAssignment.findMany({
      where: { applicationId: { in: applicationIds }, deletedAt: null },
      select: {
        id: true,
        applicationId: true,
        status: true,
        submittedAt: true,
        reviewer: { select: { name: true } },
        scores: { select: { criterionId: true, value: true, comment: true } },
      },
      // Marker columns follow allocation order, so an assessor sits in the same
      // column on every entry they marked and a reader can scan down the set.
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const byApplication = new Map<string, typeof assignments>();
  for (const assignment of assignments) {
    const list = byApplication.get(assignment.applicationId) ?? [];
    list.push(assignment);
    byApplication.set(assignment.applicationId, list);
  }

  const applicationById = new Map(applications.map((a) => [a.id, a]));
  const groups = groupCriteria(criteria);
  const maxTotal = criteria.reduce((sum, c) => sum + c.maxValue, 0);

  const entries = applicationIds
    .map((id) => applicationById.get(id))
    .filter((application) => application !== undefined)
    .map((application) => buildEntry(application, byApplication.get(application.id) ?? [], groups, maxTotal));

  return {
    challengeYear,
    generatedAt: new Date(),
    criteriaCount: criteria.length,
    entries,
  };
}

type ApplicationRow = {
  id: string;
  referenceNumber: string | null;
  projectTitle: string | null;
  theme: string | null;
  status: string;
  decisionNote: string | null;
  team: { name: string } | null;
};

type AssignmentRow = {
  id: string;
  status: ReviewAssignmentStatus;
  submittedAt: Date | null;
  reviewer: { name: string };
  scores: Array<{ criterionId: string; value: number; comment: string | null }>;
};

function buildEntry(
  application: ApplicationRow,
  assignments: AssignmentRow[],
  groups: ReturnType<typeof groupCriteria>,
  maxTotal: number,
): ScoreReportEntry {
  // See the note at the top of the file: a recusal takes its marks with it.
  const cards = assignments.filter(
    (assignment) => assignment.status !== ReviewAssignmentStatus.RECUSED,
  );

  const marksByCard = cards.map((card) => {
    const submitted = card.status === ReviewAssignmentStatus.SUBMITTED;
    const byCriterion = new Map(card.scores.map((s) => [s.criterionId, s]));
    return { card, submitted, byCriterion };
  });

  const markers: ScoreReportMarker[] = marksByCard.map(({ card, submitted, byCriterion }) => ({
    assignmentId: card.id,
    name: card.reviewer.name,
    submitted,
    submittedAt: card.submittedAt?.toISOString() ?? null,
    total: submitted
      ? [...byCriterion.values()].reduce((sum, score) => sum + score.value, 0)
      : null,
  }));

  const reportGroups: ScoreReportGroup[] = groups.map((group) => {
    const lines: ScoreReportLine[] = group.criteria.map((criterion: Criterion) => ({
      criterionId: criterion.id,
      name: criterion.name,
      description: criterion.description,
      maxValue: criterion.maxValue,
      marks: marksByCard.map(({ submitted, byCriterion }) =>
        submitted ? (byCriterion.get(criterion.id)?.value ?? null) : null,
      ),
      notes: marksByCard.map(({ submitted, byCriterion }) =>
        submitted ? (byCriterion.get(criterion.id)?.comment ?? null) : null,
      ),
    }));

    const subtotals = marksByCard.map(({ submitted, byCriterion }) =>
      submitted
        ? group.criteria.reduce(
            (sum, criterion) => sum + (byCriterion.get(criterion.id)?.value ?? 0),
            0,
          )
        : null,
    );

    return { code: group.code, name: group.name, maxTotal: group.maxTotal, lines, subtotals };
  });

  const submittedTotals = markers
    .map((marker) => marker.total)
    .filter((total): total is number => total !== null);

  return {
    applicationId: application.id,
    referenceNumber: application.referenceNumber,
    projectTitle: application.projectTitle,
    teamName: application.team?.name ?? null,
    theme: application.theme,
    status: application.status,
    decisionNote: application.decisionNote,
    markers,
    groups: reportGroups,
    maxTotal,
    average:
      submittedTotals.length > 0
        ? round1(submittedTotals.reduce((a, b) => a + b, 0) / submittedTotals.length)
        : null,
    submittedMarkers: submittedTotals.length,
  };
}
