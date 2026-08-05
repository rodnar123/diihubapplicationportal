import "server-only";

import { cache } from "react";

import { ApplicationStatus } from "@/generated/prisma/enums";
import { YEAR_LEVEL_LABELS } from "@/domain/challenge/constants";
import { prisma } from "@/lib/db/prisma";

/**
 * Dashboard aggregates.
 *
 * All counting happens in Postgres via `groupBy`; the service only maps the
 * results onto display labels. That keeps the dashboard's cost flat as the
 * number of entries grows.
 */

export interface StatusCount {
  status: ApplicationStatus;
  count: number;
}

export interface CategoryCount {
  key: string;
  label: string;
  count: number;
}

export interface AdminStatistics {
  challengeYear: number;
  total: number;
  byStatus: StatusCount[];
  drafts: number;
  submitted: number;
  underReview: number;
  revisionRequested: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  /** Submitted + under review + revision requested — the reviewer's queue. */
  pendingReview: number;
  bySchool: CategoryCount[];
  bySection: CategoryCount[];
  byYearLevel: CategoryCount[];
  byTheme: CategoryCount[];
  submissionsByDay: Array<{ date: string; count: number }>;
  totalParticipants: number;
  recent: Array<{
    id: string;
    referenceNumber: string | null;
    projectTitle: string | null;
    teamName: string | null;
    status: ApplicationStatus;
    submittedAt: string | null;
    applicantName: string;
  }>;
}

const ZERO_STATUS: Record<ApplicationStatus, number> = {
  DRAFT: 0,
  SUBMITTED: 0,
  UNDER_REVIEW: 0,
  REVISION_REQUESTED: 0,
  APPROVED: 0,
  REJECTED: 0,
  WITHDRAWN: 0,
};

export const getAdminStatistics = cache(
  async (challengeYear: number): Promise<AdminStatistics> => {
    const where = { deletedAt: null, challengeYear };

    const [
      statusGroups,
      schoolGroups,
      sectionGroups,
      yearGroups,
      themeGroups,
      schools,
      sections,
      recent,
      participantCount,
      submittedRecords,
    ] = await Promise.all([
      prisma.application.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.application.groupBy({ by: ["schoolId"], where, _count: { _all: true } }),
      prisma.application.groupBy({ by: ["sectionId"], where, _count: { _all: true } }),
      prisma.application.groupBy({ by: ["yearLevel"], where, _count: { _all: true } }),
      prisma.application.groupBy({ by: ["theme"], where, _count: { _all: true } }),
      prisma.school.findMany({ select: { id: true, name: true } }),
      prisma.section.findMany({ select: { id: true, name: true } }),
      prisma.application.findMany({
        where: { ...where, submittedAt: { not: null } },
        orderBy: { submittedAt: "desc" },
        take: 8,
        select: {
          id: true,
          referenceNumber: true,
          projectTitle: true,
          status: true,
          submittedAt: true,
          team: { select: { name: true } },
          owner: { select: { name: true } },
        },
      }),
      prisma.teamMember.count({
        where: {
          deletedAt: null,
          team: { deletedAt: null, application: { ...where } },
        },
      }),
      prisma.application.findMany({
        where: { ...where, submittedAt: { not: null } },
        select: { submittedAt: true },
        orderBy: { submittedAt: "asc" },
      }),
    ]);

    const schoolNames = new Map(schools.map((school) => [school.id, school.name]));
    const sectionNames = new Map(sections.map((section) => [section.id, section.name]));

    const byStatusMap = { ...ZERO_STATUS };
    for (const group of statusGroups) {
      byStatusMap[group.status] = group._count._all;
    }

    const toCategories = (
      groups: Array<{ _count: { _all: number } } & Record<string, unknown>>,
      key: string,
      resolve: (value: string) => string,
    ): CategoryCount[] =>
      groups
        .map((group) => {
          const raw = group[key];
          const id = typeof raw === "string" ? raw : null;
          return {
            key: id ?? "unassigned",
            label: id ? resolve(id) : "Not specified",
            count: group._count._all,
          };
        })
        .sort((a, b) => b.count - a.count);

    // Daily submission counts, used for the trend line.
    const dayCounts = new Map<string, number>();
    for (const record of submittedRecords) {
      if (!record.submittedAt) continue;
      const day = record.submittedAt.toISOString().slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }

    const total = Object.values(byStatusMap).reduce((sum, count) => sum + count, 0);

    return {
      challengeYear,
      total,
      byStatus: (Object.entries(byStatusMap) as Array<[ApplicationStatus, number]>).map(
        ([status, count]) => ({ status, count }),
      ),
      drafts: byStatusMap.DRAFT,
      submitted: byStatusMap.SUBMITTED,
      underReview: byStatusMap.UNDER_REVIEW,
      revisionRequested: byStatusMap.REVISION_REQUESTED,
      approved: byStatusMap.APPROVED,
      rejected: byStatusMap.REJECTED,
      withdrawn: byStatusMap.WITHDRAWN,
      pendingReview:
        byStatusMap.SUBMITTED + byStatusMap.UNDER_REVIEW + byStatusMap.REVISION_REQUESTED,
      bySchool: toCategories(schoolGroups, "schoolId", (id) => schoolNames.get(id) ?? "Unknown"),
      bySection: toCategories(sectionGroups, "sectionId", (id) => sectionNames.get(id) ?? "Unknown")
        .slice(0, 10),
      byYearLevel: toCategories(yearGroups, "yearLevel", (value) => {
        const label = YEAR_LEVEL_LABELS[value as keyof typeof YEAR_LEVEL_LABELS];
        return label ?? value;
      }),
      byTheme: toCategories(themeGroups, "theme", (value) => value).slice(0, 8),
      submissionsByDay: [...dayCounts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      totalParticipants: participantCount,
      recent: recent.map((record) => ({
        id: record.id,
        referenceNumber: record.referenceNumber,
        projectTitle: record.projectTitle,
        teamName: record.team?.name ?? null,
        status: record.status,
        submittedAt: record.submittedAt?.toISOString() ?? null,
        applicantName: record.owner.name,
      })),
    };
  },
);
