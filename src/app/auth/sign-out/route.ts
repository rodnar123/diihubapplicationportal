import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";

/**
 * POST-only so that a link prefetch, an image tag, or a cross-site request
 * cannot sign the user out. The sign-out control is a form, not an anchor.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  if (user) {
    await recordAudit({
      action: AUDIT_ACTIONS.signOut,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorEmail: user.email,
    });
  }

  return NextResponse.redirect(new URL(ROUTES.home, request.url), { status: 303 });
}
