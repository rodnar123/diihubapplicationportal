"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseOrThrow, runAction } from "@/lib/action-helpers";
import { requireAdminForAction, requireReviewerForAction } from "@/lib/auth/session";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { ROUTES } from "@/lib/routes";
import { sanitizePlainText } from "@/lib/sanitize.server";
import {
  assignReviewer,
  autoAssign,
  recuseFromReview,
  reopenScorecard,
  saveScores,
  submitScorecard,
  unassignReviewer,
} from "@/services/admin/scoring-service";

/**
 * Server Actions for the review panel.
 *
 * Split from `actions.ts` because the authority is different: everything in
 * there is about an application's *status*, and everything here is about the
 * marks behind it. The two never call each other — scoring is advisory, and
 * `recordDecision` deliberately does not consult it.
 */

const idSchema = z.string().trim().min(1).max(40);

function revalidateReview(applicationId?: string) {
  revalidatePath(ROUTES.adminReviewQueue);
  revalidatePath(ROUTES.adminLeaderboard);
  if (applicationId) revalidatePath(ROUTES.adminApplication(applicationId));
}

// ---------------------------------------------------------------------------
// Allocation — administrators only
// ---------------------------------------------------------------------------

export async function assignReviewerAction(input: {
  applicationId: string;
  reviewerId: string;
}) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    enforceRateLimit(`assign:${admin.id}`, RATE_LIMITS.adminDestructive);

    const applicationId = parseOrThrow(idSchema, input.applicationId);
    const reviewerId = parseOrThrow(idSchema, input.reviewerId);

    const result = await assignReviewer(admin, applicationId, reviewerId);

    revalidateReview(applicationId);
    return result;
  });
}

export async function unassignReviewerAction(input: { assignmentId: string }) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    enforceRateLimit(`unassign:${admin.id}`, RATE_LIMITS.adminDestructive);

    await unassignReviewer(admin, parseOrThrow(idSchema, input.assignmentId));

    revalidateReview();
  });
}

const autoAssignSchema = z.object({
  reviewersPerApplication: z.number().int().min(1).max(5),
  challengeYear: z.number().int().min(2000).max(2100).optional(),
});

export async function autoAssignAction(input: unknown) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    // A bulk allocation touches every unassigned entry in the cycle, so it is
    // budgeted like the other destructive administration rather than like a
    // read.
    enforceRateLimit(`auto-assign:${admin.id}`, RATE_LIMITS.adminDestructive);

    const options = parseOrThrow(autoAssignSchema, input);
    const result = await autoAssign(admin, options);

    revalidateReview();
    return result;
  });
}

// ---------------------------------------------------------------------------
// Scoring — the reviewer who holds the allocation
// ---------------------------------------------------------------------------

const scoreInputSchema = z.object({
  criterionId: idSchema,
  // Bounds are per-criterion and checked in the service against the live
  // rubric; this is only the outer sanity limit.
  value: z.number().int().min(0).max(100),
  comment: z.string().trim().max(1000).nullable().optional(),
});

const saveScoresSchema = z.object({
  assignmentId: idSchema,
  scores: z.array(scoreInputSchema).min(1).max(50),
});

export async function saveScoresAction(input: unknown) {
  return runAction(async () => {
    const reviewer = await requireReviewerForAction();
    // Called on a debounce as the reviewer works through the rubric, so this
    // is the draft-save budget rather than the deliberate-action one.
    enforceRateLimit(`score-save:${reviewer.id}`, RATE_LIMITS.draftSave);

    const { assignmentId, scores } = parseOrThrow(saveScoresSchema, input);

    await saveScores(
      reviewer,
      assignmentId,
      scores.map((score) => ({
        criterionId: score.criterionId,
        value: score.value,
        comment: sanitizePlainText(score.comment ?? null),
      })),
    );
  });
}

export async function submitScorecardAction(input: { assignmentId: string }) {
  return runAction(async () => {
    const reviewer = await requireReviewerForAction();
    enforceRateLimit(`score-submit:${reviewer.id}`, RATE_LIMITS.comment);

    const score = await submitScorecard(
      reviewer,
      parseOrThrow(idSchema, input.assignmentId),
    );

    revalidateReview();
    return score;
  });
}

export async function reopenScorecardAction(input: { assignmentId: string }) {
  return runAction(async () => {
    const reviewer = await requireReviewerForAction();
    enforceRateLimit(`score-reopen:${reviewer.id}`, RATE_LIMITS.comment);

    await reopenScorecard(reviewer, parseOrThrow(idSchema, input.assignmentId));

    revalidateReview();
  });
}

const recuseSchema = z.object({
  assignmentId: idSchema,
  reason: z.string().trim().min(5, "Give a short reason — it goes on the record.").max(500),
});

export async function recuseAction(input: unknown) {
  return runAction(async () => {
    const reviewer = await requireReviewerForAction();
    enforceRateLimit(`recuse:${reviewer.id}`, RATE_LIMITS.comment);

    const { assignmentId, reason } = parseOrThrow(recuseSchema, input);

    await recuseFromReview(reviewer, assignmentId, sanitizePlainText(reason) ?? reason);

    revalidateReview();
  });
}
