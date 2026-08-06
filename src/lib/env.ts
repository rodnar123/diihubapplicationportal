import { z } from "zod";

/**
 * Client-safe configuration.
 *
 * `NEXT_PUBLIC_*` values must be referenced as literal `process.env.X`
 * expressions for Next.js to inline them into the client bundle — hence the
 * explicit object below instead of passing `process.env` wholesale.
 *
 * Server-only secrets live in `env.server.ts` so that importing this module
 * from a client component can never pull them into the browser bundle.
 */

const clientSchema = z.object({
  /** Storage only — Supabase no longer issues sessions. */
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("PNGUoT Student Challenge Portal"),
  NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN: z.string().min(1).default("student.pnguot.ac.pg"),
});

const parsed = clientSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN: process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid client environment configuration:\n${issues}`);
}

export const clientEnv = parsed.data;

export const STUDENT_EMAIL_DOMAIN = clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN;
export const APP_NAME = clientEnv.NEXT_PUBLIC_APP_NAME;
export const APP_URL = clientEnv.NEXT_PUBLIC_APP_URL;
