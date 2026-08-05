import { NextResponse, type NextRequest } from "next/server";

import { parseApplicationQuery } from "@/domain/admin/application-query";
import { getSessionUser, isReviewer } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { findApplicationsForExport } from "@/services/admin/application-query";
import { renderApplicationBundlePdf } from "@/services/application/pdf-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Rendering many application forms is slow; give it room. */
export const maxDuration = 300;

/**
 * Capped well below the CSV limit: each application is a multi-page render,
 * and a hundred is already a substantial print job.
 */
const MAX_DOCUMENTS = 100;

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
    const query = parseApplicationQuery(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

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
