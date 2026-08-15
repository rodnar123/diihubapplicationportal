import { NextResponse } from "next/server";

import { missingServerEnv } from "@/lib/env.server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment health check.
 *
 * Exists because configuration is now validated at point of use rather than
 * at build time: the site deploys whether or not it is fully configured, so
 * there needs to be one place that answers "what is still missing?" without
 * having to trigger the broken feature to find out.
 *
 * Reports variable **names** and connectivity only — never values. It is
 * deliberately unauthenticated, because it is most useful before anyone can
 * sign in; nothing it returns is a secret, and it reveals no more than
 * attempting to use the site would.
 */

/**
 * Describes a failed database check without repeating what the driver said.
 *
 * The raw message cannot be passed through here. Prisma's connection errors
 * name the host — "Can't reach database server at db.example.internal" — and
 * this endpoint answers to anyone. It previously took
 * `message.split("\n")[0]`, which happened to return an empty string because
 * the message opens with a newline: the outage branch reported nothing at all,
 * while the obvious repair would have published the hostname.
 *
 * So the shape of the failure is classified into a fixed phrase and the real
 * error goes to the server log, where whoever is fixing the deployment can
 * already see it.
 */
function describeDatabaseFailure(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("can't reach") || message.includes("connection refused")) {
    return "cannot reach the database server";
  }
  if (message.includes("authentication") || message.includes("password")) {
    return "the database rejected the credentials";
  }
  if (message.includes("timed out") || message.includes("timeout")) {
    return "the connection timed out";
  }
  if (message.includes("does not exist")) {
    return "the database or schema does not exist";
  }
  return "connection failed";
}

export async function GET() {
  const missing = missingServerEnv();

  let database: { ok: boolean; detail: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, detail: "connected" };
  } catch (error) {
    console.error("[health] database check failed", error);
    database = { ok: false, detail: describeDatabaseFailure(error) };
  }

  const configured = missing.length === 0;
  const healthy = configured && database.ok;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "incomplete",
      configuration: configured
        ? "complete"
        : missing.map((entry) => `${entry.key}: ${entry.reason}`),
      database,
      hint: healthy
        ? undefined
        : "Set the variables listed above in your hosting provider, then redeploy.",
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
