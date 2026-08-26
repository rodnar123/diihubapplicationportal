import "server-only";

import { AppError } from "@/lib/errors";

/**
 * Fixed-window rate limiter.
 *
 * This is an in-process implementation: on a multi-instance deployment each
 * instance keeps its own counter, so the effective limit is
 * `limit x instances`. That is acceptable here because it sits *in front of*
 * limits that are already enforced centrally — Supabase Auth throttles OTP
 * sends, and the database enforces uniqueness — and its job is to stop a
 * single client hammering an endpoint, not to be a distributed quota.
 *
 * Swap `MemoryStore` for Upstash/Redis when the portal runs on more than one
 * instance and the limit needs to be exact; the `RateLimiter` interface is the
 * only thing callers depend on.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

/** Stops the map growing without bound on a long-lived server. */
function evictExpired(now: number) {
  if (store.size < 5_000) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  evictExpired(now);

  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + options.windowMs };
    store.set(key, bucket);
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  existing.count += 1;
  const allowed = existing.count <= options.limit;

  return {
    allowed,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Rate limit or throw. Use inside Server Actions, where the thrown `AppError`
 * becomes a typed failure the form can render.
 */
export function enforceRateLimit(
  key: string,
  options: { limit: number; windowMs: number; message?: string },
): void {
  const result = rateLimit(key, options);
  if (result.allowed) return;

  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  const wait = result.retryAfterSeconds < 90 ? `${result.retryAfterSeconds} seconds` : `${minutes} minutes`;

  throw new AppError(
    "RATE_LIMITED",
    options.message ?? `Too many attempts. Please try again in ${wait}.`,
  );
}

/** Shared limits, named so they are consistent across call sites. */
export const RATE_LIMITS = {
  signIn: { limit: 5, windowMs: 15 * 60 * 1000 },
  otpVerify: { limit: 10, windowMs: 15 * 60 * 1000 },
  draftSave: { limit: 120, windowMs: 60 * 1000 },
  submit: { limit: 10, windowMs: 60 * 60 * 1000 },
  upload: { limit: 30, windowMs: 10 * 60 * 1000 },
  export: { limit: 20, windowMs: 10 * 60 * 1000 },
  comment: { limit: 60, windowMs: 10 * 60 * 1000 },
  /**
   * The command palette queries as the reviewer types, so this is a
   * per-keystroke budget rather than a per-intent one. Generous enough that
   * normal typing never trips it, tight enough that a stuck client cannot sit
   * in a loop hitting the database.
   */
  paletteSearch: { limit: 120, windowMs: 60 * 1000 },
  /**
   * Deleting entries and changing who may sign in. Deliberate, low-volume work,
   * so the budget is small — an administrator clearing out a handful of test
   * entries will never notice it, and a runaway script will.
   */
  adminDestructive: { limit: 40, windowMs: 10 * 60 * 1000 },
} as const;
