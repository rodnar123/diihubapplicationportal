import NextAuth from "next-auth";

import authConfig from "@/auth.config";
import { evaluateEmailPolicy, normalizeEmail } from "@/domain/identity/email";
import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { ROUTES } from "@/lib/routes";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { provisionUser } from "@/services/identity/provision-user";

/**
 * The full auth configuration — Node runtime only.
 *
 * Google proves the person controls the mailbox. Everything after that is
 * ours: whether the mailbox is *allowed* to hold an account, and what the
 * account may do. Neither answer is ever taken from a token claim.
 *
 * The JWT deliberately carries only the internal user id. Putting the role in
 * it would mean a revoked administrator kept their access until the token
 * expired; instead `getSessionUser` reads the role from Prisma on every
 * request.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  callbacks: {
    /**
     * The gate. Runs before any session exists.
     */
    async signIn({ profile, account }) {
      const email = normalizeEmail(profile?.email ?? "");

      if (!email) {
        return `${ROUTES.authError}?reason=no_identity`;
      }

      // Google asserts whether it has verified the address. An unverified one
      // proves nothing about who controls the mailbox.
      if (profile?.email_verified === false) {
        return `${ROUTES.authError}?reason=email_unverified`;
      }

      // The authoritative domain check. `hd` on the authorization request is a
      // convenience for the account chooser and can simply be deleted from the
      // URL by anyone who cares to; this is the check that decides.
      const policy = evaluateEmailPolicy(email, {
        studentDomain: clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN,
        staffDomain: serverEnv.STAFF_EMAIL_DOMAIN,
        allowStaff: true,
      });

      if (!policy.ok) {
        await recordAudit({
          action: AUDIT_ACTIONS.signInRejected,
          entityType: "User",
          actorEmail: email,
          metadata: { reason: "DOMAIN_NOT_ALLOWED", provider: account?.provider },
        });
        return `${ROUTES.authError}?reason=domain_not_allowed`;
      }

      // Create or refresh the local row. This is also where an unauthorised
      // staff address is turned away — holding a `@pnguot.ac.pg` mailbox is not
      // by itself a grant of reviewer access.
      const provisioned = await provisionUser({
        email,
        authProviderId: account?.providerAccountId ?? profile?.sub ?? null,
        fullNameHint: profile?.name ?? null,
      });

      if (!provisioned.ok) {
        await recordAudit({
          action: AUDIT_ACTIONS.signInRejected,
          entityType: "User",
          actorEmail: email,
          metadata: { reason: provisioned.reason, provider: account?.provider },
        });
        return `${ROUTES.authError}?reason=${provisioned.reason.toLowerCase()}`;
      }

      await recordAudit({
        action: AUDIT_ACTIONS.signIn,
        entityType: "User",
        entityId: provisioned.userId,
        actorId: provisioned.userId,
        actorEmail: email,
        metadata: { role: provisioned.role, isNew: provisioned.isNew, provider: "google" },
      });

      return true;
    },

    /**
     * Stamps the internal user id onto the token at sign-in. Subsequent calls
     * simply pass the token through.
     */
    async jwt({ token, profile }) {
      if (profile?.email) {
        // `provisionUser` has already run in `signIn`, so the row exists.
        const { prisma } = await import("@/lib/db/prisma");
        const user = await prisma.user.findUnique({
          where: { email: normalizeEmail(profile.email) },
          select: { id: true },
        });

        if (user) token.uid = user.id;
      }

      return token;
    },

    async session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
});
