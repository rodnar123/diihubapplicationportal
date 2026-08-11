import "server-only";

import { headers } from "next/headers";

import type { Prisma } from "@/generated/prisma/client";
import { prisma, type DbTransactionClient } from "@/lib/db/prisma";

/**
 * Append-only audit trail.
 *
 * Every state-changing operation records one entry. Writes are deliberately
 * non-throwing: an audit failure must never roll back or block the user's
 * action, but it must be loud in the server log.
 */

export const AUDIT_ACTIONS = {
  signIn: "auth.signed_in",
  signInRejected: "auth.rejected",
  signOut: "auth.signed_out",
  profileUpdated: "profile.updated",
  applicationCreated: "application.created",
  applicationUpdated: "application.updated",
  applicationSubmitted: "application.submitted",
  applicationWithdrawn: "application.withdrawn",
  applicationStatusChanged: "application.status_changed",
  applicationViewed: "application.viewed",
  applicationExported: "application.exported",
  attachmentUploaded: "attachment.uploaded",
  attachmentDeleted: "attachment.deleted",
  attachmentDownloaded: "attachment.downloaded",
  declarationRecorded: "declaration.recorded",
  commentAdded: "comment.added",
  settingsUpdated: "settings.updated",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Best-effort client attribution. Behind a proxy the left-most
 * `x-forwarded-for` entry is the original client.
 */
export async function requestContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get("x-forwarded-for");
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() ||
      headerList.get("x-real-ip") ||
      null;

    return { ipAddress, userAgent: headerList.get("user-agent") };
  } catch {
    // Called outside a request scope (e.g. a background job).
    return { ipAddress: null, userAgent: null };
  }
}

export interface AuditEntry {
  action: AuditAction | (string & {});
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const { ipAddress, userAgent } = await requestContext();

    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail?.toLowerCase() ?? null,
        metadata: entry.metadata ?? undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", { action: entry.action, error });
  }
}

/**
 * Variant for use inside a transaction, so the trail commits or rolls back
 * together with the change it describes.
 */
export async function recordAuditTx(
  tx: DbTransactionClient,
  entry: AuditEntry & { ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail?.toLowerCase() ?? null,
      metadata: entry.metadata ?? undefined,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
