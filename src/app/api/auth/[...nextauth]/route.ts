import { handlers } from "@/auth";

/**
 * NextAuth's OAuth endpoints: sign-in, the Google callback, session and CSRF.
 *
 * Node runtime — the sign-in callback provisions the user through Prisma.
 */
export const runtime = "nodejs";

export const { GET, POST } = handlers;
