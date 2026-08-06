import "server-only";

import { z } from "zod";

/**
 * Server-only configuration. The `server-only` import makes any attempt to
 * pull this module into a client bundle a build-time error.
 */

const csv = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),

  // --- Authentication (NextAuth + Google) ---------------------------------
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_GOOGLE_ID: z.string().min(1, "AUTH_GOOGLE_ID is required"),
  AUTH_GOOGLE_SECRET: z.string().min(1, "AUTH_GOOGLE_SECRET is required"),

  // --- Storage -------------------------------------------------------------
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("application-attachments"),
  STAFF_EMAIL_DOMAIN: z.string().min(1).default("pnguot.ac.pg"),
  ADMIN_EMAIL_ALLOWLIST: csv,
  ADMIN_NOTIFICATION_EMAILS: csv,
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(1).default("PNGUoT Student Challenge <no-reply@pnguot.ac.pg>"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/**
 * A variable created in a hosting dashboard but left blank arrives as `""`,
 * not `undefined`, so `.default()` would never fire. Treat blank as absent —
 * which is what anyone who left the field empty intended.
 */
const withoutBlanks = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined && value.trim() !== ""),
);

const parsed = serverSchema.safeParse(withoutBlanks);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(
    [
      "Invalid server environment configuration:",
      issues,
      "",
      "Set these in your hosting provider's environment variables and redeploy.",
      "Paste the raw value — do not wrap it in quotes.",
    ].join("\n"),
  );
}

export const serverEnv = parsed.data;

export const isProduction = serverEnv.NODE_ENV === "production";
