import "server-only";

import { ApplicationStatus } from "@/generated/prisma/enums";
import type { DbTransactionClient } from "@/lib/db/prisma";
import { prisma } from "@/lib/db/prisma";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";

/**
 * Team membership as identity, rather than as text.
 *
 * A team leader types the roster from memory: student numbers, names, sections.
 * That is the only thing available at the moment they fill the form — nobody
 * else has signed in yet — so `TeamMember.studentId` is free text, and the
 * "one student, one team" rule can only compare typed strings. A transposed
 * digit defeats it, and the database cannot help because there is no identity
 * to constrain.
 *
 * This module closes that gap without adding an invitation flow. When a student
 * signs in and records their student number, any roster line carrying that
 * number is claimed by their account. From then on the rule has something real
 * to enforce against, and the student can see the entry they are named on.
 */

/**
 * Attaches a signed-in student to any roster lines bearing their student
 * number.
 *
 * Runs inside the caller's transaction so that claiming cannot half-succeed
 * against a profile write that then rolls back.
 *
 * Deliberately not restricted to the current challenge year: a roster line from
 * an earlier cycle belongs to the same person, and linking it costs nothing
 * while making the historical record correct. The year-scoped rule is applied
 * where it matters, in {@link findMembershipConflicts}.
 */
export async function claimTeamMemberships(
  tx: DbTransactionClient,
  userId: string,
  studentId: string,
): Promise<number> {
  const result = await tx.teamMember.updateMany({
    where: {
      studentId,
      deletedAt: null,
      // Never steal a line another account has already claimed. If two
      // accounts genuinely carry the same student number that is a data
      // problem for the challenge office, not something to resolve silently by
      // whoever signed in last.
      userId: null,
    },
    data: { userId },
  });

  return result.count;
}

/**
 * The applications a student appears on as a member rather than as the owner.
 *
 * This is what makes a claimed link visible to the person who claimed it: until
 * now a team member could not see the entry they were named on at all, because
 * every read path was scoped to `ownerId`.
 */
export async function getMemberApplications(
  userId: string,
  challengeYear: number,
): Promise<
  Array<{
    applicationId: string;
    referenceNumber: string | null;
    projectTitle: string | null;
    teamName: string;
    status: ApplicationStatus;
    leaderName: string;
    role: string | null;
  }>
> {
  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      deletedAt: null,
      isLeader: false,
      team: {
        deletedAt: null,
        application: { challengeYear, deletedAt: null },
      },
    },
    select: {
      role: true,
      team: {
        select: {
          name: true,
          leaderName: true,
          application: {
            select: {
              id: true,
              referenceNumber: true,
              projectTitle: true,
              status: true,
            },
          },
        },
      },
    },
  });

  return memberships.map((membership) => ({
    applicationId: membership.team.application.id,
    referenceNumber: membership.team.application.referenceNumber,
    projectTitle: membership.team.application.projectTitle,
    teamName: membership.team.name,
    status: membership.team.application.status,
    leaderName: membership.team.leaderName,
    role: membership.role,
  }));
}

export interface MembershipConflict {
  studentId: string;
  teamName: string;
  /** True when the clash was found by account rather than by typed number. */
  byIdentity: boolean;
}

/**
 * Finds roster entries who are already on another live team this cycle.
 *
 * Checks both ways round, and the difference matters:
 *
 *   by student number — catches the common case, and is all that was possible
 *                       before accounts were linked.
 *   by claimed account — catches the case the number misses. Two roster lines
 *                        can carry "25530061" and "2553O061" and look like
 *                        different students; once both are claimed by the same
 *                        account they are provably the same person.
 *
 * Returns conflicts rather than throwing so the caller can attach them to the
 * right form fields.
 */
export async function findMembershipConflicts(
  tx: DbTransactionClient,
  input: {
    applicationId: string;
    challengeYear: number;
    studentIds: string[];
  },
): Promise<MembershipConflict[]> {
  const otherLiveTeams = {
    deletedAt: null,
    team: {
      deletedAt: null,
      applicationId: { not: input.applicationId },
      application: {
        challengeYear: input.challengeYear,
        deletedAt: null,
        status: { not: ApplicationStatus.WITHDRAWN },
      },
    },
  };

  // Which accounts do the typed numbers resolve to? Only claimed lines and
  // registered profiles can answer, which is why both are consulted.
  const [byNumber, identities] = await Promise.all([
    tx.teamMember.findMany({
      where: { ...otherLiveTeams, studentId: { in: input.studentIds } },
      select: { studentId: true, team: { select: { name: true } } },
    }),
    tx.studentProfile.findMany({
      where: { studentId: { in: input.studentIds } },
      select: { userId: true, studentId: true },
    }),
  ]);

  const conflicts: MembershipConflict[] = byNumber.map((row) => ({
    studentId: row.studentId,
    teamName: row.team.name,
    byIdentity: false,
  }));

  if (identities.length > 0) {
    const byAccount = await tx.teamMember.findMany({
      where: {
        ...otherLiveTeams,
        userId: { in: identities.map((identity) => identity.userId) },
      },
      select: { userId: true, team: { select: { name: true } } },
    });

    const studentIdByUser = new Map(
      identities.map((identity) => [identity.userId, identity.studentId]),
    );

    for (const row of byAccount) {
      if (!row.userId) continue;
      const studentId = studentIdByUser.get(row.userId);
      if (!studentId) continue;

      // Already reported by number; no need to say it twice.
      if (conflicts.some((conflict) => conflict.studentId === studentId)) continue;

      conflicts.push({ studentId, teamName: row.team.name, byIdentity: true });
    }
  }

  return conflicts;
}

/**
 * Convenience wrapper for the sign-in and onboarding paths, which claim outside
 * an existing transaction.
 */
export async function claimMembershipsForUser(
  userId: string,
  studentId: string,
  actorEmail: string,
): Promise<number> {
  const claimed = await prisma.$transaction((tx) => claimTeamMemberships(tx, userId, studentId));

  if (claimed > 0) {
    await recordAudit({
      action: AUDIT_ACTIONS.teamMembershipClaimed,
      entityType: "TeamMember",
      actorId: userId,
      actorEmail,
      metadata: { studentId, claimed },
    });
  }

  return claimed;
}
