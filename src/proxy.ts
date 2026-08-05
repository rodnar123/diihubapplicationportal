import { NextResponse, type NextRequest } from "next/server";

import { ROUTES, isAuthPath, isProtectedPath } from "@/lib/routes";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Session refresh plus a coarse authentication gate.
 * (Next.js 16 renamed the `middleware` file convention to `proxy`.)
 *
 * Role checks are *not* done here: the Edge runtime has no database access, so
 * asking "is this user an administrator?" would mean trusting an unverified
 * claim. Each protected layout re-checks the role against Prisma, which is the
 * authoritative decision.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);
  const { pathname, search } = request.nextUrl;

  if (isProtectedPath(pathname) && !user) {
    const signInUrl = new URL(ROUTES.signIn, request.url);
    // Preserve where the user was heading so they land there after signing in.
    if (pathname !== ROUTES.dashboard) {
      signInUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(signInUrl);
  }

  // A signed-in user has no reason to see the sign-in screen.
  if (isAuthPath(pathname) && user) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. The auth callback is
     * intentionally included so the session cookie it sets is refreshed
     * consistently.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
