import { ReviewAssignmentStatus } from "@/generated/prisma/enums";

/**
 * The marking rubric, as arithmetic.
 *
 * Pure, like the rest of `domain/` — no database, no framework, no clock. That
 * is what lets the reviewer's own screen show them the aggregate they are about
 * to affect, using the identical code the server uses to rank the cohort. A
 * ranking a reviewer cannot reproduce is a ranking they cannot defend.
 *
 * Two rules govern everything here:
 *
 *   1. Only a *committed* scorecard counts. A reviewer part-way through
 *      marking would otherwise drag the ranking around while they worked, and
 *      a half-filled card scores low for reasons that have nothing to do with
 *      the entry.
 *   2. Criteria are normalised before they are weighted. One criterion marked
 *      out of 10 and another out of 5 are not comparable as raw numbers, and
 *      summing them would silently give the out-of-10 line twice the influence
 *      its weight asked for.
 */

export interface Criterion {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly weight: number;
  readonly maxValue: number;
  readonly sortOrder: number;
}

export interface ScoreEntry {
  readonly criterionId: string;
  readonly value: number;
  readonly comment: string | null;
}

export interface Scorecard {
  readonly assignmentId: string;
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly status: ReviewAssignmentStatus;
  readonly scores: readonly ScoreEntry[];
}

// ---------------------------------------------------------------------------
// One mark
// ---------------------------------------------------------------------------

/**
 * Whether a single mark is admissible against its criterion.
 *
 * Integers only: half-marks invite a precision the rubric does not have, and
 * the column is an integer anyway.
 */
export function isValidScore(value: number, criterion: Criterion): boolean {
  return Number.isInteger(value) && value >= 0 && value <= criterion.maxValue;
}

/**
 * A mark as a fraction of what was available, 0..1.
 *
 * The normalisation described in rule 2 above. `maxValue` is guaranteed
 * positive by a CHECK constraint, but this is domain code that may be handed
 * anything, so the degenerate case returns 0 rather than dividing by zero.
 */
export function normalisedValue(value: number, criterion: Criterion): number {
  if (criterion.maxValue <= 0) return 0;
  return Math.min(1, Math.max(0, value / criterion.maxValue));
}

// ---------------------------------------------------------------------------
// One reviewer's card
// ---------------------------------------------------------------------------

export interface ScorecardResult {
  readonly assignmentId: string;
  readonly reviewerId: string;
  readonly reviewerName: string;
  /** Weighted percentage, 0..100, over the criteria this card actually marked. */
  readonly percentage: number;
  readonly scoredCount: number;
  readonly criterionCount: number;
  readonly isComplete: boolean;
  readonly isCounted: boolean;
}

/**
 * A card is complete when every active criterion carries a mark. Partial cards
 * are allowed to exist — a reviewer working through a long rubric across two
 * sittings is normal — they simply cannot be committed.
 */
export function isScorecardComplete(
  criteria: readonly Criterion[],
  scores: readonly ScoreEntry[],
): boolean {
  if (criteria.length === 0) return false;
  const marked = new Set(scores.map((score) => score.criterionId));
  return criteria.every((criterion) => marked.has(criterion.id));
}

/**
 * Scores one reviewer's card.
 *
 * The denominator is the weight of the criteria *this card marked*, not the
 * weight of the whole rubric. A card missing two lines therefore reads as a
 * percentage of what it did assess rather than being quietly penalised — which
 * matters because {@link summariseScores} shows partial cards to the panel even
 * though it does not count them.
 */
export function scoreCard(
  criteria: readonly Criterion[],
  card: Scorecard,
): ScorecardResult {
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));

  let weighted = 0;
  let totalWeight = 0;
  let scoredCount = 0;

  for (const score of card.scores) {
    const criterion = byId.get(score.criterionId);
    // A mark against a criterion that has since been retired is ignored rather
    // than counted at an arbitrary weight.
    if (!criterion) continue;

    weighted += normalisedValue(score.value, criterion) * criterion.weight;
    totalWeight += criterion.weight;
    scoredCount += 1;
  }

  return {
    assignmentId: card.assignmentId,
    reviewerId: card.reviewerId,
    reviewerName: card.reviewerName,
    percentage: totalWeight > 0 ? round1((weighted / totalWeight) * 100) : 0,
    scoredCount,
    criterionCount: criteria.length,
    isComplete: isScorecardComplete(criteria, card.scores),
    isCounted: card.status === ReviewAssignmentStatus.SUBMITTED,
  };
}

// ---------------------------------------------------------------------------
// The panel's view of one application
// ---------------------------------------------------------------------------

export interface CriterionAverage {
  readonly criterionId: string;
  readonly code: string;
  readonly name: string;
  readonly weight: number;
  readonly maxValue: number;
  /** Mean raw mark across counted cards, on the criterion's own scale. */
  readonly mean: number;
  readonly reviewerCount: number;
}

export interface ApplicationScore {
  /** Weighted mean across every committed card, 0..100. Null when none are. */
  readonly percentage: number | null;
  readonly cards: readonly ScorecardResult[];
  readonly countedCards: number;
  readonly pendingCards: number;
  readonly recusedCards: number;
  readonly byCriterion: readonly CriterionAverage[];
  /**
   * Difference between the highest and lowest committed card, in points.
   * Null until at least two reviewers have committed.
   */
  readonly spread: number | null;
  /**
   * True when the panel disagrees enough to be worth a conversation before the
   * result stands. Advisory — nothing in the system blocks on it.
   */
  readonly needsModeration: boolean;
}

/**
 * How far two reviewers may diverge before the disagreement is worth raising.
 *
 * Twenty points is roughly the distance between "good" and "outstanding" on a
 * five-point scale. Below that, reviewers are reading the same entry
 * differently at the margins, which is what having a panel is for; above it,
 * they are reading a different entry, and one of them has usually missed an
 * attachment or a section.
 */
export const MODERATION_SPREAD_THRESHOLD = 20;

export function summariseScores(
  criteria: readonly Criterion[],
  cards: readonly Scorecard[],
): ApplicationScore {
  const results = cards.map((card) => scoreCard(criteria, card));
  const counted = results.filter((result) => result.isCounted);

  const percentage =
    counted.length > 0
      ? round1(counted.reduce((sum, result) => sum + result.percentage, 0) / counted.length)
      : null;

  const spread =
    counted.length >= 2
      ? round1(
          Math.max(...counted.map((r) => r.percentage)) -
            Math.min(...counted.map((r) => r.percentage)),
        )
      : null;

  // Per-criterion means, so a panel can see *where* they disagreed rather than
  // only that they did.
  const countedIds = new Set(counted.map((result) => result.assignmentId));
  const byCriterion = criteria.map((criterion) => {
    const marks = cards
      .filter((card) => countedIds.has(card.assignmentId))
      .flatMap((card) => card.scores.filter((score) => score.criterionId === criterion.id))
      .map((score) => score.value);

    return {
      criterionId: criterion.id,
      code: criterion.code,
      name: criterion.name,
      weight: criterion.weight,
      maxValue: criterion.maxValue,
      mean: marks.length > 0 ? round1(marks.reduce((a, b) => a + b, 0) / marks.length) : 0,
      reviewerCount: marks.length,
    };
  });

  return {
    percentage,
    cards: results,
    countedCards: counted.length,
    pendingCards: cards.filter(
      (card) =>
        card.status === ReviewAssignmentStatus.PENDING ||
        card.status === ReviewAssignmentStatus.IN_PROGRESS,
    ).length,
    recusedCards: cards.filter((card) => card.status === ReviewAssignmentStatus.RECUSED).length,
    byCriterion,
    spread,
    needsModeration: spread !== null && spread >= MODERATION_SPREAD_THRESHOLD,
  };
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export interface RankableEntry {
  readonly applicationId: string;
  readonly score: ApplicationScore;
}

export interface RankedEntry extends RankableEntry {
  /** 1-based. Ties share a rank, and the next rank skips accordingly. */
  readonly rank: number | null;
}

/**
 * Orders a cohort by aggregate score, highest first.
 *
 * Unscored entries keep a null rank and sort last rather than being treated as
 * zero — "nobody has marked this yet" and "the panel marked it badly" are
 * opposite facts and must not look alike in a ranked list.
 *
 * Ties genuinely happen on a five-point rubric with three reviewers, so they
 * share a rank. Breaking them arbitrarily would invent a distinction the marks
 * do not support, and on a prize boundary that is exactly the distinction
 * someone will appeal.
 */
export function rankEntries(entries: readonly RankableEntry[]): RankedEntry[] {
  const scored = entries.filter((entry) => entry.score.percentage !== null);
  const unscored = entries.filter((entry) => entry.score.percentage === null);

  const ordered = [...scored].sort(
    (a, b) => (b.score.percentage ?? 0) - (a.score.percentage ?? 0),
  );

  const ranked: RankedEntry[] = [];
  let lastPercentage: number | null = null;
  let lastRank = 0;

  ordered.forEach((entry, index) => {
    const percentage = entry.score.percentage;
    const rank = percentage === lastPercentage ? lastRank : index + 1;

    ranked.push({ ...entry, rank });
    lastPercentage = percentage;
    lastRank = rank;
  });

  return [...ranked, ...unscored.map((entry) => ({ ...entry, rank: null }))];
}

/** One decimal place. Two implies a precision a five-point rubric does not have. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
