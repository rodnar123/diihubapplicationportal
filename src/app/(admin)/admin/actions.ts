"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { commentSchema, decisionSchema } from "@/domain/application/schemas";
import { appSettingsSchema, type AppSettings } from "@/domain/settings/app-settings";
import { Role } from "@/generated/prisma/enums";
import { parseOrThrow, runAction } from "@/lib/action-helpers";
import { requireAdminForAction, requireReviewerForAction } from "@/lib/auth/session";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { ROUTES } from "@/lib/routes";
import { sanitizePlainText } from "@/lib/sanitize.server";
import { deleteApplication, restoreApplication } from "@/services/admin/application-admin";
import { searchApplicationsQuick } from "@/services/admin/application-query";
import { addComment, recordDecision } from "@/services/admin/review-service";
import {
  restoreUser,
  setUserActive,
  softDeleteUser,
  updateUserRole,
} from "@/services/admin/user-admin";
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

// ---------------------------------------------------------------------------
// Destructive administration
//
// Everything below is `requireAdminForAction`, not `requireReviewerForAction`.
// A reviewer assesses entries; removing one, or changing who may sign in at
// all, is a different kind of authority. The services re-check the same rule,
// because a Server Action is reachable by POST without going anywhere near the
// button that is supposed to be the only way to call it.
// ---------------------------------------------------------------------------

const applicationIdSchema = z.string().trim().min(1).max(40);

/** A short, optional note recorded with the deletion in the audit trail. */
const deletionReasonSchema = z
  .string()
  .trim()
  .max(500, "Keep the reason under 500 characters.")
  .optional()
  .nullable();

export async function deleteApplicationAction(input: {
  applicationId: string;
  reason?: string | null;
}) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    enforceRateLimit(`delete-application:${admin.id}`, RATE_LIMITS.adminDestructive);

    const applicationId = parseOrThrow(applicationIdSchema, input.applicationId);
    const reason = parseOrThrow(deletionReasonSchema, input.reason ?? null);

    const result = await deleteApplication(
      admin,
      applicationId,
      sanitizePlainText(reason ?? null),
    );

    revalidateAdmin(applicationId);
    // The owner's dashboard is now showing an entry that no longer exists.
    revalidatePath(ROUTES.dashboard);
    revalidatePath(ROUTES.application, "layout");

    return result;
  });
}

export async function restoreApplicationAction(input: { applicationId: string }) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    enforceRateLimit(`restore-application:${admin.id}`, RATE_LIMITS.adminDestructive);

    const applicationId = parseOrThrow(applicationIdSchema, input.applicationId);
    const result = await restoreApplication(admin, applicationId);

    revalidateAdmin(applicationId);
    revalidatePath(ROUTES.dashboard);
    revalidatePath(ROUTES.application, "layout");

    return result;
  });
}

// ---------------------------------------------------------------------------
// User administration
// ---------------------------------------------------------------------------

function revalidateUsers() {
  revalidatePath(ROUTES.adminUsers);
  revalidatePath(ROUTES.adminAudit);
}

const userIdSchema = z.string().trim().min(1).max(40);

export async function updateUserRoleAction(input: { userId: string; role: unknown }) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    enforceRateLimit(`user-role:${admin.id}`, RATE_LIMITS.adminDestructive);

    const userId = parseOrThrow(userIdSchema, input.userId);
    const role = parseOrThrow(z.enum(Role), input.role);

    const result = await updateUserRole(admin, userId, role);

    revalidateUsers();
    return result;
  });
}

export async function setUserActiveAction(input: { userId: string; isActive: boolean }) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    enforceRateLimit(`user-active:${admin.id}`, RATE_LIMITS.adminDestructive);

    const userId = parseOrThrow(userIdSchema, input.userId);
    const isActive = parseOrThrow(z.boolean(), input.isActive);

    const result = await setUserActive(admin, userId, isActive);

    revalidateUsers();
    return result;
  });
}

export async function deleteUserAction(input: { userId: string; reason?: string | null }) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    enforceRateLimit(`user-delete:${admin.id}`, RATE_LIMITS.adminDestructive);

    const userId = parseOrThrow(userIdSchema, input.userId);
    const reason = parseOrThrow(deletionReasonSchema, input.reason ?? null);

    const result = await softDeleteUser(admin, userId, sanitizePlainText(reason ?? null));

    revalidateUsers();
    // Their entries stay, but the applications list renders the owner.
    revalidateAdmin();

    return result;
  });
}

export async function restoreUserAction(input: { userId: string }) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    enforceRateLimit(`user-restore:${admin.id}`, RATE_LIMITS.adminDestructive);

    const userId = parseOrThrow(userIdSchema, input.userId);
    const result = await restoreUser(admin, userId);

    revalidateUsers();
    return result;
  });
}
