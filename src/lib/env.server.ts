import "server-only";

import { z } from "zod";

/**
 * Server-only configuration. The `server-only` import makes any attempt to
 * pull this module into a client bundle a build-time error.
 *
 * **Nothing here throws at import time, by design.** A common and reasonable
 * deployment order is: push, let the host build once to obtain a URL, then
 * fill in the environment variables. Validating at module load broke that —
 * `next build` imports every route to collect page data, so one unset value
 * failed the whole build before the operator ever reached the settings screen.
 *
 * Instead, values are parsed leniently here and checked at the point of use
 * via {@link requireServerEnv}, which throws a message naming the variable and
 * what it is for. The result: the build always succeeds, the app always
 * deploys, and an unconfigured feature fails loudly — and only that feature —
 * the first time somebody uses it.
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

/**
 * Deliberately permissive: shape is checked in `requireServerEnv`, not here,
 * so that a malformed value cannot fail a build either.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),

  // --- Authentication (NextAuth + Google) ---------------------------------
  AUTH_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  // --- Storage -------------------------------------------------------------
  // Server-only despite the historical `NEXT_PUBLIC_` name: the bucket is
  // private and files are reached only through `/api/attachments/[id]`, so no
  // browser code needs this. Either spelling is accepted — Vercel's Supabase
  // integration injects `SUPABASE_URL`.
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("application-attachments"),

  // --- Everything below has a safe default ---------------------------------
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
  SUPABASE_URL: withoutBlanks.SUPABASE_URL ?? withoutBlanks.NEXT_PUBLIC_SUPABASE_URL,
});

// Even this cannot throw: on the (now very unlikely) parse failure we fall
// back to defaults rather than taking the process down.
export const serverEnv = parsed.success ? parsed.data : serverSchema.parse({});

export const isProduction = process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Point-of-use validation
// ---------------------------------------------------------------------------

type RequiredKey =
  | "DATABASE_URL"
  | "AUTH_SECRET"
  | "AUTH_GOOGLE_ID"
  | "AUTH_GOOGLE_SECRET"
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY";

interface Requirement {
  /** What stops working without it, in words an operator can act on. */
  purpose: string;
  /** Extra shape check applied only when a value is present. */
  check?: (value: string) => string | null;
}

const REQUIREMENTS: Record<RequiredKey, Requirement> = {
  DATABASE_URL: {
    purpose: "the database connection",
    check: (v) =>
      v.startsWith("postgres://") || v.startsWith("postgresql://")
        ? null
        : "must be a postgresql:// connection string",
  },
  AUTH_SECRET: {
    purpose: "signing sign-in sessions",
    check: (v) => (v.length >= 32 ? null : "must be at least 32 characters (npx auth secret)"),
  },
  AUTH_GOOGLE_ID: { purpose: "Google sign-in" },
  AUTH_GOOGLE_SECRET: { purpose: "Google sign-in" },
  SUPABASE_URL: {
    purpose: "file uploads and downloads",
    check: (v) =>
      /^https?:\/\//.test(v) ? null : "must be a URL like https://<project-ref>.supabase.co",
  },
  SUPABASE_SERVICE_ROLE_KEY: { purpose: "file uploads and downloads" },
};

export const REQUIRED_SERVER_ENV = Object.keys(REQUIREMENTS) as RequiredKey[];

/**
 * Reads a value that the calling feature cannot work without.
 *
 * Throws only when that feature is actually exercised, so an unconfigured
 * portal still builds, deploys and serves every page that does not depend on
 * the missing value.
 */
export function requireServerEnv(key: RequiredKey): string {
  const value = serverEnv[key];
  const requirement = REQUIREMENTS[key];

  if (!value) {
    throw new Error(
      `Configuration missing: ${key} is required for ${requirement.purpose}. ` +
        `Set it in your hosting provider's environment variables and redeploy.`,
    );
  }

  const problem = requirement.check?.(value);
  if (problem) {
    throw new Error(`Configuration invalid: ${key} ${problem}.`);
  }

  return value;
}

/** Required variables that are absent or malformed. Used for diagnostics. */
export function missingServerEnv(): Array<{ key: RequiredKey; reason: string }> {
  return REQUIRED_SERVER_ENV.flatMap((key) => {
    const value = serverEnv[key];
    if (!value) return [{ key, reason: `not set — needed for ${REQUIREMENTS[key].purpose}` }];
    const problem = REQUIREMENTS[key].check?.(value);
    return problem ? [{ key, reason: problem }] : [];
  });
}

// A single, quiet warning so an unconfigured deployment is obvious in the
// runtime logs without failing anything.
const missingAtStartup = missingServerEnv();
if (missingAtStartup.length > 0) {
  console.warn(
    [
      "",
      "[env] The portal is running with incomplete configuration.",
      ...missingAtStartup.map((entry) => `  - ${entry.key}: ${entry.reason}`),
      "  Features that need these will report an error until they are set.",
      "",
    ].join("\n"),
  );
}
