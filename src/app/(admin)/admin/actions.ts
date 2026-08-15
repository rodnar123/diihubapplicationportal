"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { commentSchema, decisionSchema } from "@/domain/application/schemas";
import { appSettingsSchema, type AppSettings } from "@/domain/settings/app-settings";
import { parseOrThrow, runAction } from "@/lib/action-helpers";
import { requireAdminForAction, requireReviewerForAction } from "@/lib/auth/session";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { ROUTES } from "@/lib/routes";
import { sanitizePlainText } from "@/lib/sanitize.server";
import { searchApplicationsQuick } from "@/services/admin/application-query";
import { addComment, recordDecision } from "@/services/admin/review-service";
import { sendStatusChangeEmail } from "@/services/notifications/notification-service";
import { updateAppSettings } from "@/services/settings/settings-service";

/**
 * Server Actions for the review console.
 */

function revalidateAdmin(applicationId?: string) {
  revalidatePath(ROUTES.admin);
  revalidatePath(ROUTES.adminApplications);
  if (applicationId) revalidatePath(ROUTES.adminApplication(applicationId));
}

export async function recordDecisionAction(input: {
  applicationId: string;
  values: unknown;
}) {
  return runAction(async () => {
    const reviewer = await requireReviewerForAction();
    enforceRateLimit(`decision:${reviewer.id}`, RATE_LIMITS.comment);

    const values = parseOrThrow(decisionSchema, input.values);

    const result = await recordDecision(reviewer, input.applicationId, {
      ...values,
      note: sanitizePlainText(values.note ?? null) ?? undefined,
    });

    // Email is best-effort: a delivery failure must not roll back a decision
    // that is already recorded and visible in the portal.
    if (result.notification) {
      await sendStatusChangeEmail({
        applicationId: input.applicationId,
        notificationId: result.notification.id,
        userId: result.notification.userId,
        title: result.notification.title,
        body: result.notification.body,
        note: values.note ?? null,
      });
    }

    revalidateAdmin(input.applicationId);
    revalidatePath(ROUTES.dashboard);

    return { status: result.application.status };
  });
}

export async function addCommentAction(input: { applicationId: string; values: unknown }) {
  return runAction(async () => {
    const reviewer = await requireReviewerForAction();
    enforceRateLimit(`comment:${reviewer.id}`, RATE_LIMITS.comment);

    const values = parseOrThrow(commentSchema, input.values);

    const comment = await addComment(reviewer, input.applicationId, {
      ...values,
      body: sanitizePlainText(values.body) ?? values.body,
    });

    revalidateAdmin(input.applicationId);
    revalidatePath(ROUTES.dashboard);

    return comment;
  });
}

/**
 * Settings are typed per key, so the action validates the *whole* resulting
 * configuration rather than the submitted fragment — that is the only way to
 * catch cross-field rules such as min ≤ max.
 */
const settingsUpdateSchema = appSettingsSchema.partial();

export async function updateSettingsAction(values: unknown) {
  return runAction(async () => {
    const admin = await requireAdminForAction();

    const updates = parseOrThrow(settingsUpdateSchema, values) as Partial<AppSettings>;
    const settings = await updateAppSettings(updates, admin.id);

    revalidatePath(ROUTES.adminSettings, "layout");
    revalidatePath(ROUTES.admin);
    revalidatePath(ROUTES.application, "layout");

    return settings;
  });
}

const bulkDecisionSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1).max(100),
  values: z.unknown(),
});

/**
 * Applies one decision to several applications.
 *
 * Each is processed independently so that one invalid transition (an entry
 * someone else already decided, say) does not discard the rest of the batch;
 * the caller gets a per-application outcome.
 */
export async function bulkDecisionAction(input: unknown) {
  return runAction(async () => {
    const reviewer = await requireReviewerForAction();
    enforceRateLimit(`bulk-decision:${reviewer.id}`, RATE_LIMITS.submit);

    const { applicationIds, values } = parseOrThrow(bulkDecisionSchema, input);
    const decision = parseOrThrow(decisionSchema, values);

    const results: Array<{ applicationId: string; ok: boolean; message?: string }> = [];

    for (const applicationId of applicationIds) {
      try {
        await recordDecision(reviewer, applicationId, decision);
        results.push({ applicationId, ok: true });
      } catch (error) {
        results.push({
          applicationId,
          ok: false,
          message: error instanceof Error ? error.message : "Failed",
        });
      }
    }

    revalidateAdmin();

    return {
      succeeded: results.filter((entry) => entry.ok).length,
      failed: results.filter((entry) => !entry.ok),
    };
  });
}

/**
 * Free-text application lookup for the command palette.
 *
 * `requireReviewerForAction` rather than a UI check: the palette is rendered
 * by the shared app shell, so a student's browser has this action in its
 * bundle too. The client only offers the search to reviewers, but that is a
 * convenience — this is the boundary that decides who may read other people's
 * entries.
 */
export async function searchApplicationsAction(term: string) {
  return runAction(async () => {
    const reviewer = await requireReviewerForAction();
    enforceRateLimit(`palette-search:${reviewer.id}`, RATE_LIMITS.paletteSearch);

    const trimmed = parseOrThrow(z.string().trim().min(2).max(100), term);

    return { results: await searchApplicationsQuick(trimmed) };
  });
}
