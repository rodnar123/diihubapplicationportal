import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 connects through a driver adapter rather than the bundled query
 * engine, so the pool is configured here.
 *
 * In development Next.js hot-reloads modules on every edit; without the global
 * cache each reload would open a fresh pool and exhaust the database's
 * connection limit within minutes.
 */

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Supabase's transaction pooler caps connections per client; keeping the
    // pool small leaves headroom for concurrent serverless instances.
    max: process.env.NODE_ENV === "production" ? 10 : 5,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? [{ level: "warn", emit: "stdout" }, { level: "error", emit: "stdout" }]
        : [{ level: "error", emit: "stdout" }],
  });
};

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined;
};

export const prisma: PrismaClientInstance = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
