import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/**
 * Near-duplicate detection across proposals.
 *
 * Two teams arriving at the same idea is normal and not misconduct — a cohort
 * taught the same course, given the same themes, will converge. Two teams
 * arriving at the same *sentences* is a different thing, and a panel reading
 * sixty entries over a fortnight has no realistic chance of noticing it.
 *
 * So this flags, it does not accuse. The output is a prompt to go and read two
 * entries side by side, and it deliberately produces no verdict, no score on
 * the rubric and no notification to the student. A false positive costs a
 * reviewer two minutes; the alternative — a system that told a student it had
 * detected plagiarism — costs rather more when it is wrong.
 *
 * Built on `pg_trgm`, which the search indexes already installed. Trigram
 * similarity is a blunt instrument: it catches copied and lightly-reworded
 * text, and misses a genuine paraphrase. That is the right trade here, because
 * the failure mode of a cleverer measure is confident nonsense.
 */

/**
 * Similarity above which a pair is worth a reviewer's attention.
 *
 * **Measured, not guessed.** Run against the 2026 cohort with the threshold
 * dropped to zero, the closest pair of independently written entries scored
 * **0.39**, and the top of the distribution sat in the 0.36–0.39 band —
 * teams writing separately about the same themes, sharing vocabulary and
 * little else. Identical text is 1.0, and light rewording of copied text stays
 * well above this line.
 *
 * So 0.45 clears the observed noise floor, but only by about six points. If
 * false positives start appearing, raise it rather than adding cleverness —
 * and re-measure against the live cohort the same way, because the floor moves
 * with the theme list. A flag nobody trusts is a flag nobody reads.
 */
export const SIMILARITY_THRESHOLD = 0.45;

/** The narrative fields worth comparing. Short answers are too noisy. */
const COMPARED_FIELDS = ["problemStatement", "proposedSolution", "innovation"] as const;

export interface SimilarPair {
  applicationId: string;
  referenceNumber: string | null;
  projectTitle: string | null;
  teamName: string | null;
  /** Highest similarity across the compared fields, 0..1. */
  similarity: number;
  /** Which field drove the match, so a reviewer knows where to look. */
  field: string;
}

/**
 * Entries whose narrative closely resembles this one, within the same cycle.
 *
 * Cross-year comparison is deliberately out of scope: reusing your own venture
 * from last cycle is a question about eligibility rules, not about authorship,
 * and answering it here would put those two very different things in the same
 * list.
 */
export async function findSimilarApplications(
  applicationId: string,
  options: { limit?: number; threshold?: number } = {},
): Promise<SimilarPair[]> {
  const limit = options.limit ?? 5;
  const threshold = options.threshold ?? SIMILARITY_THRESHOLD;

  const subject = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: {
      challengeYear: true,
      problemStatement: true,
      proposedSolution: true,
      innovation: true,
    },
  });

  if (!subject) return [];

  // Nothing to compare against an empty draft.
  const hasContent = COMPARED_FIELDS.some((field) => {
    const value = subject[field];
    return typeof value === "string" && value.trim().length >= 200;
  });
  if (!hasContent) return [];

  /*
   * One query rather than three.
   *
   * `GREATEST` over the per-field similarities gives the strongest signal, and
   * the CASE reports which field produced it — a reviewer told only "83%
   * similar" still has to find the overlap themselves.
   *
   * The HTML is stripped with `regexp_replace` before comparison: these columns
   * hold sanitised markup, and identical prose wrapped in different tags would
   * otherwise score lower than it should. Doing it in SQL keeps this to a
   * single round trip instead of pulling every entry in the cohort into the
   * function to compare in JavaScript.
   */
  const strip = (column: string) =>
    Prisma.sql`regexp_replace(coalesce(${Prisma.raw(`o."${column}"`)}, ''), '<[^>]*>', ' ', 'g')`;

  const stripSubject = (value: string | null) =>
    Prisma.sql`regexp_replace(coalesce(${value}, ''), '<[^>]*>', ' ', 'g')`;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      referenceNumber: string | null;
      projectTitle: string | null;
      teamName: string | null;
      similarity: number;
      field: string;
    }>
  >(Prisma.sql`
    WITH scored AS (
      SELECT
        o."id",
        o."referenceNumber",
        o."projectTitle",
        t."name" AS "teamName",
        similarity(${stripSubject(subject.problemStatement)}, ${strip("problemStatement")}) AS s_problem,
        similarity(${stripSubject(subject.proposedSolution)}, ${strip("proposedSolution")}) AS s_solution,
        similarity(${stripSubject(subject.innovation)}, ${strip("innovation")}) AS s_innovation
      FROM "applications" o
      LEFT JOIN "teams" t ON t."applicationId" = o."id" AND t."deletedAt" IS NULL
      WHERE o."id" <> ${applicationId}
        AND o."deletedAt" IS NULL
        AND o."challengeYear" = ${subject.challengeYear}
        AND o."status" <> ${ApplicationStatus.WITHDRAWN}::"ApplicationStatus"
        AND o."status" <> ${ApplicationStatus.DRAFT}::"ApplicationStatus"
    )
    SELECT
      "id",
      "referenceNumber",
      "projectTitle",
      "teamName",
      GREATEST(s_problem, s_solution, s_innovation)::float8 AS "similarity",
      CASE
        WHEN s_problem >= s_solution AND s_problem >= s_innovation THEN 'Problem statement'
        WHEN s_solution >= s_innovation THEN 'Proposed solution'
        ELSE 'Innovation'
      END AS "field"
    FROM scored
    WHERE GREATEST(s_problem, s_solution, s_innovation) >= ${threshold}
    ORDER BY "similarity" DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    applicationId: row.id,
    referenceNumber: row.referenceNumber,
    projectTitle: row.projectTitle,
    teamName: row.teamName,
    // Postgres returns real; round so the UI does not show 0.8300000190734863.
    similarity: Math.round(Number(row.similarity) * 100) / 100,
    field: row.field,
  }));
}
