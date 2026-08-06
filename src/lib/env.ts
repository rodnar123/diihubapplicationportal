import { z } from "zod";

/**
 * Client-safe configuration.
 *
 * `NEXT_PUBLIC_*` values must be referenced as literal `process.env.X`
 * expressions for Next.js to inline them into the client bundle — hence the
 * explicit object below instead of passing `process.env` wholesale.
 *
 * **Every value here has a default, deliberately.** The one page this app
 * prerenders (`/_not-found`) pulls in the root layout, which imports this
 * module, so anything required here becomes a hard build-time dependency for
 * the whole build. Configuration that is genuinely mandatory belongs in
 * `env.server.ts`, where a missing value fails with a message naming the
 * route that needed it — not with "Failed to collect page data for
 * /_not-found", which tells you nothing.
 *
 * Server-only secrets live in `env.server.ts` so that importing this module
 * from a client component can never pull them into the browser bundle.
 */

/**
 * A variable created in a hosting dashboard but left blank arrives as `""`,
 * not `undefined` — so `.default()` would never fire and a deliberately
 * deferred value would fail the build instead of falling back. Treat blank as
 * absent, which is what anyone setting it would expect.
 */
const blankAsUndefined = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("PNGUoT Student Challenge Portal"),
  NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN: z.string().min(1).default("student.pnguot.ac.pg"),
});

const parsed = clientSchema.safeParse({
  NEXT_PUBLIC_APP_URL: blankAsUndefined(process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_APP_NAME: blankAsUndefined(process.env.NEXT_PUBLIC_APP_NAME),
  NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN: blankAsUndefined(
    process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN,
  ),
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  // Printed as well as thrown: Next.js renders a code frame for a thrown
  // build-time error, which can bury the message that actually names the
  // offending variable.
  console.error(`\n[env] Invalid client environment configuration:\n${issues}\n`);

  throw new Error(
    [
      "Invalid client environment configuration:",
      issues,
      "",
      "Every client variable has a default, so this means a value was set but malformed.",
      "Paste the raw value — do not wrap it in quotes.",
    ].join("\n"),
  );
}

export const clientEnv = parsed.data;

export const STUDENT_EMAIL_DOMAIN = clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN;
export const APP_NAME = clientEnv.NEXT_PUBLIC_APP_NAME;
export const APP_URL = clientEnv.NEXT_PUBLIC_APP_URL;
