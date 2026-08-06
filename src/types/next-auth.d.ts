import type { DefaultSession } from "next-auth";

/**
 * Module augmentation so the internal user id is typed on the session and the
 * token, rather than being read back as `any` at each call site.
 *
 * Only the id is carried. The role deliberately is not: it is read from Prisma
 * on every request so that revoking access takes effect immediately rather
 * than when the token happens to expire.
 */
declare module "next-auth" {
  interface Session {
    user: {
      /** Primary key of the row in our own `users` table. */
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Primary key of the row in our own `users` table. */
    uid?: string;
  }
}

export {};
