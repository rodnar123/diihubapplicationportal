/**
 * Pure formatting helpers.
 *
 * Deliberately in a module with neither `"use client"` nor `"server-only"`:
 * these are called from both Server and Client Components. A helper defined
 * inside a `"use client"` module cannot be *called* on the server — React
 * treats every export of such a module as a client reference, so invoking one
 * during a server render fails with "Attempted to call X from the server but X
 * is on the client".
 */

/** Human-readable file size, e.g. "842 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The challenge runs in one country, so every date it shows means one thing:
 * the time in Papua New Guinea.
 *
 * Without an explicit zone, `toLocaleString` follows whatever is rendering.
 * A Server Component takes the *server's* zone — UTC on Vercel — while a
 * Client Component takes the reader's browser. The same instant then displayed
 * two different ways depending on where it happened to be rendered, and a
 * submission window the office set to 17:00 was announced to students as
 * 07:00. A submission made at 09:00 was recorded as the previous evening.
 *
 * Anything shown to a person goes through the helpers below. Machine-readable
 * output — `dateTime` attributes, CSV, filenames — stays ISO/UTC.
 */
export const CHALLENGE_TIME_ZONE = "Pacific/Port_Moresby";

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Date and time, e.g. "16 August 2026 at 9:00 am". */
export function formatDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "long", timeStyle: "short" },
): string {
  return toDate(value).toLocaleString("en-GB", {
    ...options,
    timeZone: CHALLENGE_TIME_ZONE,
  });
}

/** Date only, e.g. "16 August 2026". */
export function formatDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "long" },
): string {
  return toDate(value).toLocaleDateString("en-GB", {
    ...options,
    timeZone: CHALLENGE_TIME_ZONE,
  });
}
