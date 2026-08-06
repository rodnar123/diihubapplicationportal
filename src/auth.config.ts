import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import { ROUTES } from "@/lib/routes";

/**
 * Edge-safe half of the auth configuration.
 *
 * `proxy.ts` runs in the Edge runtime and only needs to answer "is there a
 * valid session cookie?". It therefore imports *this* file rather than
 * `auth.ts`, which pulls in Prisma and would not run at the edge.
 *
 * Nothing here touches the database. The rules that do — domain enforcement
 * and user provisioning — live in `auth.ts`, which only ever runs in Node.
 */
export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          // Force the account chooser. Students routinely have a personal
          // Google account signed in already; without this they are silently
          // authenticated as that account and then rejected by the domain
          // check, which reads as "the portal is broken".
          prompt: "select_account",
          // Ask Google to restrict the chooser to Workspace accounts. This is
          // a *hint only* — `hd` is trivially removable from the URL, so the
          // authoritative check is the one in `auth.ts`.
          hd: "*",
        },
      },
      // Trim Google's profile down to what the portal actually stores.
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified ? new Date() : null,
        };
      },
    }),
  ],

  pages: {
    signIn: ROUTES.signIn,
    error: ROUTES.authError,
    signOut: ROUTES.home,
  },

  session: {
    // JWT rather than database sessions: the role is read from Prisma on every
    // request anyway, so a database session would add a second query without
    // adding a second guarantee — and a JWT lets the Edge proxy check
    // authentication without any database access at all.
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 hours
  },

  // The portal is only ever served from its own origin.
  trustHost: true,
} satisfies NextAuthConfig;
