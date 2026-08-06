"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { ROUTES } from "@/lib/routes";

/**
 * Starts the Google OAuth flow.
 *
 * A Server Action rather than a client-side `signIn()` call: the POST is
 * origin-checked by Next.js, so the redirect to Google cannot be initiated
 * cross-site.
 */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const requested = formData.get("next");
  const nextPath =
    typeof requested === "string" && requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : ROUTES.dashboard;

  // Throttle per client so the OAuth start endpoint cannot be used to spray
  // Google with authorisation requests.
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "unknown";

  const limit = rateLimit(`oauth-start:${ip}`, {
    limit: RATE_LIMITS.signIn.limit * 4,
    windowMs: RATE_LIMITS.signIn.windowMs,
  });

  if (!limit.allowed) {
    // A plain `<form action>` cannot receive a return value, so the failure is
    // reported by navigating back to the sign-in page with an error code.
    redirect(`${ROUTES.signIn}?error=RateLimited`);
  }

  // `signIn` throws a redirect; nothing after it runs.
  await signIn("google", { redirectTo: nextPath });
}
