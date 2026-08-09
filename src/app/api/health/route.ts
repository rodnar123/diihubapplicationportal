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
export async function GET() {
  const missing = missingServerEnv();

  let database: { ok: boolean; detail: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, detail: "connected" };
  } catch (error) {
    database = {
      ok: false,
      detail: error instanceof Error ? error.message.split("\n")[0] : "connection failed",
    };
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
