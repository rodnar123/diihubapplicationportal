import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/auth.config";
import { ROUTES, isAuthPath, isProtectedPath } from "@/lib/routes";

/**
 * Authentication gate.
 * (Next.js 16 renamed the `middleware` file convention to `proxy`.)
 *
 * Built from the *edge-safe* config, so this runs without any database access:
 * it verifies the session JWT and nothing more. Role authorisation is not done
 * here — each protected layout re-checks the role against Prisma, which is the
 * authoritative decision and the one that reflects a revocation immediately.
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isSignedIn = Boolean(request.auth?.user);

  if (isProtectedPath(pathname) && !isSignedIn) {
    const signInUrl = new URL(ROUTES.signIn, request.url);
    // Preserve where the user was heading so they land there after signing in.
    if (pathname !== ROUTES.dashboard) {
      signInUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(signInUrl);
  }

  // A signed-in user has no reason to see the sign-in screen.
  if (isAuthPath(pathname) && isSignedIn) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Everything except static assets, image files and NextAuth's own
     * endpoints — the latter must not be gated by the gate they implement.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
