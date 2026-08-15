import "server-only";

import { NotificationType } from "@/generated/prisma/enums";
import { CHALLENGE_NAME } from "@/domain/challenge/constants";
import { prisma } from "@/lib/db/prisma";
import { serverEnv } from "@/lib/env.server";
import { ROUTES } from "@/lib/routes";
import { renderEmail } from "./email-template";
import { sendEmail } from "./email-transport";

/**
 * Notifications.
 *
 * Every call here is best-effort and never throws: a mail outage must not roll
 * back a submission or a decision that is already recorded. Failures are
 * logged, and the in-app notification row remains the durable record — email
 * is the convenience copy, not the source of truth.
 */

async function markEmailSent(notificationId: string) {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { emailSentAt: new Date() },
    });
  } catch (error) {
    console.warn("[notifications] could not stamp emailSentAt", { notificationId, error });
  }
}

/**
 * Confirmation to the team, plus an alert to the challenge office.
 */
export async function sendSubmissionEmails(input: {
  applicationId: string;
  isResubmission: boolean;
}): Promise<void> {
  try {
    const application = await prisma.application.findUnique({
      where: { id: input.applicationId },
      select: {
        id: true,
        referenceNumber: true,
        projectTitle: true,
        submittedAt: true,
        ownerId: true,
        owner: { select: { name: true, email: true } },
        team: { select: { name: true, leaderEmail: true } },
      },
    });

    if (!application) return;

    const reference = application.referenceNumber ?? "your application";
    const projectTitle = application.projectTitle ?? "your venture";

    // --- Applicant confirmation -------------------------------------------
    const notification = await prisma.notification.create({
      data: {
        userId: application.ownerId,
        applicationId: application.id,
        type: input.isResubmission
          ? NotificationType.APPLICATION_RESUBMITTED
          : NotificationType.APPLICATION_SUBMITTED,
        title: input.isResubmission ? "Application re-submitted" : "Application submitted",
        body: `Your entry "${projectTitle}" was received. Reference ${reference}.`,
      },
    });

    const applicantCopy = renderEmail({
      heading: input.isResubmission
        ? "Your revised application has been received"
        : "Your application has been received",
      paragraphs: [
        `Hello ${application.owner.name},`,
        input.isResubmission
          ? `We have received the revised version of "${projectTitle}". It has gone back to the review panel.`
          : `Thank you for entering the ${CHALLENGE_NAME}. We have received "${projectTitle}" from team ${application.team?.name ?? "—"}.`,
        `Your reference number is ${reference}. Quote it in any correspondence with the challenge office.`,
        "You can download a PDF copy of everything you submitted from your dashboard at any time.",
      ],
      action: { label: "Open my dashboard", href: ROUTES.dashboard },
    });

    // Send to both the account address and the nominated team contact, which
    // are not always the same person.
    const recipients = [
      ...new Set(
        [application.owner.email, application.team?.leaderEmail].filter(
          (address): address is string => Boolean(address),
        ),
      ),
    ];

    const result = await sendEmail({
      to: recipients,
      subject: input.isResubmission
        ? `Revised application received — ${reference}`
        : `Application received — ${reference}`,
      ...applicantCopy,
    });

    if (result.delivered) await markEmailSent(notification.id);

    // --- Challenge office alert -------------------------------------------
    if (serverEnv.ADMIN_NOTIFICATION_EMAILS.length > 0) {
      const adminCopy = renderEmail({
        heading: input.isResubmission ? "Revised submission" : "New submission",
        paragraphs: [
          `${application.owner.name} (team ${application.team?.name ?? "—"}) ${
            input.isResubmission ? "re-submitted" : "submitted"
          } "${projectTitle}".`,
          `Reference ${reference}.`,
        ],
        action: {
          label: "Review this application",
          href: ROUTES.adminApplication(application.id),
        },
      });

      await sendEmail({
        to: serverEnv.ADMIN_NOTIFICATION_EMAILS,
        subject: `${input.isResubmission ? "Revised" : "New"} submission — ${reference}`,
        ...adminCopy,
      });
    }
  } catch (error) {
    console.error("[notifications] submission email failed", {
      applicationId: input.applicationId,
      error,
    });
  }
}

/**
 * Emails the applicant about a status change the reviewer chose to share.
 */
export async function sendStatusChangeEmail(input: {
  applicationId: string;
  /** The row this email belongs to, so the send can be stamped on it. */
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  note: string | null;
}): Promise<void> {
  try {
    const [user, application] = await Promise.all([
      prisma.user.findUnique({
        where: { id: input.userId },
        select: { name: true, email: true },
      }),
      prisma.application.findUnique({
        where: { id: input.applicationId },
        select: { referenceNumber: true, projectTitle: true },
      }),
    ]);

    if (!user || !application) return;

    const reference = application.referenceNumber ?? "your application";

    const copy = renderEmail({
      heading: input.title,
      paragraphs: [
        `Hello ${user.name},`,
        input.body,
        `Reference ${reference}${application.projectTitle ? ` — "${application.projectTitle}"` : ""}.`,
      ],
      quote: input.note,
      action: { label: "Open my dashboard", href: ROUTES.dashboard },
    });

    const result = await sendEmail({
      to: user.email,
      subject: `${input.title} — ${reference}`,
      ...copy,
    });

    /*
     * Stamped by id. This used to find "the newest unsent notification for
     * this user and application", which is the right row only as long as one
     * is created at a time — a shared comment landing alongside a decision
     * would have marked the wrong one as emailed and left the real one
     * looking unsent forever.
     */
    if (result.delivered) await markEmailSent(input.notificationId);
  } catch (error) {
    console.error("[notifications] status email failed", {
      applicationId: input.applicationId,
      error,
    });
  }
}

/** Unread in-app notifications, newest first. */
export async function getUnreadNotifications(userId: string, limit = 10) {
  return prisma.notification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      applicationId: true,
      createdAt: true,
    },
  });
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });

  return result.count;
}
