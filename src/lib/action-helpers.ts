import "server-only";

import { z } from "zod";

import { AppError, actionError, actionOk, type ActionResult } from "@/lib/errors";

/**
 * Shared plumbing for Server Actions.
 *
 * Actions stay thin: parse, delegate to a service, return a typed result. The
 * helpers here make sure that a thrown `AppError` becomes a rendered message
 * and an unexpected fault becomes a log entry plus a generic apology, without
 * every action repeating the try/catch.
 */

/** Turns a Zod failure into the field-error shape the forms consume. */
export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "form";
    (fieldErrors[path] ??= []).push(issue.message);
  }

  return fieldErrors;
}

export function parseOrThrow<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  message = "Please correct the highlighted fields.",
): z.infer<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError("VALIDATION", message, { fieldErrors: zodFieldErrors(result.error) });
  }

  return result.data;
}

/**
 * Wraps an action body so every failure path returns a typed result rather
 * than throwing across the network boundary.
 */
export async function runAction<T>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return actionOk(await body());
  } catch (error) {
    return actionError(error);
  }
}

/** Normalises an optional text input: "" and whitespace become null. */
export function nullifyBlank(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
