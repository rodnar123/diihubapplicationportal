import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import type { UserQuery } from "@/domain/admin/user-query";
import { isStudentEmail } from "@/domain/identity/email";
import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { clientEnv } from "@/lib/env";
import { forbidden, invalidState, notFound } from "@/lib/errors";
import { AUDIT_ACTIONS, recordAuditTx, requestContext } from "@/services/audit/audit-log";

/**
 * The user directory and the operations an administrator can perform on it.
 *
 * Access to the portal is decided by the `users` table, not by the identity
 * provider (see `provision-user`), so this module *is* the access-control
 * surface: a role change here takes effect on the account's next request,
 * because `getSessionUser` re-reads the row every time rather than trusting a
 * token claim.
 */

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  deletedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  /** Null for staff, who have no student profile. */
  studentId: string | null;
  schoolName: string | null;
  sectionName: string | null;
  /** Live entries this account owns. Shown so a deletion is an informed one. */
  applicationCount: number;
}

export interface AdminUserPage {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Live administrators, so the UI can explain why the last one is protected. */
  activeAdminCount: number;
}

function buildUserWhere(query: UserQuery): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  if (query.role.length > 0) and.push({ role: { in: query.role } });

  if (query.status.length > 0) {
    // The three lifecycle states are mutually exclusive, so a multi-select
    // becomes a union rather than an intersection.
    const or: Prisma.UserWhereInput[] = [];
    if (query.status.includes("active")) or.push({ deletedAt: null, isActive: true });
    if (query.status.includes("inactive")) or.push({ deletedAt: null, isActive: false });
    if (query.status.includes("deleted")) or.push({ deletedAt: { not: null } });
    and.push({ OR: or });
  } else {
    // Deleted accounts are opt-in; the directory is about people who are here.
    and.push({ deletedAt: null });
  }

  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { studentProfile: { studentId: { contains: query.q, mode: "insensitive" } } },
        { studentProfile: { surname: { contains: query.q, mode: "insensitive" } } },
        { studentProfile: { firstName: { contains: query.q, mode: "insensitive" } } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  deletedAt: true,
  lastLoginAt: true,
  createdAt: true,
  studentProfile: {
    select: {
      studentId: true,
      school: { select: { name: true } },
      section: { select: { name: true } },
    },
  },
  _count: { select: { applications: { where: { deletedAt: null } } } },
} satisfies Prisma.UserSelect;

export async function findUsers(query: UserQuery): Promise<AdminUserPage> {
  const where = buildUserWhere(query);
  const pageSize = query.size;

  const [total, activeAdminCount] = await Promise.all([
    prisma.user.count({ where }),
    countActiveAdmins(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // A filter change can leave the administrator past the end of the new set.
  const page = Math.min(query.page, pageCount);

  const records = await prisma.user.findMany({
    where,
    select: userSelect,
    /*
     * Staff first, then newest account: the handful of people who can act on
     * the portal are what an administrator is usually here to check, and they
     * would otherwise be buried under every student who has ever signed in.
     *
     * `desc`, not `asc`. Postgres orders an enum by its *declaration* order —
     * STUDENT, REVIEWER, ADMIN — so ascending puts students at the top, which
     * is precisely backwards.
     */
    orderBy: [{ role: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    rows: records.map((record) => ({
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
      isActive: record.isActive,
      deletedAt: record.deletedAt?.toISOString() ?? null,
      lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      studentId: record.studentProfile?.studentId ?? null,
      schoolName: record.studentProfile?.school?.name ?? null,
      sectionName: record.studentProfile?.section?.name ?? null,
      applicationCount: record._count.applications,
    })),
    total,
    page,
    pageSize,
    pageCount,
    activeAdminCount,
  };
}

function countActiveAdmins(): Promise<number> {
  return prisma.user.count({
    where: { role: Role.ADMIN, isActive: true, deletedAt: null },
  });
}

function assertAdmin(actor: SessionUser): void {
  if (actor.role !== Role.ADMIN) {
    throw forbidden("Only an administrator can manage user accounts.");
  }
}

/**
 * Blocks an administrator from acting on their own account.
 *
 * Not paternalism: every one of these operations ends the actor's own access
 * mid-request, and the recovery path is a database edit. Another administrator
 * can always do it for them.
 */
function assertNotSelf(actor: SessionUser, targetId: string, verb: string): void {
  if (actor.id === targetId) {
    throw invalidState(
      `You cannot ${verb} your own account. Ask another administrator to do it.`,
    );
  }
}

/**
 * Refuses anything that would leave the portal with no administrator.
 *
 * Settings, the audit log, user management and deletion are all admin-only, so
 * an empty admin set is not a degraded portal — it is one nobody can administer
 * again without database access.
 */
async function assertNotLastAdmin(target: {
  id: string;
  role: Role;
  isActive: boolean;
  deletedAt: Date | null;
}): Promise<void> {
  const isLiveAdmin = target.role === Role.ADMIN && target.isActive && !target.deletedAt;
  if (!isLiveAdmin) return;

  if ((await countActiveAdmins()) <= 1) {
    throw invalidState(
      "This is the only active administrator. Promote somebody else first, " +
        "otherwise nobody could reach the settings, the audit log or this page.",
    );
  }
}

async function loadTarget(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      deletedAt: true,
      studentProfile: { select: { id: true } },
    },
  });

  if (!user) throw notFound("That account no longer exists.");
  return user;
}

export async function updateUserRole(
  actor: SessionUser,
  userId: string,
  role: Role,
): Promise<{ id: string; role: Role }> {
  assertAdmin(actor);
  assertNotSelf(actor, userId, "change the role of");

  const target = await loadTarget(userId);

  if (target.deletedAt) {
    throw invalidState("Restore this account before changing its role.");
  }

  if (target.role === role) {
    throw invalidState(`That account is already a ${role.toLowerCase()}.`);
  }

  /*
   * A student account is one that can file an entry, and Section A of the form
   * is built from a student profile. Handing the student role to a staff
   * mailbox that has never had one strands them at onboarding being asked for a
   * student number they do not have.
   */
  if (
    role === Role.STUDENT &&
    !target.studentProfile &&
    !isStudentEmail(target.email, clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN)
  ) {
    throw invalidState(
      "This is a staff address with no student profile, so it cannot be made a student. " +
        "Deactivate the account instead if it should lose access.",
    );
  }

  // Demoting the last administrator is the same loss of control as deleting
  // them, so it goes through the same guard.
  if (role !== Role.ADMIN) await assertNotLastAdmin(target);

  const { ipAddress, userAgent } = await requestContext();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role } });

    await recordAuditTx(tx, {
      action: AUDIT_ACTIONS.userRoleChanged,
      entityType: "User",
      entityId: userId,
      actorId: actor.id,
      actorEmail: actor.email,
      metadata: { targetEmail: target.email, from: target.role, to: role },
      ipAddress,
      userAgent,
    });
  });

  return { id: userId, role };
}

/**
 * Suspends or reinstates an account.
 *
 * A deactivated user keeps everything they own; they simply stop being able to
 * sign in — `getSessionUser` treats an inactive row as anonymous, so any
 * session they already hold stops working on the next request too.
 */
export async function setUserActive(
  actor: SessionUser,
  userId: string,
  isActive: boolean,
): Promise<{ id: string; isActive: boolean }> {
  assertAdmin(actor);
  assertNotSelf(actor, userId, isActive ? "reactivate" : "deactivate");

  const target = await loadTarget(userId);

  if (target.deletedAt) {
    throw invalidState("Restore this account before changing whether it is active.");
  }

  if (target.isActive === isActive) {
    throw invalidState(
      isActive ? "That account is already active." : "That account is already deactivated.",
    );
  }

  if (!isActive) await assertNotLastAdmin(target);

  const { ipAddress, userAgent } = await requestContext();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isActive } });

    await recordAuditTx(tx, {
      action: isActive ? AUDIT_ACTIONS.userActivated : AUDIT_ACTIONS.userDeactivated,
      entityType: "User",
      entityId: userId,
      actorId: actor.id,
      actorEmail: actor.email,
      metadata: { targetEmail: target.email, role: target.role },
      ipAddress,
      userAgent,
    });
  });

  return { id: userId, isActive };
}

/**
 * Soft-deletes an account.
 *
 * As everywhere else in this schema, the row stays: the audit trail has to be
 * able to name who did what, and the applications, comments and decisions this
 * person left behind all point at it. `getSessionUser` and `provisionUser` both
 * treat a soft-deleted row as no account at all, so access ends immediately and
 * signing in again does not quietly resurrect it.
 *
 * The applications they own are deliberately left alone — deleting a person's
 * account is not a decision about their team's entry. Delete the entry from the
 * applications console if that is also what you mean.
 */
export async function softDeleteUser(
  actor: SessionUser,
  userId: string,
  reason: string | null,
): Promise<{ id: string; email: string }> {
  assertAdmin(actor);
  assertNotSelf(actor, userId, "delete");

  const target = await loadTarget(userId);

  if (target.deletedAt) {
    throw invalidState("That account has already been deleted.");
  }

  await assertNotLastAdmin(target);

  const { ipAddress, userAgent } = await requestContext();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      // Deactivated as well as deleted, so nothing has to remember that
      // `deletedAt` implies "may not sign in" — both gates are shut.
      data: { deletedAt: new Date(), isActive: false },
    });

    await recordAuditTx(tx, {
      action: AUDIT_ACTIONS.userDeleted,
      entityType: "User",
      entityId: userId,
      actorId: actor.id,
      actorEmail: actor.email,
      metadata: {
        targetEmail: target.email,
        targetName: target.name,
        role: target.role,
        reason,
      },
      ipAddress,
      userAgent,
    });
  });

  return { id: userId, email: target.email };
}

/**
 * Reverses a deletion, returning the account in the deactivated state rather
 * than straight back to active: restoring is undoing a mistake, and letting
 * somebody back in is a second, separate decision.
 */
export async function restoreUser(
  actor: SessionUser,
  userId: string,
): Promise<{ id: string; email: string }> {
  assertAdmin(actor);

  const target = await loadTarget(userId);

  if (!target.deletedAt) {
    throw invalidState("That account has not been deleted.");
  }

  const { ipAddress, userAgent } = await requestContext();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { deletedAt: null, isActive: false },
    });

    await recordAuditTx(tx, {
      action: AUDIT_ACTIONS.userRestored,
      entityType: "User",
      entityId: userId,
      actorId: actor.id,
      actorEmail: actor.email,
      metadata: { targetEmail: target.email, role: target.role },
      ipAddress,
      userAgent,
    });
  });

  return { id: userId, email: target.email };
}
