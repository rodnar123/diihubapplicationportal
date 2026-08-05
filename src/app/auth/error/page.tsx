import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Mail } from "lucide-react";

import { BrandLockup } from "@/components/brand/university-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  link_invalid: {
    title: "That sign-in link has expired",
    body: "Sign-in links can be used once and stay valid for one hour. Request a new one to continue.",
  },
  link_missing: {
    title: "Incomplete sign-in link",
    body: "The link was missing the information we need to verify it. This usually happens when an email client rewrites the address. Request a new link and open it directly.",
  },
  no_identity: {
    title: "We couldn't read your account",
    body: "The link verified, but no email address came back with it. Please request a new link.",
  },
  domain_not_allowed: {
    title: "Email address not permitted",
    body: INVALID_EMAIL_DOMAIN_MESSAGE,
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
  body: "Something went wrong while verifying your link. Please request a new one.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const detail = (reason && REASONS[reason]) || FALLBACK;

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="px-4 py-4 sm:px-6">
        <Link
          href={ROUTES.home}
          className="inline-block rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <BrandLockup />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-6 pt-2">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-6" aria-hidden />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">{detail.title}</h1>
              <p className="text-sm text-muted-foreground">{detail.body}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href={ROUTES.signIn}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Back to sign in
                </Link>
              </Button>

              {detail.showContact && (
                <Button asChild variant="outline" className="w-full">
                  <a href="mailto:challenge.admin@pnguot.ac.pg">
                    <Mail className="size-4" aria-hidden />
                    Email the challenge office
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
