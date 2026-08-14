"use client";

import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { clientEnv } from "@/lib/env";
import { signInWithGoogle } from "./actions";

/**
 * Google's brand mark. Inlined rather than loaded from Google's CDN because
 * the Content Security Policy restricts images to this origin — and an
 * external request on the sign-in page is one more thing that can fail.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      // `size="lg"` is only 36px tall in this button scale — fine in a toolbar,
      // under the 44px touch target for the one control this page exists for.
      className="btn-brand h-11 w-full gap-3 rounded-xl text-[0.9375rem] font-semibold"
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Redirecting to Google…
        </>
      ) : (
        <>
          {/*
            Google's brand guidelines require the coloured G to sit on white,
            whatever the button's own colour — hence the chip rather than the
            bare mark on maroon.
          */}
          <span className="flex size-6 items-center justify-center rounded-full bg-white">
            <GoogleMark />
          </span>
          Continue with Google
        </>
      )}
    </Button>
  );
}

const STUDENT_DOMAIN = clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN;
const STAFF_DOMAIN = STUDENT_DOMAIN.replace(/^student\./, "");

export function SignInForm({
  nextPath,
  errorMessage,
}: {
  nextPath?: string;
  errorMessage?: string;
}) {
  return (
    <div className="space-y-6 short:space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Sign in</h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Use your university Google account — there is no separate password for this portal.
        </p>
      </div>

      {errorMessage && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>We couldn&rsquo;t sign you in</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <form action={signInWithGoogle}>
        {nextPath && <input type="hidden" name="next" value={nextPath} />}
        <SubmitButton />
      </form>

      {/*
        Eligibility is the one thing a rejected visitor needs to read, so it
        stays in the card at every width rather than moving into the brand
        panel — which is hidden on a phone, where most of these sign-ins
        happen.
      */}
      <div className="space-y-2.5 rounded-xl border bg-muted/60 p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Who can sign in
        </p>
        <dl className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="text-sm font-medium">Students</dt>
            <dd>
              <code className="rounded-md bg-background px-1.5 py-0.5 font-mono text-xs ring-1 ring-border">
                @{STUDENT_DOMAIN}
              </code>
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="text-sm font-medium">Staff</dt>
            <dd className="flex flex-wrap items-baseline gap-x-2">
              <code className="rounded-md bg-background px-1.5 py-0.5 font-mono text-xs ring-1 ring-border">
                @{STAFF_DOMAIN}
              </code>
              <span className="text-xs text-muted-foreground">challenge office only</span>
            </dd>
          </div>
        </dl>
        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
          Personal Gmail addresses are rejected. If Google offers you a personal account, pick
          your university one instead.
        </p>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          We receive only your name, email address and profile picture from Google. Sign-in
          attempts are logged.
        </span>
      </p>
    </div>
  );
}
