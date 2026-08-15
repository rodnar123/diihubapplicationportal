import { z } from "zod";

/**
 * Rich-text helpers that are safe on both sides of the network boundary.
 *
 * Narrative answers are authored in a small rich-text editor and stored as
 * HTML. *Sanitisation* is a server-side concern (see `lib/sanitize.server.ts`)
 * because it needs a DOM implementation; what lives here is only the pure
 * measurement and shape logic the browser also needs, so importing a form
 * schema into a client component does not drag a DOM polyfill along with it.
 */

/** Tags the editor may produce and the sanitiser will keep. */
export const ALLOWED_RICH_TEXT_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h3",
  "blockquote",
  "a",
  "code",
] as const;

const BLOCK_BOUNDARY = /<\/(?:p|div|li|h[1-6]|blockquote)>|<br\s*\/?>/gi;
const TAG = /<[^>]*>/g;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&mdash;": "—",
  "&ndash;": "–",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;|&#\d+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
}

/**
 * Renders HTML down to readable plain text. Used for length validation, CSV
 * export, search snippets and email bodies.
 */
export function richTextToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return decodeEntities(html.replace(BLOCK_BOUNDARY, "\n").replace(TAG, ""))
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/** Character count as the student perceives it, ignoring markup. */
export function richTextLength(html: string | null | undefined): number {
  return richTextToPlainText(html).length;
}

/**
 * True when the value carries no actual content. The editor emits `<p></p>`
 * for an empty document, which is not the same as an empty string.
 */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  return richTextLength(html) === 0;
}

/** Single-line preview, e.g. for a table cell. */
export function richTextExcerpt(html: string | null | undefined, maxLength = 160): string {
  const text = richTextToPlainText(html).replace(/\n+/g, " ");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * A required rich-text answer.
 *
 * Length is measured against the plain text so a student cannot satisfy a
 * minimum with markup, and cannot be blocked by it either.
 */
export function richTextField(options: { label: string; min: number; max: number }) {
  const { label, min, max } = options;

  return z
    .string()
    /*
     * A ceiling on the raw markup, not just the readable text.
     *
     * The draft schema below has always had this; the required one did not,
     * which is backwards — this is the schema that gates submission. Because
     * length is measured on the plain text, markup nested deeply enough to
     * render as a few hundred visible characters passed at any size, and was
     * then handed to `sanitizeRichText`, whose jsdom parse is the one
     * genuinely expensive operation in the request path.
     *
     * Checked on the string itself so it short-circuits: a failure here means
     * `richTextLength` never walks the payload at all.
     */
    .max(max * 8, `${label} is too long.`)
    .refine((value) => richTextLength(value) >= min, {
      message: `${label} must be at least ${min} characters.`,
    })
    .refine((value) => richTextLength(value) <= max, {
      message: `${label} must be ${max} characters or fewer.`,
    });
}

/** The draft-time counterpart: shape is checked, presence is not. */
export function optionalRichTextField(options: { label: string; max: number }) {
  return z
    .string()
    .max(options.max * 8, `${options.label} is too long.`)
    .refine((value) => richTextLength(value) <= options.max, {
      message: `${options.label} must be ${options.max} characters or fewer.`,
    })
    .nullish();
}
