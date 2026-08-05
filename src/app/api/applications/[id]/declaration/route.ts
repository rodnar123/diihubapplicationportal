import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { renderDeclarationPdf } from "@/services/application/pdf-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The blank declaration a team downloads, signs by hand, and uploads again.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "You need to sign in to download this." }, { status: 401 });
  }

  const limit = rateLimit(`declaration-pdf:${user.id}`, RATE_LIMITS.export);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many downloads. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const { buffer, fileName } = await renderDeclarationPdf(id, {
      id: user.id,
      role: user.role,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[pdf] declaration render failed", { applicationId: id, error });
    return NextResponse.json(
      { error: "We could not generate that PDF. Please try again." },
      { status: 500 },
    );
  }
}
