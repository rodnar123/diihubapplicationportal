import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { Role } from "@/generated/prisma/enums";
import { ROUTES } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { provisionUser } from "@/services/identity/provision-user";

/**
 * Terminates the magic-link sign-in.
 *
 * Supabase has already proved the person controls the mailbox by the time we
 * get here. What is still ours to decide is whether that mailbox is *allowed*
 * to hold an account — so the domain policy runs again, server-side, and an
 * unauthorised identity is signed straight back out rather than being left
 * with a valid session and no landing page.
 */

function errorRedirect(request: NextRequest, reason: string, message?: string) {
  const url = new URL(ROUTES.authError, request.url);
  url.searchParams.set("reason", reason);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  // Only same-origin, absolute-path redirects — never an open redirect.
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeNextPath(searchParams.get("next"));

  const supabase = await createSupabaseServerClient();

  // Supabase uses the PKCE `code` flow from the browser client and the
  // `token_hash` flow when the link is opened on a different device.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return errorRedirect(request, "link_invalid", error.message);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return errorRedirect(request, "link_invalid", error.message);
    }
  } else {
    return errorRedirect(request, "link_missing");
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) {
    return errorRedirect(request, "no_identity");
  }

  const provisioned = await provisionUser({
    email: authUser.email,
    supabaseUserId: authUser.id,
    fullNameHint: (authUser.user_metadata?.full_name as string | undefined) ?? null,
  });

  if (!provisioned.ok) {
    // The session is valid but the identity is not permitted. Drop it so the
    // browser is not left holding a half-authorised cookie.
    await supabase.auth.signOut();
    await recordAudit({
      action: AUDIT_ACTIONS.signInRejected,
      entityType: "User",
      actorEmail: authUser.email,
      metadata: { reason: provisioned.reason },
    });
    return errorRedirect(request, provisioned.reason.toLowerCase(), provisioned.message);
  }

  await recordAudit({
    action: AUDIT_ACTIONS.signIn,
    entityType: "User",
    entityId: provisioned.userId,
    actorId: provisioned.userId,
    actorEmail: authUser.email,
    metadata: { role: provisioned.role, isNew: provisioned.isNew },
  });

  const destination =
    nextPath ??
    (provisioned.role === Role.STUDENT ? ROUTES.dashboard : ROUTES.admin);

  return NextResponse.redirect(new URL(destination, request.url));
}
