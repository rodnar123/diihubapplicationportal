import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Mail } from "lucide-react";

import { AuthCard, AuthCardHeading } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { INVALID_EMAIL_DOMAIN_MESSAGE } from "@/domain/identity/email";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Sign-in problem",
  robots: { index: false, follow: false },
};

/**
 * Copy for each rejection reason. Anything unrecognised falls back to the
 * generic case rather than echoing an attacker-supplied string to the page.
 */
const REASONS: Record<string, { title: string; body: string; showContact?: boolean }> = {
  no_identity: {
    title: "We couldn't read your account",
    body: "Google completed the sign-in but did not return an email address. Please try again, and make sure you grant access to your email when prompted.",
  },
  email_unverified: {
    title: "Email address not verified",
    body: "Google reports that this address has not been verified. Verify it with Google, or sign in with your university account instead.",
  },
  domain_not_allowed: {
    title: "Account not permitted",
    body: `${INVALID_EMAIL_DOMAIN_MESSAGE} You appear to have signed in with a personal Google account — choose your university account from the account chooser and try again.`,
  },
  staff_not_authorised: {
    title: "Staff access not granted",
    body: "This staff account has not been granted access to the challenge portal. Contact the challenge office to be added to the review panel.",
    showContact: true,
  },
  account_disabled: {
    title: "Account deactivated",
    body: "This account has been deactivated. Contact the challenge office if you believe this is a mistake.",
    showContact: true,
  },
};

const FALLBACK: (typeof REASONS)[string] = {
  title: "We couldn't complete your sign-in",
  body: "Something went wrong while signing you in with Google. Please try again.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; error?: string }>;
}) {
  // `reason` comes from our own sign-in callback; `error` is NextAuth's own
  // code for failures that happen before that callback runs.
  const { reason, error } = await searchParams;
  const detail =
    (reason && REASONS[reason]) ||
    (error === "AccessDenied" ? REASONS.domain_not_allowed : undefined) ||
    FALLBACK;

  return (
    <AuthShell>
      <AuthCard>
        <div className="space-y-6">
          <AuthCardHeading icon={AlertTriangle} title={detail.title}>
            {detail.body}
          </AuthCardHeading>

          <div className="flex flex-col gap-2">
            <Button
              asChild
              className="btn-brand h-11 w-full rounded-xl text-[0.9375rem] font-semibold"
            >
              <Link href={ROUTES.signIn}>
                <ArrowLeft className="size-4" aria-hidden />
                Back to sign in
              </Link>
            </Button>

            {detail.showContact && (
              <Button asChild variant="outline" className="h-11 w-full rounded-xl text-sm">
                <a href="mailto:challenge.admin@pnguot.ac.pg">
                  <Mail className="size-4" aria-hidden />
                  Email the challenge office
                </a>
              </Button>
            )}
          </div>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
