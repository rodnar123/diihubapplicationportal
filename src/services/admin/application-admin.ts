import "server-only";

import { Role } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { forbidden, invalidState, notFound } from "@/lib/errors";
import { AUDIT_ACTIONS, recordAuditTx, requestContext } from "@/services/audit/audit-log";

/**
 * Destructive administration of applications.
 *
 * Separate from `review-service` on purpose: that module is about assessing an
 * entry, this one is about removing it from the console altogether. Only a full
 * administrator may call in here — a reviewer decides, an administrator
 * disposes.
 */

function assertAdmin(actor: SessionUser): void {
  if (actor.role !== Role.ADMIN) {
    throw forbidden("Only an administrator can delete or restore an application.");
  }
}

/**
 * Soft-deletes an application.
 *
 * Nothing is removed from the database — `deletedAt` is stamped and every read
 * path already filters on it. That is the schema's stated convention, and it is
 * what makes the decision reversible and keeps the audit trail able to name
 * what was deleted. The related team, attachments, comments and history rows
 * are reached only through the application, so they disappear from the console
 * with it and come back intact on restore.
 *
 * The stamp and its audit entry commit together: a deletion that left no trace
 * of who performed it would defeat the point of keeping the row at all.
 */
export async function deleteApplication(
  actor: SessionUser,
  applicationId: string,
  reason: string | null,
): Promise<{ id: string; referenceNumber: string | null }> {
  assertAdmin(actor);

  const existing = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      referenceNumber: true,
      projectTitle: true,
      status: true,
      ownerId: true,
      challengeYear: true,
      deletedAt: true,
    },
  });

  if (!existing) throw notFound("That application no longer exists.");
  if (existing.deletedAt) {
    throw invalidState("That application has already been deleted.");
  }

  const { ipAddress, userAgent } = await requestContext();

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: { deletedAt: new Date() },
    });

    await recordAuditTx(tx, {
      action: AUDIT_ACTIONS.applicationDeleted,
      entityType: "Application",
      entityId: applicationId,
      actorId: actor.id,
      actorEmail: actor.email,
      metadata: {
        referenceNumber: existing.referenceNumber,
        projectTitle: existing.projectTitle,
        status: existing.status,
        ownerId: existing.ownerId,
        challengeYear: existing.challengeYear,
        reason,
      },
      ipAddress,
      userAgent,
    });
  });

  return { id: existing.id, referenceNumber: existing.referenceNumber };
}

/**
 * Puts a deleted application back.
 *
 * A student may hold only one live entry per challenge year, so a restore has
 * to check that the owner has not started a replacement in the meantime —
 * otherwise it would resurrect a second live entry for the same year and break
 * the rule the partial unique index exists to enforce.
 */
export async function restoreApplication(
  actor: SessionUser,
  applicationId: string,
): Promise<{ id: string; referenceNumber: string | null }> {
  assertAdmin(actor);

  const existing = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      referenceNumber: true,
      projectTitle: true,
      ownerId: true,
      challengeYear: true,
      deletedAt: true,
    },
  });

  if (!existing) throw notFound("That application no longer exists.");
  if (!existing.deletedAt) {
    throw invalidState("That application has not been deleted.");
  }

  // Held in a local because the narrowing above does not survive into the
  // transaction closure below.
  const deletedAt = existing.deletedAt;

  const replacement = await prisma.application.findFirst({
    where: {
      ownerId: existing.ownerId,
      challengeYear: existing.challengeYear,
      deletedAt: null,
      status: { not: "WITHDRAWN" },
    },
    select: { id: true, referenceNumber: true },
  });

  if (replacement) {
    throw invalidState(
      "This student already has a live entry for that challenge year " +
        `(${replacement.referenceNumber ?? "draft"}). Delete that one first if you want this one back.`,
    );
  }

  const { ipAddress, userAgent } = await requestContext();

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: { deletedAt: null },
    });

    await recordAuditTx(tx, {
      action: AUDIT_ACTIONS.applicationRestored,
      entityType: "Application",
      entityId: applicationId,
      actorId: actor.id,
      actorEmail: actor.email,
      metadata: {
        referenceNumber: existing.referenceNumber,
        projectTitle: existing.projectTitle,
        ownerId: existing.ownerId,
        deletedAt: deletedAt.toISOString(),
      },
      ipAddress,
      userAgent,
    });
  });

  return { id: existing.id, referenceNumber: existing.referenceNumber };
}
