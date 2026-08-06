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
  // Server-only despite the historical `NEXT_PUBLIC_` name: the bucket is
  // private and reached solely through `/api/attachments/[id]`, so no browser
  // code ever needs this. Either name is accepted — Vercel's Supabase
  // integration injects `SUPABASE_URL`, while a hand-configured project
  // usually has `NEXT_PUBLIC_SUPABASE_URL`.
  SUPABASE_URL: z.url(
    "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) must be a valid URL, e.g. https://<project-ref>.supabase.co",
  ),
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

const parsed = serverSchema.safeParse({
  ...withoutBlanks,
  // Accept either spelling of the Supabase project URL.
  SUPABASE_URL: withoutBlanks.SUPABASE_URL ?? withoutBlanks.NEXT_PUBLIC_SUPABASE_URL,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  // Which of the expected names the build environment can actually see.
  // Names only — never values, since several of these are secrets.
  const expected = [
    "DATABASE_URL",
    "DIRECT_URL",
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
  ];
  const visibility = expected
    .map((name) => `  ${withoutBlanks[name] ? "[set]    " : "[MISSING]"} ${name}`)
    .join("\n");

  // Printed as well as thrown: a thrown build-time error is rendered as a code
  // frame, which can bury the message that names the offending variable.
  console.error(
    `\n[env] Invalid server environment configuration:\n${issues}\n\n[env] Variables visible to this build:\n${visibility}\n`,
  );

  throw new Error(
    [
      "Invalid server environment configuration:",
      issues,
      "",
      "Variables visible to this build:",
      visibility,
      "",
      "Set the missing values in your hosting provider and redeploy.",
      "Paste the raw value — do not wrap it in quotes.",
      "On Vercel, tick Production, Preview and Development so previews build too.",
    ].join("\n"),
  );
}

export const serverEnv = parsed.data;

export const isProduction = serverEnv.NODE_ENV === "production";
