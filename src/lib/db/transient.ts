import "server-only";

/**
 * Recognising a database failure that is worth trying again.
 *
 * A first-time student met "Something went wrong" on the onboarding screen
 * because the two reads behind it — the session lookup and the school list —
 * failed once. Nothing was wrong with the request, the session or the data; the
 * connection to Supabase's pooler was simply not there for that moment. A blip
 * on the first screen of the portal is the difference between an applicant and
 * a lost one, so those reads are now retried.
 *
 * The distinction that matters is *when* the failure happened, because it
 * decides whether repeating the work is safe:
 *
 *   NEVER_RAN   the connection was never established, so the statement did not
 *               reach Postgres. Safe to repeat whatever it was.
 *   INTERRUPTED the connection dropped while the statement was in flight. A
 *               read can be repeated freely; a write cannot, because it may
 *               have committed before the socket died and we would be issuing
 *               it a second time.
 *
 * Anything else — a constraint violation, a validation error, a genuine query
 * fault — is not transient and must surface immediately.
 */

export type TransientKind = "NEVER_RAN" | "INTERRUPTED";

/**
 * Prisma error codes.
 *
 * P2024 is the pool's own timeout waiting for a free connection. It belongs
 * with NEVER_RAN: the operation never got a connection, so it never ran.
 */
const NEVER_RAN_PRISMA = new Set(["P1001", "P1002", "P1011", "P2024"]);
const INTERRUPTED_PRISMA = new Set(["P1017"]);

/**
 * Node socket and DNS failures, as surfaced by the pg driver beneath Prisma.
 * A refused or unresolved connection never carried a statement.
 */
const NEVER_RAN_SYSTEM = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "ECONNABORTED",
]);
const INTERRUPTED_SYSTEM = new Set(["ECONNRESET", "EPIPE"]);

/**
 * PostgreSQL SQLSTATE classes. 08xxx is "connection exception"; 57P01 and
 * 57P02 are the server telling us it is going away, which is exactly what a
 * pooler does when it recycles a backend.
 */
const NEVER_RAN_SQLSTATE = new Set(["08001", "08004", "53300"]);
const INTERRUPTED_SQLSTATE = new Set(["08003", "08006", "57P01", "57P02"]);

/** Pooler-specific text, which arrives without a machine-readable code. */
const NEVER_RAN_PATTERNS = [
  /max client connections reached/i,
  /too many connections/i,
  /can'?t reach database server/i,
  /timed out fetching a new connection/i,
];
const INTERRUPTED_PATTERNS = [
  /connection terminated/i,
  /server closed the connection/i,
  /connection is closed/i,
];

/** Walks `cause` — Prisma wraps the driver's error, which wraps the socket's. */
function chain(error: unknown): unknown[] {
  const seen: unknown[] = [];
  let current = error;

  while (current && typeof current === "object" && seen.length < 8) {
    seen.push(current);
    current = (current as { cause?: unknown }).cause;
  }

  return seen;
}

function codesIn(error: unknown): string[] {
  return chain(error).flatMap((link) => {
    const record = link as { code?: unknown; errorCode?: unknown };
    return [record.code, record.errorCode].filter(
      (value): value is string => typeof value === "string",
    );
  });
}

function messageOf(error: unknown): string {
  return chain(error)
    .map((link) => {
      const record = link as { message?: unknown };
      return typeof record.message === "string" ? record.message : "";
    })
    .join(" | ");
}

/**
 * Classifies a failure, or returns null when it is not worth repeating.
 */
export function classifyTransient(error: unknown): TransientKind | null {
  const codes = codesIn(error);

  for (const code of codes) {
    if (NEVER_RAN_PRISMA.has(code) || NEVER_RAN_SYSTEM.has(code) || NEVER_RAN_SQLSTATE.has(code)) {
      return "NEVER_RAN";
    }
  }

  for (const code of codes) {
    if (
      INTERRUPTED_PRISMA.has(code) ||
      INTERRUPTED_SYSTEM.has(code) ||
      INTERRUPTED_SQLSTATE.has(code)
    ) {
      return "INTERRUPTED";
    }
  }

  const message = messageOf(error);
  if (NEVER_RAN_PATTERNS.some((pattern) => pattern.test(message))) return "NEVER_RAN";
  if (INTERRUPTED_PATTERNS.some((pattern) => pattern.test(message))) return "INTERRUPTED";

  return null;
}

/**
 * Prisma operations that only read. Everything absent from this list is treated
 * as a write, which is the safe way round: an operation nobody thought about
 * does not get repeated after an interrupted connection.
 */
const READ_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "queryRaw",
  "$queryRaw",
  "$queryRawUnsafe",
]);

export function isReadOperation(operation: string): boolean {
  return READ_OPERATIONS.has(operation);
}

/**
 * Whether this failure, for this operation, may be retried.
 *
 * A write is repeated only when we know it never reached Postgres. Repeating a
 * write that may already have committed would create a second application, a
 * second profile or a duplicate audit entry.
 */
export function mayRetry(error: unknown, operation: string): boolean {
  const kind = classifyTransient(error);
  if (kind === null) return false;
  if (kind === "NEVER_RAN") return true;
  return isReadOperation(operation);
}

/** Attempt count including the first try. Two retries is enough for a blip. */
export const MAX_ATTEMPTS = 3;

/**
 * Backoff before attempt `n` (1-based). Deliberately short: this runs inside a
 * request a student is waiting on, and a serverless function has a deadline.
 * The jitter stops a pooler hiccup from returning every stalled instance at the
 * same instant.
 */
export function backoffMs(attempt: number): number {
  const base = 80 * 2 ** (attempt - 1);
  return base + Math.floor(Math.random() * 60);
}
