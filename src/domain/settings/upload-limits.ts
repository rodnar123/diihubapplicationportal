/**
 * Upload ceilings, shared by the settings schema and `next.config.ts`.
 *
 * Files reach the server through a Server Action, whose request body Next.js
 * caps at 1MB by default — "to prevent the consumption of excessive server
 * resources in parsing large amounts of data, as well as potential DDoS
 * attacks". The portal was advertising 10MB per file and letting an
 * administrator configure up to 100MB, so anything past about a megabyte was
 * refused by the framework before `uploadAttachment` ever ran, with none of
 * its careful messages reaching the student.
 *
 * Both numbers live here so the form can never promise what the runtime will
 * reject. Deliberately free of imports: `next.config.ts` loads this directly
 * and cannot resolve the `@/` alias.
 */

/**
 * The largest single file an administrator may allow.
 *
 * Sized for what the form actually asks for — prototype screenshots, a design
 * document, a signed declaration scan, a packaged demo — rather than for the
 * framework maximum. Raising it means raising the body limit with it, and
 * every megabyte here is buffered in the function's memory.
 */
export const MAX_UPLOAD_MB = 25;

/**
 * What `serverActions.bodySizeLimit` is set to.
 *
 * A megabyte above the file ceiling: the limit applies to the raw HTTP body,
 * so multipart boundaries, part headers and field metadata all count against
 * it. The Next.js documentation suggests 10–20KB of overhead for a typical
 * multipart upload; this leaves considerably more.
 */
export const SERVER_ACTION_BODY_LIMIT = `${MAX_UPLOAD_MB + 1}mb`;
