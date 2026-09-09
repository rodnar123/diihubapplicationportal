import { NextResponse, type NextRequest } from "next/server";

import { parseApplicationQuery } from "@/domain/admin/application-query";
import { getSessionUser, isAdmin, isReviewer } from "@/lib/auth/session";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { findApplicationsForExport } from "@/services/admin/application-query";
import { buildScoreReport } from "@/services/admin/score-report";
import { buildScoreWorkbook } from "@/services/admin/score-workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The panel's marking as a workbook, for the current filter set.
 *
 * Same contract as the application exports beside it: the query string is the
 * one the table is rendering, so a reviewer downloads what they were looking
 * at, and only an administrator can reach deleted entries.
 */

/**
 * A tab per entry, each holding the whole rubric. Well below what exceljs can
 * write, and set instead by what a reader can open and navigate — a workbook of
 * two hundred tabs is a file nobody opens twice.
 */
const MAX_ENTRIES = 100;

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user || !isReviewer(user.role)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const limit = rateLimit(`export-scores-xlsx:${user.id}`, RATE_LIMITS.export);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const parsed = parseApplicationQuery(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const query = isAdmin(user.role) ? parsed : { ...parsed, deleted: false };
    const { ids, truncated } = await findApplicationsForExport(query, MAX_ENTRIES);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "No applications match the current filters." },
        { status: 404 },
      );
    }

    const report = await buildScoreReport(ids);
    const workbook = await buildScoreWorkbook(report);

    await recordAudit({
      action: AUDIT_ACTIONS.applicationExported,
      entityType: "Application",
      actorId: user.id,
      actorEmail: user.email,
      metadata: { format: "scores-xlsx", count: ids.length, truncated },
    });

    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="challenge-scores-${stamp}.xlsx"`,
        "Cache-Control": "no-store, max-age=0",
        ...(truncated ? { "X-Export-Truncated": `Limited to ${MAX_ENTRIES} entries` } : {}),
      },
    });
  } catch (error) {
    console.error("[export] score workbook failed", error);
    return NextResponse.json(
      { error: "We could not build that export. Please try again." },
      { status: 500 },
    );
  }
}
