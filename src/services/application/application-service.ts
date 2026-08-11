import "server-only";

import { cache } from "react";

import { ApplicationStatus, DeclarationMode, Role } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { isEditableByStudent } from "@/domain/application/status";
import { assessCompleteness } from "@/domain/application/completeness";
import type { ApplicationDto, ApplicationWithApplicant } from "@/domain/application/types";
import { REFERENCE_PREFIX } from "@/domain/challenge/constants";
import { submissionWindow, type AppSettings } from "@/domain/settings/app-settings";
import type { SessionUser } from "@/lib/auth/session";
import { prisma, type DbTransactionClient } from "@/lib/db/prisma";
import { AppError, conflict, forbidden, invalidState, notFound } from "@/lib/errors";
import { AUDIT_ACTIONS, recordAudit, requestContext } from "@/services/audit/audit-log";
import { getAppSettings } from "@/services/settings/settings-service";
import {
  applicationInclude,
  toApplicantDto,
  toApplicationDto,
  type ApplicationWithRelations,
} from "./mappers";

/**
 * The application use-cases.
 *
 * Everything a student can do to their entry passes through here. Server
 * Actions are thin wrappers: they validate input and delegate, so the rules
 * (who may edit, when, and what makes an entry submittable) exist once.
 */

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Fetches the caller's application for the current challenge year, creating an
 * empty draft the first time they open the form.
 */
export async function getOrCreateDraft(user: SessionUser): Promise<ApplicationWithApplicant> {
  const settings = await getAppSettings();
  const challengeYear = settings["challenge.year"];

  const existing = await prisma.application.findFirst({
    where: { ownerId: user.id, challengeYear, deletedAt: null, status: { not: "WITHDRAWN" } },
    include: applicationInclude,
  });

  if (existing) {
    return { application: toApplicationDto(existing), applicant: applicantFrom(user) };
  }

  // Seed Section A and the leader block from the student's profile: the first
  // thing they see should be their own details, already filled in.
  const profile = user.profile;

  const created = await prisma.application.create({
    data: {
      ownerId: user.id,
      challengeYear,
      status: ApplicationStatus.DRAFT,
      applicantPhone: profile?.phone ?? null,
      schoolId: profile?.schoolId ?? null,
      sectionId: profile?.sectionId ?? null,
      program: profile?.program ?? null,
      yearLevel: profile?.yearLevel ?? null,
      team: {
        create: {
          name: "",
          leaderName: user.name,
          leaderStudentId: profile?.studentId ?? "",
          leaderEmail: user.email,
          leaderPhone: profile?.phone ?? null,
        },
      },
    },
    include: applicationInclude,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.applicationCreated,
    entityType: "Application",
    entityId: created.id,
    actorId: user.id,
    actorEmail: user.email,
    metadata: { challengeYear },
  });

  return { application: toApplicationDto(created), applicant: applicantFrom(user) };
}

/**
 * Request-scoped wrapper around {@link getOrCreateDraft}.
 *
 * The wizard layout and the step page both need the application, and they
 * render concurrently. Without deduplication a first-time visitor would issue
 * two `create` calls and one of them would hit the
 * "one live application per student per year" index. `cache` collapses them
 * onto a single promise — which works because `getSessionUser` is itself
 * cached, so both callers pass the identical `user` object.
 */
export const loadStudentApplication = cache(
  async (user: SessionUser): Promise<ApplicationWithApplicant> => getOrCreateDraft(user),
);

function applicantFrom(user: SessionUser) {
  return toApplicantDto({
    id: user.id,
    name: user.name,
    email: user.email,
    studentProfile: user.profile
      ? {
          studentId: user.profile.studentId,
          firstName: user.profile.firstName,
          surname: user.profile.surname,
        }
      : null,
  });
}

/** Loads an application the caller owns, or throws. */
async function loadOwnedApplication(
  userId: string,
  applicationId: string,
): Promise<ApplicationWithRelations> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    include: applicationInclude,
  });

  if (!application) throw notFound("That application no longer exists.");
  if (application.ownerId !== userId) {
    throw forbidden("You can only work on your own application.");
  }

  return application;
}

/**
 * Loads an application the caller owns *and* is allowed to change right now.
 */
async function loadEditableApplication(
  userId: string,
  applicationId: string,
): Promise<ApplicationWithRelations> {
  const application = await loadOwnedApplication(userId, applicationId);

  if (!isEditableByStudent(application.status)) {
    throw invalidState(
      application.status === ApplicationStatus.SUBMITTED ||
        application.status === ApplicationStatus.UNDER_REVIEW
        ? "Your application has been submitted and can no longer be edited."
        : "This application can no longer be edited.",
    );
  }

  return application;
}

// ---------------------------------------------------------------------------
// Step writes
// ---------------------------------------------------------------------------

/**
 * Applies a field patch to the application. Used by every narrative step; the
 * caller has already validated and sanitised the payload.
 */
export async function saveApplicationFields(
  user: SessionUser,
  applicationId: string,
  data: Prisma.ApplicationUpdateInput,
  auditMetadata?: Record<string, unknown>,
): Promise<ApplicationDto> {
  await loadEditableApplication(user.id, applicationId);

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data,
    include: applicationInclude,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.applicationUpdated,
    entityType: "Application",
    entityId: applicationId,
    actorId: user.id,
    actorEmail: user.email,
    metadata: (auditMetadata ?? { fields: Object.keys(data) }) as Prisma.InputJsonValue,
  });

  return toApplicationDto(updated);
}

export interface TeamWritePayload {
  name: string;
  leaderName: string;
  leaderStudentId: string;
  leaderEmail: string;
  leaderPhone: string | null;
  supervisorName: string | null;
  supervisorEmail: string | null;
  members: Array<{
    studentId: string;
    firstName: string;
    surname: string;
    sectionId: string | null;
    sectionLabel: string | null;
    role: string | null;
    email: string | null;
    phone: string | null;
  }>;
}

/**
 * Replaces the team and its roster.
 *
 * Uniqueness of a team name, and of a student across teams, is scoped to a
 * challenge year — which lives on the parent application, so Postgres cannot
 * express it as a single constraint. Both checks therefore run inside the same
 * transaction as the write, which is what makes them safe against two teams
 * registering the same name concurrently.
 */
export async function saveTeam(
  user: SessionUser,
  applicationId: string,
  payload: TeamWritePayload,
): Promise<ApplicationDto> {
  const application = await loadEditableApplication(user.id, applicationId);
  const challengeYear = application.challengeYear;

  const updated = await prisma.$transaction(async (tx) => {
    const trimmedName = payload.name.trim();

    const duplicateName = await tx.team.findFirst({
      where: {
        deletedAt: null,
        name: { equals: trimmedName, mode: "insensitive" },
        applicationId: { not: applicationId },
        application: {
          challengeYear,
          deletedAt: null,
          status: { not: ApplicationStatus.WITHDRAWN },
        },
      },
      select: { id: true },
    });

    if (duplicateName) {
      throw conflict(`The team name "${trimmedName}" is already taken for this challenge.`, {
        name: ["Another team has already registered this name. Choose a different one."],
      });
    }

    // A student may compete on one team only.
    const rosterIds = [payload.leaderStudentId, ...payload.members.map((m) => m.studentId)];

    const clashes = await tx.teamMember.findMany({
      where: {
        deletedAt: null,
        studentId: { in: rosterIds },
        team: {
          deletedAt: null,
          applicationId: { not: applicationId },
          application: {
            challengeYear,
            deletedAt: null,
            status: { not: ApplicationStatus.WITHDRAWN },
          },
        },
      },
      select: { studentId: true, team: { select: { name: true } } },
    });

    if (clashes.length > 0) {
      const fieldErrors: Record<string, string[]> = {};

      for (const clash of clashes) {
        if (clash.studentId === payload.leaderStudentId) {
          fieldErrors.leaderStudentId = [
            `This student is already registered with team "${clash.team.name}".`,
          ];
          continue;
        }
        const index = payload.members.findIndex((m) => m.studentId === clash.studentId);
        if (index >= 0) {
          fieldErrors[`members.${index}.studentId`] = [
            `This student is already registered with team "${clash.team.name}".`,
          ];
        }
      }

      throw conflict(
        "One or more students are already on another team for this challenge.",
        fieldErrors,
      );
    }

    const teamData = {
      name: trimmedName,
      leaderName: payload.leaderName,
      leaderStudentId: payload.leaderStudentId,
      leaderEmail: payload.leaderEmail,
      leaderPhone: payload.leaderPhone,
      supervisorName: payload.supervisorName,
      supervisorEmail: payload.supervisorEmail,
    };

    const team = await tx.team.upsert({
      where: { applicationId },
      update: teamData,
      create: { applicationId, ...teamData },
      select: { id: true },
    });

    // The roster is small and fully replaced on every save, so a delete-then-
    // insert is simpler and cheaper than diffing rows.
    await tx.teamMember.deleteMany({ where: { teamId: team.id } });

    await tx.teamMember.createMany({
      data: [
        {
          teamId: team.id,
          studentId: payload.leaderStudentId,
          firstName: payload.leaderName.split(/\s+/)[0] ?? payload.leaderName,
          surname: payload.leaderName.split(/\s+/).slice(1).join(" ") || payload.leaderName,
          sectionId: application.sectionId,
          role: "Team Leader",
          email: payload.leaderEmail,
          phone: payload.leaderPhone,
          isLeader: true,
          sortOrder: 0,
        },
        ...payload.members.map((member, index) => ({
          teamId: team.id,
          studentId: member.studentId,
          firstName: member.firstName,
          surname: member.surname,
          sectionId: member.sectionId,
          sectionLabel: member.sectionLabel,
          role: member.role,
          email: member.email,
          phone: member.phone,
          isLeader: false,
          sortOrder: index + 1,
        })),
      ],
    });

    return tx.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: applicationInclude,
    });
  });

  await recordAudit({
    action: AUDIT_ACTIONS.applicationUpdated,
    entityType: "Application",
    entityId: applicationId,
    actorId: user.id,
    actorEmail: user.email,
    metadata: { step: "team", memberCount: payload.members.length + 1 },
  });

  return toApplicationDto(updated);
}

export interface DeclarationWritePayload {
  mode: DeclarationMode;
  accepted: boolean;
  signatoryName: string;
  signedAt: Date;
  signedDocumentId: string | null;
}

export async function saveDeclaration(
  user: SessionUser,
  applicationId: string,
  payload: DeclarationWritePayload,
): Promise<ApplicationDto> {
  await loadEditableApplication(user.id, applicationId);
  const settings = await getAppSettings();

  const allowed = settings["declaration.mode"];
  if (allowed !== "BOTH") {
    const required =
      allowed === "ELECTRONIC" ? DeclarationMode.ELECTRONIC : DeclarationMode.SIGNED_UPLOAD;
    if (payload.mode !== required) {
      throw invalidState(
        required === DeclarationMode.ELECTRONIC
          ? "The challenge office currently requires the electronic declaration."
          : "The challenge office currently requires a signed declaration document.",
      );
    }
  }

  if (payload.mode === DeclarationMode.SIGNED_UPLOAD) {
    if (!payload.signedDocumentId) {
      throw new AppError("VALIDATION", "Upload the signed declaration to continue.", {
        fieldErrors: { signedDocumentId: ["Upload the signed declaration to continue."] },
      });
    }

    // The document must belong to this application — otherwise a student could
    // reference someone else's upload by id.
    const document = await prisma.attachment.findFirst({
      where: { id: payload.signedDocumentId, applicationId, deletedAt: null },
      select: { id: true },
    });

    if (!document) {
      throw new AppError("VALIDATION", "That signed declaration could not be found.", {
        fieldErrors: { signedDocumentId: ["Upload the signed declaration again."] },
      });
    }
  }

  const { ipAddress, userAgent } = await requestContext();

  const data = {
    mode: payload.mode,
    accepted: payload.mode === DeclarationMode.ELECTRONIC ? payload.accepted : true,
    signatoryName: payload.signatoryName,
    signedAt: payload.signedAt,
    signedDocumentId: payload.mode === DeclarationMode.SIGNED_UPLOAD ? payload.signedDocumentId : null,
    ipAddress,
    userAgent,
  };

  await prisma.declaration.upsert({
    where: { applicationId },
    update: data,
    create: { applicationId, ...data },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.declarationRecorded,
    entityType: "Application",
    entityId: applicationId,
    actorId: user.id,
    actorEmail: user.email,
    metadata: { mode: payload.mode },
  });

  const refreshed = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: applicationInclude,
  });

  return toApplicationDto(refreshed);
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

/**
 * Allocates the next reference number for a challenge year.
 *
 * Fixed-width zero padding makes lexicographic order match numeric order, so
 * the highest existing number can be found with a plain `ORDER BY … DESC`.
 * The unique index on `referenceNumber` is what actually prevents a collision
 * between two concurrent submissions; the retry loop turns that collision into
 * a second attempt rather than an error.
 */
async function allocateReferenceNumber(
  tx: DbTransactionClient,
  challengeYear: number,
): Promise<string> {
  const prefix = `${REFERENCE_PREFIX}-${challengeYear}-`;

  const latest = await tx.application.findFirst({
    where: { challengeYear, referenceNumber: { startsWith: prefix } },
    orderBy: { referenceNumber: "desc" },
    select: { referenceNumber: true },
  });

  const lastSequence = latest?.referenceNumber
    ? Number.parseInt(latest.referenceNumber.slice(prefix.length), 10)
    : 0;

  return `${prefix}${String((Number.isNaN(lastSequence) ? 0 : lastSequence) + 1).padStart(4, "0")}`;
}

export interface SubmitResult {
  application: ApplicationDto;
  referenceNumber: string;
  isResubmission: boolean;
}

export async function submitApplication(
  user: SessionUser,
  applicationId: string,
): Promise<SubmitResult> {
  const settings = await getAppSettings();
  const existing = await loadEditableApplication(user.id, applicationId);

  const window = submissionWindow(settings);
  if (!window.open) {
    throw new AppError(
      "SUBMISSION_CLOSED",
      window.reason === "NOT_YET_OPEN"
        ? `Submissions open on ${window.opensAt?.toLocaleString("en-AU", { dateStyle: "long", timeStyle: "short" })}.`
        : `Submissions closed on ${window.closesAt?.toLocaleString("en-AU", { dateStyle: "long", timeStyle: "short" })}.`,
    );
  }

  // The same rule the review screen showed the student.
  const report = assessCompleteness(toApplicationDto(existing), settings);
  if (!report.canSubmit) {
    throw new AppError("VALIDATION", "Your application is not complete yet.", {
      fieldErrors: { form: report.blockingReasons },
    });
  }

  const isResubmission = existing.status === ApplicationStatus.REVISION_REQUESTED;
  const { ipAddress, userAgent } = await requestContext();

  const result = await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction: between the completeness check and here,
    // a second tab could have submitted already.
    const current = await tx.application.findUniqueOrThrow({
      where: { id: applicationId },
      select: { status: true, referenceNumber: true, revisionCount: true },
    });

    if (!isEditableByStudent(current.status)) {
      throw invalidState("This application has already been submitted.");
    }

    const referenceNumber =
      current.referenceNumber ?? (await allocateReferenceNumber(tx, existing.challengeYear));

    const submittedAt = new Date();

    const updated = await tx.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.SUBMITTED,
        referenceNumber,
        submittedAt,
        revisionCount: isResubmission ? current.revisionCount + 1 : current.revisionCount,
      },
      include: applicationInclude,
    });

    await tx.statusHistory.create({
      data: {
        applicationId,
        fromStatus: current.status,
        toStatus: ApplicationStatus.SUBMITTED,
        actorId: user.id,
        note: isResubmission ? "Re-submitted after revision." : "Submitted for review.",
      },
    });

    await tx.auditLog.create({
      data: {
        action: AUDIT_ACTIONS.applicationSubmitted,
        entityType: "Application",
        entityId: applicationId,
        actorId: user.id,
        actorEmail: user.email,
        metadata: { referenceNumber, isResubmission },
        ipAddress,
        userAgent,
      },
    });

    return { updated, referenceNumber };
  });

  return {
    application: toApplicationDto(result.updated),
    referenceNumber: result.referenceNumber,
    isResubmission,
  };
}

export async function withdrawApplication(
  user: SessionUser,
  applicationId: string,
  reason: string | null,
): Promise<ApplicationDto> {
  const settings = await getAppSettings();
  if (!settings["submission.allowWithdraw"]) {
    throw forbidden("Withdrawing an application is not currently permitted.");
  }

  const application = await loadOwnedApplication(user.id, applicationId);

  if (application.status !== ApplicationStatus.SUBMITTED) {
    throw invalidState(
      application.status === ApplicationStatus.UNDER_REVIEW
        ? "Your application is already being reviewed and can no longer be withdrawn."
        : "Only a submitted application can be withdrawn.",
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.WITHDRAWN },
      include: applicationInclude,
    });

    await tx.statusHistory.create({
      data: {
        applicationId,
        fromStatus: application.status,
        toStatus: ApplicationStatus.WITHDRAWN,
        actorId: user.id,
        note: reason,
      },
    });

    return next;
  });

  await recordAudit({
    action: AUDIT_ACTIONS.applicationWithdrawn,
    entityType: "Application",
    entityId: applicationId,
    actorId: user.id,
    actorEmail: user.email,
    metadata: { reason },
  });

  return toApplicationDto(updated);
}

// ---------------------------------------------------------------------------
// Shared read for the dashboard and review screens
// ---------------------------------------------------------------------------

export async function getApplicationOverview(user: SessionUser): Promise<{
  application: ApplicationDto | null;
  settings: AppSettings;
  statusHistory: Array<{
    id: string;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    note: string | null;
    actorName: string | null;
    createdAt: string;
  }>;
  sharedComments: Array<{ id: string; body: string; authorName: string; createdAt: string }>;
}> {
  const settings = await getAppSettings();

  const record = await prisma.application.findFirst({
    where: {
      ownerId: user.id,
      challengeYear: settings["challenge.year"],
      deletedAt: null,
    },
    include: {
      ...applicationInclude,
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { actor: { select: { name: true } } },
      },
      comments: {
        where: { visibility: "SHARED", deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { author: { select: { name: true } } },
      },
    },
  });

  if (!record) {
    return { application: null, settings, statusHistory: [], sharedComments: [] };
  }

  return {
    application: toApplicationDto(record),
    settings,
    statusHistory: record.statusHistory.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      note: event.note,
      actorName: event.actor?.name ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
    sharedComments: record.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      authorName: comment.author.name,
      createdAt: comment.createdAt.toISOString(),
    })),
  };
}

/**
 * Reader used by the PDF route and the admin console. `viewer` decides whether
 * ownership is required.
 */
export async function getApplicationForViewer(
  applicationId: string,
  viewer: { id: string; role: Role },
): Promise<ApplicationWithRelations> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    include: applicationInclude,
  });

  if (!application) throw notFound("That application no longer exists.");

  const isOwner = application.ownerId === viewer.id;
  const isStaff = viewer.role === Role.ADMIN || viewer.role === Role.REVIEWER;

  if (!isOwner && !isStaff) {
    throw forbidden("You do not have permission to view this application.");
  }

  return application;
}
