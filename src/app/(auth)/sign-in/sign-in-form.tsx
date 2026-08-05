"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Loader2, MailCheck, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  INVALID_EMAIL_DOMAIN_MESSAGE,
  evaluateEmailPolicy,
  isConsumerEmail,
} from "@/domain/identity/email";
import { clientEnv } from "@/lib/env";
import { ROUTES } from "@/lib/routes";
import { requestSignInLink, type SignInState } from "./actions";

const INITIAL_STATE: SignInState = { status: "idle" };

const STUDENT_DOMAIN = clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN;

export function SignInForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, isPending] = useActionState(requestSignInLink, INITIAL_STATE);
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const emailId = useId();
  const hintId = useId();

  // Live domain feedback so a student is told *before* submitting that a Gmail
  // address will not work.
  const clientPolicy = email.trim() ? evaluateEmailPolicy(email, { studentDomain: STUDENT_DOMAIN }) : null;
  const showClientError = touched && clientPolicy?.ok === false;
  const clientMessage = showClientError
    ? isConsumerEmail(email)
      ? INVALID_EMAIL_DOMAIN_MESSAGE
      : clientPolicy.message
    : undefined;

  if (state.status === "sent") {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
          <MailCheck className="size-7" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            We sent a secure sign-in link to{" "}
            <span className="font-medium text-foreground">{state.email}</span>. The link is valid for
            one hour and can be used once.
          </p>
        </div>
        <Alert>
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Not seeing it?</AlertTitle>
          <AlertDescription>
            Check your spam or junk folder. University mail can take a minute or two to arrive.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full">
          <Link href={ROUTES.signIn}>Use a different email address</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use your official university email account. We&rsquo;ll email you a secure link — there is
          no password to remember.
        </p>
      </div>

      {state.status === "error" && state.message && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>We couldn&rsquo;t sign you in</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="space-y-5" noValidate>
        {nextPath && <input type="hidden" name="next" value={nextPath} />}

        <Field data-invalid={showClientError || undefined}>
          <FieldLabel htmlFor={emailId}>University email address</FieldLabel>
          <Input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            spellCheck={false}
            placeholder={`25530061jose@${STUDENT_DOMAIN}`}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setTouched(true)}
            aria-describedby={hintId}
            aria-invalid={showClientError || undefined}
          />
          <FieldDescription id={hintId}>
            Students sign in with <code className="font-mono">@{STUDENT_DOMAIN}</code>. Personal
            accounts such as Gmail, Yahoo or Outlook are not accepted.
          </FieldDescription>
          {clientMessage && <FieldError>{clientMessage}</FieldError>}
        </Field>

        <Button type="submit" className="w-full" disabled={isPending || clientPolicy?.ok === false}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Sending link…
            </>
          ) : (
            <>
              Email me a sign-in link
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </Button>
      </form>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Access is restricted to members of the university. Sign-in attempts are logged.
        </span>
      </p>
    </div>
  );
}
