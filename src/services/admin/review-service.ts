import "server-only";

import {
  ApplicationStatus,
  CommentVisibility,
  NotificationType,
  Role,
} from "@/generated/prisma/enums";
import { canTransition } from "@/domain/application/status";
import type { CommentInput, DecisionInput } from "@/domain/application/schemas";
import type { ApplicationDto, CommentDto, StatusEventDto } from "@/domain/application/types";
import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { forbidden, invalidState, notFound } from "@/lib/errors";
import { AUDIT_ACTIONS, recordAudit, requestContext } from "@/services/audit/audit-log";
import {
  applicationInclude,
  toApplicantDto,
  toApplicationDto,
  toCommentDto,
  toStatusEventDto,
} from "@/services/application/mappers";

/**
 * Reviewer use-cases: recording a decision and leaving comments.
 */

export interface ApplicationDetail {
  application: ApplicationDto;
  applicant: {
    userId: string;
    fullName: string;
    email: string;
    studentId: string;
    firstName: string;
    surname: string;
  };
  schoolName: string | null;
  sectionName: string | null;
  sectionNameById: Record<string, string>;
  statusHistory: StatusEventDto[];
  comments: CommentDto[];
}

export async function getApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  const record = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    include: {
      ...applicationInclude,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          studentProfile: { select: { studentId: true, firstName: true, surname: true } },
        },
      },
      school: { select: { name: true } },
      section: { select: { name: true } },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
      },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, role: true } } },
      },
    },
  });

  if (!record) throw notFound("That application no longer exists.");

  const sections = await prisma.section.findMany({ select: { id: true, name: true } });

  return {
    application: toApplicationDto(record),
    applicant: toApplicantDto(record.owner),
    schoolName: record.school?.name ?? null,
    sectionName: record.section?.name ?? null,
    sectionNameById: Object.fromEntries(sections.map((section) => [section.id, section.name])),
    statusHistory: record.statusHistory.map(toStatusEventDto),
    comments: record.comments.map(toCommentDto),
  };
}

const NOTIFICATION_BY_STATUS: Partial<Record<ApplicationStatus, NotificationType>> = {
  UNDER_REVIEW: NotificationType.APPLICATION_UNDER_REVIEW,
  REVISION_REQUESTED: NotificationType.REVISION_REQUESTED,
  APPROVED: NotificationType.APPLICATION_APPROVED,
  REJECTED: NotificationType.APPLICATION_REJECTED,
};

function notificationCopy(
  status: ApplicationStatus,
  reference: string | null,
): { title: string; body: string } {
  const ref = reference ? ` (${reference})` : "";

  switch (status) {
    case ApplicationStatus.UNDER_REVIEW:
      return {
        title: "Your application is being reviewed",
        body: `A reviewer has started assessing your entry${ref}. There is nothing for you to do right now.`,
      };
    case ApplicationStatus.REVISION_REQUESTED:
      return {
        title: "Changes requested to your application",
        body: `The review panel has asked for changes to your entry${ref}. Your form has been re-opened for editing.`,
      };
    case ApplicationStatus.APPROVED:
      return {
        title: "Your application has been approved",
        body: `Congratulations — your entry${ref} has been accepted into the challenge.`,
      };
    case ApplicationStatus.REJECTED:
      return {
        title: "Your application was not accepted",
        body: `Your entry${ref} was not accepted for this cycle. The reviewer's reason is in the portal.`,
      };
    default:
      return {
        title: "Your application status changed",
        body: `The status of your entry${ref} has changed.`,
      };
  }
}

export interface DecisionResult {
  application: ApplicationDto;
  notification: { userId: string; type: NotificationType; title: string; body: string } | null;
}

/**
 * Applies a reviewer's decision.
 *
 * Status change, history entry, optional shared comment, audit record and the
 * applicant's notification all commit together — a student must never see
 * "revision requested" with no explanation of what to revise, and the trail
 * must never disagree with the current status.
 */
export async function recordDecision(
  reviewer: SessionUser,
  applicationId: string,
  input: DecisionInput,
): Promise<DecisionResult> {
  if (reviewer.role !== Role.ADMIN && reviewer.role !== Role.REVIEWER) {
    throw forbidden("Only the review panel can change an application's status.");
  }

  const existing = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: { id: true, status: true, ownerId: true, referenceNumber: true },
  });

  if (!existing) throw notFound("That application no longer exists.");

  const nextStatus = input.status as ApplicationStatus;

  if (existing.status === nextStatus) {
    throw invalidState(`This application is already marked as ${nextStatus.toLowerCase().replace("_", " ")}.`);
  }

  if (!canTransition(existing.status, nextStatus, reviewer.role)) {
    throw invalidState(
      `An application cannot move from ${existing.status.toLowerCase().replace("_", " ")} to ${nextStatus.toLowerCase().replace("_", " ")}.`,
    );
  }

  const { ipAddress, userAgent } = await requestContext();
  const isDecision =
    nextStatus === ApplicationStatus.APPROVED || nextStatus === ApplicationStatus.REJECTED;
  const note = input.note?.trim() || null;

  const updated = await prisma.$transaction(async (tx) => {
    const application = await tx.application.update({
      where: { id: applicationId },
      data: {
        status: nextStatus,
        reviewedById: reviewer.id,
        // A decision stamps the review time; picking an entry up does not.
        reviewedAt: isDecision ? new Date() : undefined,
        decisionNote: isDecision ? note : undefined,
      },
      include: applicationInclude,
    });

    await tx.statusHistory.create({
      data: {
        applicationId,
        fromStatus: existing.status,
        toStatus: nextStatus,
        actorId: reviewer.id,
        note,
      },
    });

    // Feedback the applicant must act on is also stored as a shared comment,
    // so it appears in their thread rather than only in the status trail.
    if (note && input.notifyApplicant) {
      await tx.comment.create({
        data: {
          applicationId,
          authorId: reviewer.id,
          body: note,
          visibility: CommentVisibility.SHARED,
        },
      });
    }

    const notificationType = NOTIFICATION_BY_STATUS[nextStatus];
    if (notificationType && input.notifyApplicant) {
      const copy = notificationCopy(nextStatus, existing.referenceNumber);
      await tx.notification.create({
        data: {
          userId: existing.ownerId,
          applicationId,
          type: notificationType,
          title: copy.title,
          body: copy.body,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: AUDIT_ACTIONS.applicationStatusChanged,
        entityType: "Application",
        entityId: applicationId,
        actorId: reviewer.id,
        actorEmail: reviewer.email,
        metadata: {
          from: existing.status,
          to: nextStatus,
          hasNote: Boolean(note),
          notified: input.notifyApplicant,
        },
        ipAddress,
        userAgent,
      },
    });

    return application;
  });

  const notificationType = NOTIFICATION_BY_STATUS[nextStatus];

  return {
    application: toApplicationDto(updated),
    notification:
      notificationType && input.notifyApplicant
        ? {
            userId: existing.ownerId,
            type: notificationType,
            ...notificationCopy(nextStatus, existing.referenceNumber),
          }
        : null,
  };
}

export async function addComment(
  reviewer: SessionUser,
  applicationId: string,
  input: CommentInput,
): Promise<CommentDto> {
  if (reviewer.role !== Role.ADMIN && reviewer.role !== Role.REVIEWER) {
    throw forbidden("Only the review panel can comment on an application.");
  }

  const application = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: { id: true, ownerId: true, referenceNumber: true },
  });

  if (!application) throw notFound("That application no longer exists.");

  const visibility =
    input.visibility === "SHARED" ? CommentVisibility.SHARED : CommentVisibility.INTERNAL;

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        applicationId,
        authorId: reviewer.id,
        body: input.body,
        visibility,
      },
      include: { author: { select: { name: true, role: true } } },
    });

    // Only a shared comment is worth telling the applicant about; internal
    // notes must not leak their existence.
    if (visibility === CommentVisibility.SHARED) {
      await tx.notification.create({
        data: {
          userId: application.ownerId,
          applicationId,
          type: NotificationType.COMMENT_ADDED,
          title: "New comment on your application",
          body: `The review panel left a comment on your entry${
            application.referenceNumber ? ` (${application.referenceNumber})` : ""
          }.`,
        },
      });
    }

    return created;
  });

  await recordAudit({
    action: AUDIT_ACTIONS.commentAdded,
    entityType: "Comment",
    entityId: comment.id,
    actorId: reviewer.id,
    actorEmail: reviewer.email,
    metadata: { applicationId, visibility },
  });

  return toCommentDto(comment);
}
