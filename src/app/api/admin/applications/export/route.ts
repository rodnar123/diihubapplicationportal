import { NextResponse, type NextRequest } from "next/server";

import { parseApplicationQuery } from "@/domain/admin/application-query";
import { getSessionUser, isAdmin, isReviewer } from "@/lib/auth/session";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { findApplicationsForExport } from "@/services/admin/application-query";
import { buildApplicationsCsv } from "@/services/admin/csv-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 2000;

/**
 * CSV export of the current filter set.
 *
 * The query string is the same one the table is rendering, so what a reviewer
 * downloads always matches what they were looking at.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user || !isReviewer(user.role)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const limit = rateLimit(`export-csv:${user.id}`, RATE_LIMITS.export);
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

    // Deleted entries are an administrator's view; the screen resets the flag
    // the same way, so an export can never reach further than the table it was
    // launched from.
    const query = isAdmin(user.role) ? parsed : { ...parsed, deleted: false };

    const { ids, truncated } = await findApplicationsForExport(query, MAX_ROWS);
    const csv = await buildApplicationsCsv(ids);

    await recordAudit({
      action: AUDIT_ACTIONS.applicationExported,
      entityType: "Application",
      actorId: user.id,
      actorEmail: user.email,
      metadata: { format: "csv", count: ids.length, truncated },
    });

    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="challenge-applications-${stamp}.csv"`,
        "Cache-Control": "no-store, max-age=0",
        ...(truncated ? { "X-Export-Truncated": `Limited to ${MAX_ROWS} rows` } : {}),
      },
    });
  } catch (error) {
    console.error("[export] csv failed", error);
    return NextResponse.json(
      { error: "We could not build that export. Please try again." },
      { status: 500 },
    );
  }
}
