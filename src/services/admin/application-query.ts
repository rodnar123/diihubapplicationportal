import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationStatus, YearLevel } from "@/generated/prisma/enums";
import type { ApplicationQuery } from "@/domain/admin/application-query";
import { prisma } from "@/lib/db/prisma";

/**
 * The admin list query.
 *
 * Filtering, sorting and paging all happen in Postgres. Pulling every
 * application into the app and filtering in JavaScript would work for one
 * cohort and fall over for five, and it would make the CSV export a different
 * code path from the screen it claims to mirror — so both use this.
 */

export interface AdminApplicationRow {
  id: string;
  referenceNumber: string | null;
  status: ApplicationStatus;
  challengeYear: number;
  projectTitle: string | null;
  theme: string | null;
  teamName: string | null;
  memberCount: number;
  attachmentCount: number;
  commentCount: number;
  applicantName: string;
  applicantEmail: string;
  applicantStudentId: string | null;
  schoolName: string | null;
  sectionName: string | null;
  yearLevel: YearLevel | null;
  submittedAt: string | null;
  updatedAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
  /** Non-null only in the recycle bin; the table offers restore instead of delete. */
  deletedAt: string | null;
}

export interface AdminApplicationPage {
  rows: AdminApplicationRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Builds the `where` clause. Exported so the CSV/PDF exports apply exactly the
 * same filter the reviewer is looking at.
 */
export function buildApplicationWhere(query: ApplicationQuery): Prisma.ApplicationWhereInput {
  // The recycle bin is the complement of the live set, never a superset of it:
  // a deleted entry must not turn up in the normal list, and the live list must
  // not appear in the bin.
  const where: Prisma.ApplicationWhereInput = {
    deletedAt: query.deleted ? { not: null } : null,
  };
  const and: Prisma.ApplicationWhereInput[] = [];

  if (query.challengeYear) {
    and.push({ challengeYear: query.challengeYear });
  }

  if (query.status.length > 0) {
    and.push({ status: { in: query.status } });
  }

  if (query.year.length > 0) {
    and.push({ yearLevel: { in: query.year } });
  }

  if (query.school) and.push({ schoolId: query.school });
  if (query.section) and.push({ sectionId: query.section });

  if (query.from || query.to) {
    const submittedAt: Prisma.DateTimeNullableFilter = {};
    if (query.from) submittedAt.gte = new Date(`${query.from}T00:00:00.000Z`);
    // `to` is inclusive of the whole day the reviewer picked.
    if (query.to) submittedAt.lte = new Date(`${query.to}T23:59:59.999Z`);
    and.push({ submittedAt });
  }

  if (query.q) and.push(applicationSearchFilter(query.q));

  if (and.length > 0) where.AND = and;
  return where;
}

/**
 * The fields a free-text search looks at.
 *
 * Extracted so the review console's search box and the command palette ask the
 * same question — a reviewer who finds an entry by student ID in one and not
 * the other would reasonably conclude the entry had gone missing.
 */
export function applicationSearchFilter(term: string): Prisma.ApplicationWhereInput {
  return {
    OR: [
      { referenceNumber: { contains: term, mode: "insensitive" } },
      { projectTitle: { contains: term, mode: "insensitive" } },
      { theme: { contains: term, mode: "insensitive" } },
      { team: { name: { contains: term, mode: "insensitive" } } },
      { team: { leaderName: { contains: term, mode: "insensitive" } } },
      { team: { leaderStudentId: { contains: term, mode: "insensitive" } } },
      { team: { members: { some: { studentId: { contains: term, mode: "insensitive" } } } } },
      { owner: { name: { contains: term, mode: "insensitive" } } },
      { owner: { email: { contains: term, mode: "insensitive" } } },
      {
        owner: {
          studentProfile: { studentId: { contains: term, mode: "insensitive" } },
        },
      },
    ],
  };
}

export interface ApplicationSearchHit {
  id: string;
  referenceNumber: string | null;
  projectTitle: string | null;
  teamName: string | null;
  applicantName: string;
  status: ApplicationStatus;
}

/**
 * A handful of best matches for the command palette.
 *
 * Deliberately not `findApplications`: the palette wants a short list and a
 * few columns, not a page of full rows with counts attached. Ordered by most
 * recently touched, because the entry a reviewer is hunting for is usually one
 * that moved lately.
 */
export async function searchApplicationsQuick(
  term: string,
  take = 6,
): Promise<ApplicationSearchHit[]> {
  const rows = await prisma.application.findMany({
    where: { deletedAt: null, AND: [applicationSearchFilter(term)] },
    orderBy: [{ updatedAt: "desc" }],
    take,
    select: {
      id: true,
      referenceNumber: true,
      projectTitle: true,
      status: true,
      team: { select: { name: true } },
      owner: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    referenceNumber: row.referenceNumber,
    projectTitle: row.projectTitle,
    teamName: row.team?.name ?? null,
    applicantName: row.owner.name ?? row.owner.email,
    status: row.status,
  }));
}

function buildOrderBy(query: ApplicationQuery): Prisma.ApplicationOrderByWithRelationInput[] {
  const direction = query.dir;

  switch (query.sort) {
    case "teamName":
      return [{ team: { name: direction } }, { createdAt: "desc" }];
    case "projectTitle":
      return [{ projectTitle: direction }, { createdAt: "desc" }];
    case "status":
      return [{ status: direction }, { submittedAt: "desc" }];
    case "referenceNumber":
      return [{ referenceNumber: direction }, { createdAt: "desc" }];
    case "createdAt":
      return [{ createdAt: direction }];
    case "updatedAt":
      return [{ updatedAt: direction }];
    case "submittedAt":
    default:
      // Nulls (drafts) sort last regardless of direction, so the reviewer's
      // working set is never buried under unsubmitted entries.
      return [{ submittedAt: { sort: direction, nulls: "last" } }, { createdAt: "desc" }];
  }
}

const listSelect = {
  id: true,
  referenceNumber: true,
  status: true,
  challengeYear: true,
  projectTitle: true,
  theme: true,
  yearLevel: true,
  submittedAt: true,
  updatedAt: true,
  reviewedAt: true,
  deletedAt: true,
  school: { select: { name: true } },
  section: { select: { name: true } },
  reviewedBy: { select: { name: true } },
  owner: {
    select: {
      name: true,
      email: true,
      studentProfile: { select: { studentId: true } },
    },
  },
  team: {
    select: {
      name: true,
      _count: { select: { members: { where: { deletedAt: null } } } },
    },
  },
  _count: {
    select: {
      attachments: { where: { deletedAt: null } },
      comments: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.ApplicationSelect;

type ListRecord = Prisma.ApplicationGetPayload<{ select: typeof listSelect }>;

function toRow(record: ListRecord): AdminApplicationRow {
  return {
    id: record.id,
    referenceNumber: record.referenceNumber,
    status: record.status,
    challengeYear: record.challengeYear,
    projectTitle: record.projectTitle,
    theme: record.theme,
    teamName: record.team?.name ?? null,
    memberCount: record.team?._count.members ?? 0,
    attachmentCount: record._count.attachments,
    commentCount: record._count.comments,
    applicantName: record.owner.name,
    applicantEmail: record.owner.email,
    applicantStudentId: record.owner.studentProfile?.studentId ?? null,
    schoolName: record.school?.name ?? null,
    sectionName: record.section?.name ?? null,
    yearLevel: record.yearLevel,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewerName: record.reviewedBy?.name ?? null,
    deletedAt: record.deletedAt?.toISOString() ?? null,
  };
}

export async function findApplications(query: ApplicationQuery): Promise<AdminApplicationPage> {
  const where = buildApplicationWhere(query);
  const pageSize = query.size;

  const total = await prisma.application.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // A filter change can leave the reviewer past the end of the new result set.
  const page = Math.min(query.page, pageCount);

  const records = await prisma.application.findMany({
    where,
    select: listSelect,
    orderBy: buildOrderBy(query),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    rows: records.map(toRow),
    total,
    page,
    pageSize,
    pageCount,
  };
}

/**
 * Every matching application, unpaged — for CSV and bulk PDF export. Capped so
 * an unfiltered export cannot exhaust memory.
 */
export async function findApplicationsForExport(
  query: ApplicationQuery,
  limit = 1000,
): Promise<{ ids: string[]; truncated: boolean }> {
  const where = buildApplicationWhere(query);

  const records = await prisma.application.findMany({
    where,
    select: { id: true },
    orderBy: buildOrderBy(query),
    take: limit + 1,
  });

  return {
    ids: records.slice(0, limit).map((record) => record.id),
    truncated: records.length > limit,
  };
}
