import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { MAX_ATTEMPTS, backoffMs, mayRetry } from "@/lib/db/transient";

/**
 * Prisma 7 connects through a driver adapter rather than the bundled query
 * engine, so the pool is configured here.
 *
 * In development Next.js hot-reloads modules on every edit; without the global
 * cache each reload would open a fresh pool and exhaust the database's
 * connection limit within minutes.
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    /*
     * Supabase's transaction pooler multiplexes on its own, so the pool this
     * side of it wants to be small: what it holds is multiplied by however many
     * serverless instances Vercel has warm, and the pooler counts every one of
     * them. This was 10, which is a lot of sockets per instance to leave open
     * against a shared pooler.
     *
     * Not 1, though — several pages open with `Promise.all` over three or four
     * independent reads, and a pool of one serialises every such render. Three
     * keeps those parallel while leaving the pooler room.
     */
    max: process.env.NODE_ENV === "production" ? 3 : 5,
    /*
     * A pooler that recycles a backend can leave a socket that looks alive and
     * is not. TCP keepalive gets the failure reported as a connection error —
     * which `mayRetry` can then classify — rather than as a request that hangs
     * until the function times out.
     */
    keepAlive: true,
    /*
     * Bounded so a stalled connect surfaces as a retryable error well inside
     * the serverless deadline, instead of waiting indefinitely (pg's default).
     */
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? [{ level: "warn", emit: "stdout" }, { level: "error", emit: "stdout" }]
        : [{ level: "error", emit: "stdout" }],
  });

  /*
   * Retry a query the connection lost, rather than turning it into an error
   * page.
   *
   * This sits at the client so every caller gets it — the alternative, a helper
   * each service remembers to wrap its reads in, is one that eventually nobody
   * remembers. `mayRetry` decides what is safe to repeat: see `transient.ts`,
   * which will not repeat a write that might already have committed.
   */
  return client.$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        let lastError: unknown;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
          try {
            return await query(args);
          } catch (error) {
            lastError = error;

            if (attempt === MAX_ATTEMPTS || !mayRetry(error, operation)) throw error;

            console.warn(
              `[db] ${operation} failed with a transient connection error; ` +
                `retrying (attempt ${attempt + 1} of ${MAX_ATTEMPTS})`,
            );
            await sleep(backoffMs(attempt));
          }
        }

        throw lastError;
      },
    },
  });
};

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

/**
 * The client handed to a `$transaction` callback.
 *
 * `Prisma.TransactionClient` describes the *unextended* client, so it no longer
 * matches what `$transaction` yields now that the retry extension is applied.
 * Helpers that take a `tx` should use this instead — mirroring Prisma's own
 * definition, which is the client minus the methods a transaction forbids.
 */
export type DbTransactionClient = Omit<
  PrismaClientInstance,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined;
};

export const prisma: PrismaClientInstance = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
