import "server-only";

import { ReviewAssignmentStatus, Role } from "@/generated/prisma/enums";
import { DEFAULT_RUBRIC } from "@/domain/review/default-rubric";
import {
  isValidScore,
  isScorecardComplete,
  rankEntries,
  summariseScores,
  type ApplicationScore,
  type Criterion,
  type Scorecard,
} from "@/domain/review/rubric";
import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError, conflict, forbidden, invalidState, notFound } from "@/lib/errors";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { getAppSettings } from "@/services/settings/settings-service";

/**
 * The review panel: who marks what, and what the marks add up to.
 *
 * Everything here is advisory by design. Nothing in this module changes an
 * application's status, and `recordDecision` does not consult it. A panel can
 * approve an entry that nobody scored, and can reject one that scored highest —
 * because the decision belongs to people, and a system that quietly made the
 * arithmetic binding would be making it for them.
 */

// ---------------------------------------------------------------------------
// The rubric
// ---------------------------------------------------------------------------

/**
 * The active rubric for a cycle, creating it from the template the first time
 * a year is scored.
 *
 * Lazily rather than at seed time: the challenge year is a runtime setting an
 * administrator can roll forward whenever they like, and a new year should not
 * need a deploy or a seed run before the panel can start work.
 */
export async function getRubric(challengeYear: number): Promise<Criterion[]> {
  const existing = await prisma.reviewCriterion.findMany({
    where: { challengeYear, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  if (existing.length > 0) return existing.map(toCriterion);

  // `createMany` with `skipDuplicates` rather than a transaction: two reviewers
  // opening the first entry of a new cycle at the same moment would otherwise
  // race, and the unique index on (challengeYear, code) is what settles it.
  await prisma.reviewCriterion.createMany({
    data: DEFAULT_RUBRIC.map((entry) => ({ ...entry, challengeYear })),
    skipDuplicates: true,
  });

  const created = await prisma.reviewCriterion.findMany({
    where: { challengeYear, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  return created.map(toCriterion);
}

function toCriterion(record: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  maxValue: number;
  sortOrder: number;
}): Criterion {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    weight: record.weight,
    maxValue: record.maxValue,
    sortOrder: record.sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

function assertReviewer(user: SessionUser) {
  if (user.role !== Role.ADMIN && user.role !== Role.REVIEWER) {
    throw forbidden("This is restricted to the review panel.");
  }
}

function assertAdmin(user: SessionUser) {
  if (user.role !== Role.ADMIN) {
    throw forbidden("Allocating review work is restricted to administrators.");
  }
}

/**
 * Allocates one application to one reviewer.
 *
 * Idempotent on the live allocation: re-assigning somebody who already holds
 * the entry returns what they have rather than failing, because the obvious
 * administrator action — dragging a name onto an entry twice — should not be an
 * error.
 */
export async function assignReviewer(
  actor: SessionUser,
  applicationId: string,
  reviewerId: string,
): Promise<{ assignmentId: string; created: boolean }> {
  assertAdmin(actor);

  const [application, reviewer] = await Promise.all([
    prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: { id: true, ownerId: true },
    }),
    prisma.user.findFirst({
      where: { id: reviewerId, deletedAt: null, isActive: true },
      select: { id: true, role: true, name: true },
    }),
  ]);

  if (!application) throw notFound("That application no longer exists.");
  if (!reviewer) throw notFound("That reviewer no longer has an active account.");

  if (reviewer.role !== Role.ADMIN && reviewer.role !== Role.REVIEWER) {
    throw invalidState(`${reviewer.name} is not on the review panel.`);
  }

  // A reviewer cannot mark their own entry. Staff do not normally own
  // applications, but the role can be granted to someone who already had one.
  if (application.ownerId === reviewerId) {
    throw invalidState("A reviewer cannot be allocated their own application.");
  }

  const existing = await prisma.reviewAssignment.findFirst({
    where: { applicationId, reviewerId, deletedAt: null },
    select: { id: true },
  });

  if (existing) return { assignmentId: existing.id, created: false };

  const assignment = await prisma.reviewAssignment.create({
    data: { applicationId, reviewerId, assignedById: actor.id },
    select: { id: true },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.reviewAssigned,
    entityType: "ReviewAssignment",
    entityId: assignment.id,
    actorId: actor.id,
    actorEmail: actor.email,
    metadata: { applicationId, reviewerId, reviewerName: reviewer.name },
  });

  return { assignmentId: assignment.id, created: true };
}

/**
 * Withdraws an allocation.
 *
 * Soft, like everything else here: a committed scorecard that is withdrawn must
 * still be reconstructable, because it may have influenced a decision that has
 * already been communicated to a team.
 */
export async function unassignReviewer(
  actor: SessionUser,
  assignmentId: string,
): Promise<void> {
  assertAdmin(actor);

  const assignment = await prisma.reviewAssignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
    select: { id: true, applicationId: true, reviewerId: true, status: true },
  });

  if (!assignment) throw notFound("That allocation no longer exists.");

  await prisma.reviewAssignment.update({
    where: { id: assignmentId },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.reviewUnassigned,
    entityType: "ReviewAssignment",
    entityId: assignmentId,
    actorId: actor.id,
    actorEmail: actor.email,
    metadata: {
      applicationId: assignment.applicationId,
      reviewerId: assignment.reviewerId,
      statusAtWithdrawal: assignment.status,
    },
  });
}

/** Steps a reviewer away from an entry, with the reason on the record. */
export async function recuseFromReview(
  reviewer: SessionUser,
  assignmentId: string,
  reason: string,
): Promise<void> {
  assertReviewer(reviewer);

  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    throw new AppError("VALIDATION", "Say briefly why you are stepping away from this entry.", {
      fieldErrors: { reason: ["Give a short reason — it goes on the record."] },
    });
  }

  const assignment = await loadOwnAssignment(reviewer, assignmentId);

  await prisma.$transaction(async (tx) => {
    await tx.reviewAssignment.update({
      where: { id: assignmentId },
      data: {
        status: ReviewAssignmentStatus.RECUSED,
        recusedReason: trimmed,
        submittedAt: null,
      },
    });

    // The marks go with the recusal. A conflict of interest that produced a
    // scorecard is exactly the scorecard that must not count.
    await tx.score.deleteMany({ where: { assignmentId } });
  });

  await recordAudit({
    action: AUDIT_ACTIONS.reviewRecused,
    entityType: "ReviewAssignment",
    entityId: assignmentId,
    actorId: reviewer.id,
    actorEmail: reviewer.email,
    metadata: { applicationId: assignment.applicationId, reason: trimmed },
  });
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

async function loadOwnAssignment(reviewer: SessionUser, assignmentId: string) {
  const assignment = await prisma.reviewAssignment.findFirst({
    where: { id: assignmentId, deletedAt: null },
    select: { id: true, applicationId: true, reviewerId: true, status: true },
  });

  if (!assignment) throw notFound("That allocation no longer exists.");

  // An administrator may look, but marks belong to the reviewer who made them.
  if (assignment.reviewerId !== reviewer.id) {
    throw forbidden("You can only score entries allocated to you.");
  }

  return assignment;
}

export interface ScoreInput {
  criterionId: string;
  value: number;
  comment: string | null;
}

/**
 * Records a reviewer's marks without committing them.
 *
 * Called on every change, like the student wizard's autosave — a panel member
 * working through a long rubric must not lose their place, and the marks do not
 * count until {@link submitScorecard} anyway.
 */
export async function saveScores(
  reviewer: SessionUser,
  assignmentId: string,
  inputs: ScoreInput[],
): Promise<void> {
  assertReviewer(reviewer);
  const assignment = await loadOwnAssignment(reviewer, assignmentId);

  if (assignment.status === ReviewAssignmentStatus.RECUSED) {
    throw invalidState("You have stepped away from this entry.");
  }

  const settings = await getAppSettings();
  const criteria = await getRubric(settings["challenge.year"]);
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));

  for (const input of inputs) {
    const criterion = byId.get(input.criterionId);
    if (!criterion) {
      throw new AppError("VALIDATION", "That criterion is not on the current rubric.");
    }
    if (!isValidScore(input.value, criterion)) {
      throw new AppError(
        "VALIDATION",
        `"${criterion.name}" is marked out of ${criterion.maxValue}.`,
        { fieldErrors: { [input.criterionId]: [`Enter a whole number from 0 to ${criterion.maxValue}.`] } },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const input of inputs) {
      await tx.score.upsert({
        where: {
          assignmentId_criterionId: { assignmentId, criterionId: input.criterionId },
        },
        update: { value: input.value, comment: input.comment },
        create: {
          assignmentId,
          criterionId: input.criterionId,
          value: input.value,
          comment: input.comment,
        },
      });
    }

    // Picking up a card moves it out of PENDING, so the queue reflects work in
    // progress rather than only work finished.
    if (assignment.status === ReviewAssignmentStatus.PENDING) {
      await tx.reviewAssignment.update({
        where: { id: assignmentId },
        data: { status: ReviewAssignmentStatus.IN_PROGRESS },
      });
    }
  });
}

/**
 * Commits a scorecard, at which point it starts counting.
 *
 * The completeness check is the same domain function the reviewer's own screen
 * uses to enable the button, so the server is not enforcing a rule the client
 * never showed them.
 */
export async function submitScorecard(
  reviewer: SessionUser,
  assignmentId: string,
): Promise<ApplicationScore> {
  assertReviewer(reviewer);
  const assignment = await loadOwnAssignment(reviewer, assignmentId);

  if (assignment.status === ReviewAssignmentStatus.RECUSED) {
    throw invalidState("You have stepped away from this entry.");
  }

  const settings = await getAppSettings();
  const criteria = await getRubric(settings["challenge.year"]);

  const scores = await prisma.score.findMany({
    where: { assignmentId },
    select: { criterionId: true, value: true, comment: true },
  });

  if (!isScorecardComplete(criteria, scores)) {
    throw new AppError("VALIDATION", "Mark every line of the rubric before submitting.");
  }

  await prisma.reviewAssignment.update({
    where: { id: assignmentId },
    data: { status: ReviewAssignmentStatus.SUBMITTED, submittedAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.reviewScored,
    entityType: "ReviewAssignment",
    entityId: assignmentId,
    actorId: reviewer.id,
    actorEmail: reviewer.email,
    metadata: { applicationId: assignment.applicationId, criteriaCount: criteria.length },
  });

  return getApplicationScore(assignment.applicationId);
}

/** Reopens a committed card so the reviewer can change their mind. */
export async function reopenScorecard(
  reviewer: SessionUser,
  assignmentId: string,
): Promise<void> {
  assertReviewer(reviewer);
  const assignment = await loadOwnAssignment(reviewer, assignmentId);

  if (assignment.status !== ReviewAssignmentStatus.SUBMITTED) {
    throw invalidState("That scorecard has not been submitted.");
  }

  await prisma.reviewAssignment.update({
    where: { id: assignmentId },
    data: { status: ReviewAssignmentStatus.IN_PROGRESS, submittedAt: null },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.reviewReopened,
    entityType: "ReviewAssignment",
    entityId: assignmentId,
    actorId: reviewer.id,
    actorEmail: reviewer.email,
    metadata: { applicationId: assignment.applicationId },
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const cardSelect = {
  id: true,
  reviewerId: true,
  status: true,
  recusedReason: true,
  submittedAt: true,
  reviewer: { select: { name: true } },
  scores: { select: { criterionId: true, value: true, comment: true } },
} as const;

/** Every card on one application, plus what they add up to. */
export async function getApplicationScore(applicationId: string): Promise<ApplicationScore> {
  const settings = await getAppSettings();
  const [criteria, assignments] = await Promise.all([
    getRubric(settings["challenge.year"]),
    prisma.reviewAssignment.findMany({
      where: { applicationId, deletedAt: null },
      select: cardSelect,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return summariseScores(criteria, assignments.map(toScorecard));
}

function toScorecard(record: {
  id: string;
  reviewerId: string;
  status: ReviewAssignmentStatus;
  reviewer: { name: string };
  scores: Array<{ criterionId: string; value: number; comment: string | null }>;
}): Scorecard {
  return {
    assignmentId: record.id,
    reviewerId: record.reviewerId,
    reviewerName: record.reviewer.name,
    status: record.status,
    scores: record.scores,
  };
}

export interface ReviewPanelView {
  criteria: Criterion[];
  score: ApplicationScore;
  cards: Array<{
    assignmentId: string;
    reviewerId: string;
    reviewerName: string;
    status: ReviewAssignmentStatus;
    recusedReason: string | null;
    submittedAt: string | null;
    isMine: boolean;
    scores: Array<{ criterionId: string; value: number; comment: string | null }>;
  }>;
}

/**
 * Everything the review console needs for one application.
 *
 * A reviewer sees their own marks in full and other panel members' cards only
 * as committed totals — {@link summariseScores} carries the aggregate, while the
 * per-criterion detail of somebody else's draft stays out of the payload. Panel
 * members anchoring on each other's marks is the thing multiple reviewers exist
 * to prevent.
 */
export async function getReviewPanel(
  viewer: SessionUser,
  applicationId: string,
): Promise<ReviewPanelView> {
  assertReviewer(viewer);

  const settings = await getAppSettings();
  const [criteria, assignments] = await Promise.all([
    getRubric(settings["challenge.year"]),
    prisma.reviewAssignment.findMany({
      where: { applicationId, deletedAt: null },
      select: cardSelect,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    criteria,
    score: summariseScores(criteria, assignments.map(toScorecard)),
    cards: assignments.map((assignment) => {
      const isMine = assignment.reviewerId === viewer.id;
      return {
        assignmentId: assignment.id,
        reviewerId: assignment.reviewerId,
        reviewerName: assignment.reviewer.name,
        status: assignment.status,
        recusedReason: assignment.recusedReason,
        submittedAt: assignment.submittedAt?.toISOString() ?? null,
        isMine,
        // Only your own marks come down in detail. See the note above.
        scores: isMine ? assignment.scores : [],
      };
    }),
  };
}

export interface QueueEntry {
  assignmentId: string;
  applicationId: string;
  referenceNumber: string | null;
  projectTitle: string | null;
  teamName: string | null;
  status: ReviewAssignmentStatus;
  scoredCount: number;
  criterionCount: number;
  submittedAt: string | null;
}

/** The signed-in reviewer's own work list, unfinished first. */
export async function getMyReviewQueue(reviewer: SessionUser): Promise<QueueEntry[]> {
  assertReviewer(reviewer);

  const settings = await getAppSettings();
  const criteria = await getRubric(settings["challenge.year"]);

  const assignments = await prisma.reviewAssignment.findMany({
    where: {
      reviewerId: reviewer.id,
      deletedAt: null,
      application: { deletedAt: null, challengeYear: settings["challenge.year"] },
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      applicationId: true,
      _count: { select: { scores: true } },
      application: {
        select: {
          referenceNumber: true,
          projectTitle: true,
          team: { select: { name: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return assignments.map((assignment) => ({
    assignmentId: assignment.id,
    applicationId: assignment.applicationId,
    referenceNumber: assignment.application.referenceNumber,
    projectTitle: assignment.application.projectTitle,
    teamName: assignment.application.team?.name ?? null,
    status: assignment.status,
    scoredCount: assignment._count.scores,
    criterionCount: criteria.length,
    submittedAt: assignment.submittedAt?.toISOString() ?? null,
  }));
}

export interface LeaderboardRow {
  applicationId: string;
  rank: number | null;
  referenceNumber: string | null;
  projectTitle: string | null;
  teamName: string | null;
  percentage: number | null;
  countedCards: number;
  pendingCards: number;
  needsModeration: boolean;
}

/**
 * The cohort, ranked.
 *
 * Restricted to entries that have reached the panel: a draft has no business in
 * a ranking, and including it at a null score would put unfinished work in
 * front of reviewers as though it were a contender.
 */
export async function getLeaderboard(
  viewer: SessionUser,
  challengeYear?: number,
): Promise<LeaderboardRow[]> {
  assertReviewer(viewer);

  const settings = await getAppSettings();
  const year = challengeYear ?? settings["challenge.year"];
  const criteria = await getRubric(year);

  const applications = await prisma.application.findMany({
    where: {
      challengeYear: year,
      deletedAt: null,
      status: { in: ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED", "APPROVED", "REJECTED"] },
    },
    select: {
      id: true,
      referenceNumber: true,
      projectTitle: true,
      team: { select: { name: true } },
      assignments: { where: { deletedAt: null }, select: cardSelect },
    },
  });

  const scored = applications.map((application) => ({
    applicationId: application.id,
    score: summariseScores(criteria, application.assignments.map(toScorecard)),
  }));

  const byId = new Map(applications.map((application) => [application.id, application]));

  return rankEntries(scored).map((entry) => {
    const application = byId.get(entry.applicationId);
    return {
      applicationId: entry.applicationId,
      rank: entry.rank,
      referenceNumber: application?.referenceNumber ?? null,
      projectTitle: application?.projectTitle ?? null,
      teamName: application?.team?.name ?? null,
      percentage: entry.score.percentage,
      countedCards: entry.score.countedCards,
      pendingCards: entry.score.pendingCards,
      needsModeration: entry.score.needsModeration,
    };
  });
}

/** Panel members an administrator can allocate work to. */
export async function getPanelMembers(): Promise<Array<{ id: string; name: string; email: string; openCount: number }>> {
  const members = await prisma.user.findMany({
    where: { deletedAt: null, isActive: true, role: { in: [Role.ADMIN, Role.REVIEWER] } },
    select: {
      id: true,
      name: true,
      email: true,
      _count: {
        select: {
          reviewAssignments: {
            where: {
              deletedAt: null,
              status: { in: [ReviewAssignmentStatus.PENDING, ReviewAssignmentStatus.IN_PROGRESS] },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return members.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    openCount: member._count.reviewAssignments,
  }));
}

/**
 * Spreads unallocated entries across the panel, lightest workload first.
 *
 * Exists because the alternative — an administrator allocating two hundred
 * entries by hand — is the step at which a panel workflow stops being used.
 */
export async function autoAssign(
  actor: SessionUser,
  options: { reviewersPerApplication: number; challengeYear?: number },
): Promise<{ created: number; skipped: number }> {
  assertAdmin(actor);

  const perApplication = Math.max(1, Math.min(5, options.reviewersPerApplication));
  const settings = await getAppSettings();
  const year = options.challengeYear ?? settings["challenge.year"];

  const [panel, applications] = await Promise.all([
    getPanelMembers(),
    prisma.application.findMany({
      where: {
        challengeYear: year,
        deletedAt: null,
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      },
      select: {
        id: true,
        ownerId: true,
        assignments: { where: { deletedAt: null }, select: { reviewerId: true } },
      },
      orderBy: { submittedAt: "asc" },
    }),
  ]);

  if (panel.length === 0) {
    throw conflict("There are no active reviewers to allocate work to.");
  }

  // Running load, seeded from what each member already holds so a second run
  // tops up rather than piling everything onto whoever was idle first.
  const load = new Map(panel.map((member) => [member.id, member.openCount]));

  let created = 0;
  let skipped = 0;

  for (const application of applications) {
    const held = new Set(application.assignments.map((a) => a.reviewerId));
    const needed = perApplication - held.size;

    if (needed <= 0) {
      skipped += 1;
      continue;
    }

    const candidates = panel
      .filter((member) => !held.has(member.id) && member.id !== application.ownerId)
      .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0))
      .slice(0, needed);

    for (const candidate of candidates) {
      await prisma.reviewAssignment.create({
        data: {
          applicationId: application.id,
          reviewerId: candidate.id,
          assignedById: actor.id,
        },
      });
      load.set(candidate.id, (load.get(candidate.id) ?? 0) + 1);
      created += 1;
    }
  }

  await recordAudit({
    action: AUDIT_ACTIONS.reviewAutoAssigned,
    entityType: "Application",
    actorId: actor.id,
    actorEmail: actor.email,
    metadata: { challengeYear: year, perApplication, created, skipped },
  });

  return { created, skipped };
}
