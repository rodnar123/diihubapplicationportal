"use client";

import { unstable_rethrow } from "next/navigation";

import type { ActionResult } from "@/lib/errors";

/**
 * Calls a Server Action from a client component without letting a transport
 * failure destroy the page.
 *
 * `runAction` already turns every *application* failure into a resolved
 * `ActionResult`, so an action that rejects means the call never completed:
 * the function returned 500, the deployment moved and the action id no longer
 * resolves, the connection dropped, or the platform timed out. Awaiting that
 * rejection directly inside `startTransition` re-throws it during the
 * transition, where React has no handler for it, so it escalates to
 * `app/error.tsx` — the student loses the whole form and everything typed into
 * it, and the console shows only a redacted React error.
 *
 * A form that cannot reach the server should say so and stay on screen. The
 * detail goes to the console, and the matching stack is in the server log via
 * `instrumentation.ts`.
 */
export async function callAction<T>(
  invoke: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await invoke();
  } catch (error) {
    // `redirect()` and `notFound()` travel as thrown errors; they are
    // navigation, not failure, and Next.js must be allowed to handle them.
    unstable_rethrow(error);

    console.error("[action] could not reach the server", error);

    return {
      ok: false,
      code: "INTERNAL",
      message:
        "We could not reach the server. Your details have not been saved — " +
        "check your connection and try again.",
    };
  }
}
