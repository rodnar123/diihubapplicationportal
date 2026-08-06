import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to the PNGUoT Student Challenge Application Portal with your university Google account.",
};

/**
 * NextAuth appends `?error=<code>` when it aborts before our own callback
 * runs. Anything our `signIn` callback rejects goes to `/auth/error` instead,
 * with a specific reason.
 */
const PROVIDER_ERRORS: Record<string, string> = {
  OAuthSignin: "We couldn't start the sign-in with Google. Please try again.",
  OAuthCallback: "Google didn't complete the sign-in. Please try again.",
  OAuthAccountNotLinked:
    "That email address is already registered against a different sign-in method.",
  AccessDenied: "That account is not permitted to use this portal.",
  Verification: "That sign-in link has expired. Please try again.",
  Configuration:
    "Sign-in is not configured correctly. Please contact the challenge office.",
  RateLimited: "Too many sign-in attempts from this device. Please wait a few minutes.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <Card className="print-surface">
      <CardContent className="pt-2">
        <SignInForm
          nextPath={safeNext}
          errorMessage={
            error ? (PROVIDER_ERRORS[error] ?? PROVIDER_ERRORS.OAuthCallback) : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
