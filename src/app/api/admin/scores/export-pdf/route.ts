import { NextResponse, type NextRequest } from "next/server";

import { parseApplicationQuery } from "@/domain/admin/application-query";
import { getSessionUser, isAdmin, isReviewer } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { findApplicationsForExport } from "@/services/admin/application-query";
import { renderScoreReportPdf } from "@/services/admin/score-pdf";
import { buildScoreReport } from "@/services/admin/score-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Matches the application bundle export: chosen to deploy on any plan. */
export const maxDuration = 60;

/**
 * One page per entry rather than a whole application each, so this renders far
 * faster than the application bundle and the ceiling is correspondingly higher.
 */
const MAX_ENTRIES = 100;

/**
 * The panel's marking as a printable record, for the current filter set.
 *
 * The workbook beside this one is the same report; both are rendered from
 * `buildScoreReport`, so the two files can never disagree about a number.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user || !isReviewer(user.role)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const limit = rateLimit(`export-scores-pdf:${user.id}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many bulk exports. Please wait a few minutes." },
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
    const buffer = await renderScoreReportPdf(report);

    await recordAudit({
      action: AUDIT_ACTIONS.applicationExported,
      entityType: "Application",
      actorId: user.id,
      actorEmail: user.email,
      metadata: { format: "scores-pdf", count: ids.length, truncated },
    });

    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="challenge-scores-${stamp}.pdf"`,
        "Cache-Control": "no-store, max-age=0",
        ...(truncated ? { "X-Export-Truncated": `Limited to ${MAX_ENTRIES} entries` } : {}),
      },
    });
  } catch (error) {
    console.error("[export] score pdf failed", error);
    return NextResponse.json(
      { error: "We could not build that export. Please try again." },
      { status: 500 },
    );
  }
}
