import type { Instrumentation } from "next";

/**
 * Server-error reporting.
 *
 * In a production build React replaces every server-side error with a redacted
 * placeholder — the browser only ever sees "Minified React error #441" and a
 * digest. That is the correct thing to send a student, but it left us with no
 * way to tell *what* failed, or even *which request* failed: a Server Action
 * that throws and a page that throws while re-rendering after that action look
 * identical from the console.
 *
 * `onRequestError` is the other half. It fires wherever the Next.js server
 * catches the error, and `context.routeType` names the phase — `action` for the
 * Server Action itself, `render` for the page render that follows it. The digest
 * is the join key: it is what `app/error.tsx` prints as the reference code, so a
 * student quoting one can be matched to the stack here.
 *
 * Headers are deliberately not logged; they carry the session cookie.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest)
      : undefined;

  console.error(
    `[server-error] ${request.method} ${request.path} ` +
      `(${context.routeType} in ${context.routePath})` +
      (digest ? ` digest=${digest}` : ""),
    error,
  );
};
