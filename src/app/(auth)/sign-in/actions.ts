"use server";

import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import {
  INVALID_EMAIL_DOMAIN_MESSAGE,
  evaluateEmailPolicy,
  isConsumerEmail,
  isStudentEmail,
  normalizeEmail,
} from "@/domain/identity/email";
import { prisma } from "@/lib/db/prisma";
import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { ROUTES } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestContext } from "@/services/audit/audit-log";

export interface SignInState {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
}

const signInSchema = z.object({
  email: z.string().trim().min(1, "Enter your university email address."),
  next: z.string().optional(),
});

/**
 * Should Supabase be allowed to create an auth identity for this address?
 *
 * Students self-register. Staff do not: a `@pnguot.ac.pg` mailbox only becomes
 * an account if it is named in `ADMIN_EMAIL_ALLOWLIST` or already exists as an
 * active reviewer. This keeps orphan auth identities out of the project.
 */
async function mayCreateIdentity(email: string): Promise<boolean> {
  if (isStudentEmail(email, clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN)) return true;
  if (serverEnv.ADMIN_EMAIL_ALLOWLIST.includes(email)) return true;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { role: true, isActive: true, deletedAt: true },
  });

  return Boolean(
    existing &&
      existing.isActive &&
      !existing.deletedAt &&
      (existing.role === Role.ADMIN || existing.role === Role.REVIEWER),
  );
}

export async function requestSignInLink(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter your email address." };
  }

  const email = normalizeEmail(parsed.data.email);

  // Authoritative domain check. The browser runs the same rule for instant
  // feedback, but this is the one that decides.
  const policy = evaluateEmailPolicy(email, {
    studentDomain: clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN,
    staffDomain: serverEnv.STAFF_EMAIL_DOMAIN,
    allowStaff: true,
  });

  if (!policy.ok) {
    return {
      status: "error",
      email,
      message: isConsumerEmail(email) ? INVALID_EMAIL_DOMAIN_MESSAGE : policy.message,
    };
  }

  // Throttle per address *and* per client so neither one can be used to spray
  // the other.
  const { ipAddress } = await requestContext();
  const byEmail = rateLimit(`signin:email:${email}`, RATE_LIMITS.signIn);
  const byIp = rateLimit(`signin:ip:${ipAddress ?? "unknown"}`, {
    limit: RATE_LIMITS.signIn.limit * 4,
    windowMs: RATE_LIMITS.signIn.windowMs,
  });

  if (!byEmail.allowed || !byIp.allowed) {
    const minutes = Math.ceil(Math.max(byEmail.retryAfterSeconds, byIp.retryAfterSeconds) / 60);
    return {
      status: "error",
      email,
      message: `Too many sign-in attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const nextPath =
    parsed.data.next && parsed.data.next.startsWith("/") && !parsed.data.next.startsWith("//")
      ? parsed.data.next
      : null;

  const callbackUrl = new URL(ROUTES.authCallback, clientEnv.NEXT_PUBLIC_APP_URL);
  if (nextPath) callbackUrl.searchParams.set("next", nextPath);

  const shouldCreateUser = await mayCreateIdentity(email);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser,
    },
  });

  if (error) {
    // A "signups not allowed" response means an unauthorised staff address.
    // Reporting that back would confirm which mailboxes have accounts, so the
    // user sees the same confirmation either way and the detail goes to the log.
    console.warn("[sign-in] Supabase rejected OTP request", {
      email,
      shouldCreateUser,
      error: error.message,
    });
  }

  return { status: "sent", email };
}
