import { NextResponse, type NextRequest } from "next/server";

import { parseApplicationQuery } from "@/domain/admin/application-query";
import { getSessionUser, isAdmin, isReviewer } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { findApplicationsForExport } from "@/services/admin/application-query";
import { renderApplicationBundlePdf } from "@/services/application/pdf-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 60 seconds is the ceiling on Vercel's Hobby plan, and a `maxDuration` above
 * the plan's limit is rejected at deploy time — so this value is chosen to
 * deploy anywhere rather than to be as generous as possible. On a plan that
 * allows longer functions this can be raised to 300, and `MAX_DOCUMENTS` with
 * it.
 */
export const maxDuration = 60;

/**
 * Each application is a multi-page render, so the batch size is set to what
 * comfortably finishes inside `maxDuration` rather than to a round number.
 * Reviewers exporting a larger set page through the filters instead.
 */
const MAX_DOCUMENTS = 25;

export async function GET(request: NextRequest) {
  const user = await getSessionUser();

  if (!user || !isReviewer(user.role)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const limit = rateLimit(`export-pdf:${user.id}`, {
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

    // Same gate as the screen: only an administrator can export the recycle bin.
    const query = isAdmin(user.role) ? parsed : { ...parsed, deleted: false };

    const { ids, truncated } = await findApplicationsForExport(query, MAX_DOCUMENTS);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "No applications match the current filters." },
        { status: 404 },
      );
    }

    const { buffer, count } = await renderApplicationBundlePdf(ids, {
      id: user.id,
      role: user.role,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.applicationExported,
      entityType: "Application",
      actorId: user.id,
      actorEmail: user.email,
      metadata: { format: "pdf-bundle", count, truncated },
    });

    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="challenge-applications-${stamp}.pdf"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store, max-age=0",
        ...(truncated
          ? { "X-Export-Truncated": `Limited to the first ${MAX_DOCUMENTS} applications` }
          : {}),
      },
    });
  } catch (error) {
    console.error("[export] pdf bundle failed", error);
    return NextResponse.json(
      { error: "We could not build that export. Please try again." },
      { status: 500 },
    );
  }
}
