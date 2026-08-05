import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { createAttachmentDownloadUrl } from "@/services/storage/attachment-service";

/**
 * Redirects to a short-lived signed URL for an uploaded file.
 *
 * The bucket is private, so this route is the only way to reach an object. It
 * checks the caller may see the file, records the download in the audit trail,
 * and then hands off to Supabase — the bytes never pass through the app
 * server, which keeps large prototype packages off the request path.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "You need to sign in to download this file." }, { status: 401 });
  }

  try {
    const { url } = await createAttachmentDownloadUrl(
      { id: user.id, role: user.role, email: user.email },
      id,
    );

    return NextResponse.redirect(url, {
      status: 307,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[attachments] download failed", error);
    return NextResponse.json(
      { error: "We could not prepare that download. Please try again." },
      { status: 500 },
    );
  }
}
