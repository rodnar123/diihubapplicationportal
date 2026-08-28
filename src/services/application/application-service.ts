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
import { MAX_ATTEMPTS, backoffMs } from "@/lib/db/transient";
import { formatDateTime } from "@/lib/format";
import { AppError, conflict, forbidden, invalidState, notFound } from "@/lib/errors";
import { AUDIT_ACTIONS, recordAudit, requestContext } from "@/services/audit/audit-log";
import { findMembershipConflicts } from "@/services/application/membership-service";
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
/**
 * Prisma's defaults for an interactive transaction are `maxWait: 2s` and
 * `timeout: 5s`, both of which assume a database that is a short hop away.
 * Against a pooler in another region this write measured close to the 5s mark,
 * and exceeding it fails the save with `P2028` even though nothing is wrong —
 * the student just sees "Something went wrong" and loses the roster.
 *
 * Raised rather than removed: a genuinely stuck transaction must still let go
 * of its pooled connection, and the pool is only three deep per instance.
 */
const TEAM_TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 20_000 };

export async function saveTeam(
  user: SessionUser,
  applicationId: string,
  payload: TeamWritePayload,
): Promise<ApplicationDto> {
  const application = await loadEditableApplication(user.id, applicationId);
  const challengeYear = application.challengeYear;

  await prisma.$transaction(async (tx) => {
    const trimmedName = payload.name.trim();

    // A student may compete on one team only.
    const rosterIds = [payload.leaderStudentId, ...payload.members.map((m) => m.studentId)];

    /*
     * Two independent reads, so they go together. Everything in this
     * transaction is a round trip to a pooler in another datacentre, and the
     * autosave on the team step runs the whole thing on a debounce — the
     * sequential version measured ~7s per save, against a 5s default
     * interactive-transaction budget.
     */
    const [duplicateName, clashes] = await Promise.all([
      tx.team.findFirst({
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
      }),
      /*
       * Checks the roster by student number *and* by the account each number
       * resolves to.
       *
       * The number alone was all this could do before roster lines carried an
       * identity, and a transposed digit walks straight past it: "25530061" and
       * "2553O061" look like two students. Once both lines are claimed by the
       * same account they are provably one person, and the second check catches
       * what the first cannot.
       */
      findMembershipConflicts(tx, { applicationId, challengeYear, studentIds: rosterIds }),
    ]);

    if (duplicateName) {
      throw conflict(`The team name "${trimmedName}" is already taken for this challenge.`, {
        name: ["Another team has already registered this name. Choose a different one."],
      });
    }

    if (clashes.length > 0) {
      const fieldErrors: Record<string, string[]> = {};

      for (const clash of clashes) {
        // A clash found by account rather than by number says something the
        // leader cannot see from the form: the number they typed is not the one
        // on the other team, but it is the same person.
        const message = clash.byIdentity
          ? `This student already competes with team "${clash.teamName}" under a different student number.`
          : `This student is already registered with team "${clash.teamName}".`;

        if (clash.studentId === payload.leaderStudentId) {
          fieldErrors.leaderStudentId = [message];
          continue;
        }
        const index = payload.members.findIndex((m) => m.studentId === clash.studentId);
        if (index >= 0) {
          fieldErrors[`members.${index}.studentId`] = [message];
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

    /*
     * Re-derive the account link rather than carrying it across the delete.
     *
     * Replacing the roster drops the `userId` claims with the old rows, so
     * without this a team save would silently unlink every member and the
     * identity-aware conflict check above would quietly degrade to the string
     * comparison it replaced. Re-deriving from `StudentProfile` is also more
     * correct than preserving: it picks up a member who has signed in since the
     * last save, which is the common case for a roster typed before the team
     * had accounts.
     */
    const profiles = await tx.studentProfile.findMany({
      where: { studentId: { in: rosterIds } },
      select: { userId: true, studentId: true },
    });
    const userIdByStudentId = new Map(
      profiles.map((profile) => [profile.studentId, profile.userId]),
    );

    await tx.teamMember.createMany({
      data: [
        {
          teamId: team.id,
          // The leader is the caller, so their account is known outright rather
          // than looked up.
          userId: user.id,
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
          userId: userIdByStudentId.get(member.studentId) ?? null,
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

  }, TEAM_TRANSACTION_OPTIONS);

  /*
   * Read back *outside* the transaction. `applicationInclude` pulls the team,
   * the roster, the declaration and every attachment; running that join inside
   * held a pooled connection open for a large share of the budget, to re-read
   * rows this request had just written.
   */
  const updated = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: applicationInclude,
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
 * Recognises the one collision {@link submitApplication} is allowed to retry.
 *
 * Deliberately narrow. `P2002` on `referenceNumber` means two submissions read
 * the same sequence number and the index caught the second — repeating the
 * transaction re-reads the now-higher maximum and succeeds. `P2002` on any
 * other constraint means something the caller must not paper over: the
 * one-live-entry-per-year index firing here would say the student already holds
 * another application, and retrying that forever would just burn the budget
 * before failing anyway.
 *
 * Duck-typed rather than matched against `PrismaClientKnownRequestError`,
 * for the same reason `transient.ts` walks `code` by hand: the client is
 * wrapped in an extension, and the class identity is not worth depending on.
 */
function isReferenceNumberCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const { code, meta } = error as { code?: unknown; meta?: { target?: unknown } };
  if (code !== "P2002") return false;

  // `target` is the field list on some drivers and the constraint name on
  // others, so stringify and look for the column either way.
  return JSON.stringify(meta?.target ?? "").includes("referenceNumber");
}

/**
 * Allocates the next reference number for a challenge year.
 *
 * Fixed-width zero padding makes lexicographic order match numeric order, so
 * the highest existing number can be found with a plain `ORDER BY … DESC`.
 *
 * This read-then-write is *not* safe on its own: Postgres runs at READ
 * COMMITTED, so two transactions submitting in the same instant both see the
 * same maximum and both compute the same next value. The unique index on
 * `referenceNumber` is what stops the duplicate reaching the table; the retry
 * in {@link submitApplication} is what turns that into a second attempt rather
 * than a lost submission.
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
        ? `Submissions open on ${window.opensAt ? formatDateTime(window.opensAt) : ""}.`
        : `Submissions closed on ${window.closesAt ? formatDateTime(window.closesAt) : ""}.`,
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

  const runSubmission = () =>
    prisma.$transaction(async (tx) => {
      // Re-read inside the transaction: between the completeness check and
      // here, a second tab could have submitted already.
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

  /*
   * Retry only the reference-number collision.
   *
   * Two students pressing Submit in the same instant is not a hypothetical —
   * it is what the last hour before a deadline looks like. Both transactions
   * read the same maximum, both compute the same next reference, and the
   * unique index rejects the loser. Without this the loser saw
   * "Something went wrong on our side" and their entry stayed a draft, on the
   * one evening nobody is watching the logs.
   *
   * The whole transaction is repeated rather than just the allocation, because
   * the failed one is already rolled back — there is nothing left to continue.
   * Everything inside it is idempotent from the caller's point of view: the
   * status history and audit rows from the abandoned attempt rolled back with
   * it.
   *
   * Two retries is enough. Each attempt re-reads a maximum that has, by
   * definition, just been raised by whoever won, so a third collision needs
   * three submissions inside the same few hundred milliseconds.
   */
  let result: Awaited<ReturnType<typeof runSubmission>> | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      result = await runSubmission();
      break;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS || !isReferenceNumberCollision(error)) throw error;

      console.warn(
        `[submit] reference number collision for ${applicationId}; ` +
          `retrying (attempt ${attempt + 1} of ${MAX_ATTEMPTS})`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
    }
  }

  // Unreachable: the loop either assigns or rethrows. Present so the type is
  // narrowed without a non-null assertion.
  if (!result) throw new AppError("INTERNAL", "The submission could not be completed.");

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

  /*
   * Newest first, and it matters.
   *
   * `getOrCreateDraft` treats a withdrawal as freeing the slot — it looks for
   * an entry `status: { not: WITHDRAWN }`, so a student who withdraws and
   * reopens the form gets a *second* row for the same challenge year. The
   * partial unique index allows exactly that, by design.
   *
   * This query has no such filter, and without an explicit order Postgres may
   * return either row: the dashboard could show the withdrawn entry, with its
   * old status and old reference number, while `/application` was editing the
   * new draft — and which one appeared could change between two requests.
   *
   * Ordering by `createdAt` resolves it to the same row the wizard is working
   * on, because the replacement is always created after the withdrawal.
   *
   * Withdrawn entries are deliberately *not* filtered out. A student who has
   * withdrawn and not started again should still see what happened to their
   * entry; excluding them would blank the dashboard and read as if the
   * application had been deleted.
   */
  const record = await prisma.application.findFirst({
    where: {
      ownerId: user.id,
      challengeYear: settings["challenge.year"],
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
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
