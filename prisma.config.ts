import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * CLI-side Prisma configuration (migrate / studio / seed).
 *
 * Migrations must run over a *direct* connection — PgBouncer's transaction
 * pooling cannot handle the advisory locks and DDL that Migrate issues — so we
 * prefer DIRECT_URL and only fall back to DATABASE_URL for local Postgres
 * setups where the two are the same.
 *
 * The application runtime does not read this file; it connects through the
 * `@prisma/adapter-pg` driver adapter in `src/lib/db/prisma.ts`.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
