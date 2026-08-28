import "server-only";

import { cache } from "react";

import { ApplicationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { getAppSettings } from "@/services/settings/settings-service";

/**
 * The challenge as a series of cycles rather than a single current one.
 *
 * `challengeYear` has been a column and a setting since the beginning, and
 * `getAdminStatistics` already takes one — but every screen passed
 * `settings["challenge.year"]` and nothing else, so the moment the office rolled
 * the setting forward the previous cohort became unreachable through the UI.
 * The data was never lost; there was simply no way to ask for it.
 */

export interface CohortSummary {
  challengeYear: number;
  total: number;
  submitted: number;
  approved: number;
  /** Submitted as a share of all entries started, 0..100. */
  completionRate: number;
  /** True for the cycle new applications are currently filed against. */
  isCurrent: boolean;
}

/**
 * Every cycle that has an application against it, newest first.
 *
 * The current year from settings is always included even when nothing has been
 * filed against it yet — otherwise the office rolls the year forward and the
 * switcher does not offer the cycle they just opened.
 */
export const listCohorts = cache(async (): Promise<CohortSummary[]> => {
  const settings = await getAppSettings();
  const currentYear = settings["challenge.year"];

  const groups = await prisma.application.groupBy({
    by: ["challengeYear", "status"],
    where: { deletedAt: null },
    _count: { _all: true },
  });

  const years = new Map<number, { total: number; submitted: number; approved: number }>();
  years.set(currentYear, { total: 0, submitted: 0, approved: 0 });

  for (const group of groups) {
    const entry = years.get(group.challengeYear) ?? { total: 0, submitted: 0, approved: 0 };
    const count = group._count._all;

    entry.total += count;

    // "Submitted" means it reached the panel at some point — a rejected entry
    // was still submitted, and counting only the SUBMITTED status would make
    // completion look worse the further a cohort progressed.
    if (group.status !== ApplicationStatus.DRAFT) entry.submitted += count;
    if (group.status === ApplicationStatus.APPROVED) entry.approved += count;

    years.set(group.challengeYear, entry);
  }

  return [...years.entries()]
    .map(([challengeYear, entry]) => ({
      challengeYear,
      total: entry.total,
      submitted: entry.submitted,
      approved: entry.approved,
      completionRate:
        entry.total > 0 ? Math.round((entry.submitted / entry.total) * 1000) / 10 : 0,
      isCurrent: challengeYear === currentYear,
    }))
    .sort((a, b) => b.challengeYear - a.challengeYear);
});

/**
 * Resolves a year from a query string against the cycles that actually exist.
 *
 * A `?year=` nobody has filed against would render an empty dashboard that
 * looks like data loss rather than a typo, so an unrecognised value falls back
 * to the current cycle.
 */
export async function resolveCohortYear(requested: string | undefined): Promise<number> {
  const settings = await getAppSettings();
  const fallback = settings["challenge.year"];

  if (!requested) return fallback;

  const parsed = Number.parseInt(requested, 10);
  if (!Number.isInteger(parsed)) return fallback;

  const cohorts = await listCohorts();
  return cohorts.some((cohort) => cohort.challengeYear === parsed) ? parsed : fallback;
}

export interface CohortComparison {
  current: CohortSummary;
  previous: CohortSummary | null;
  /** Percentage-point and absolute deltas against the previous cycle. */
  delta: {
    total: number;
    submitted: number;
    approved: number;
    completionRate: number;
  } | null;
}

/**
 * One cycle against the one before it.
 *
 * "The one before it" is the next cohort down the list, not `year - 1`: a
 * challenge that skipped a year should compare against the cycle that actually
 * ran, and subtracting one would silently compare against nothing.
 */
export async function compareCohorts(challengeYear: number): Promise<CohortComparison | null> {
  const cohorts = await listCohorts();
  const index = cohorts.findIndex((cohort) => cohort.challengeYear === challengeYear);

  if (index === -1) return null;

  const current = cohorts[index];
  const previous = cohorts[index + 1] ?? null;

  return {
    current,
    previous,
    delta: previous
      ? {
          total: current.total - previous.total,
          submitted: current.submitted - previous.submitted,
          approved: current.approved - previous.approved,
          completionRate:
            Math.round((current.completionRate - previous.completionRate) * 10) / 10,
        }
      : null,
  };
}
