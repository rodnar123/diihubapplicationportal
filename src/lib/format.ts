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
