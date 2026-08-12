import "server-only";

import type { Config } from "isomorphic-dompurify";

import { ALLOWED_RICH_TEXT_TAGS, isRichTextEmpty } from "@/domain/rich-text";

/**
 * Server-side sanitisation.
 *
 * Everything a student types is treated as hostile. There are two jobs here and
 * they have very different costs:
 *
 *   Rich text  genuinely needs an HTML parser, because the allowlist is
 *              structural — which tags and attributes survive. That means
 *              jsdom, via DOMPurify.
 *   Plain text does not. Names, titles and roles keep no markup at all, so
 *              "strip every tag" is a string operation.
 *
 * That distinction matters because loading jsdom costs **~85 MB of RSS and
 * ~3.9 seconds** on a cold start — measured, not estimated. Paying that to
 * remove tags from a surname is what made onboarding and the team step the two
 * slowest writes in the portal, on the serverless instances least able to
 * afford it. So plain text is handled here without a DOM, and DOMPurify is
 * imported lazily, only when rich text is actually sanitised.
 */

// ---------------------------------------------------------------------------
// Plain text — no DOM
// ---------------------------------------------------------------------------

/** The five entities HTML requires, plus the space that reads as one. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Elements whose content is raw text rather than markup. Their *contents* have
 * to go with them: dropping only the tags around `<script>alert(1)</script>`
 * would promote the script body to visible text, which is how "hi" would have
 * become "alert(1)hi".
 */
const RAW_TEXT_ELEMENTS = /<(script|style|noscript|template|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/**
 * Tags, comments, CDATA and processing instructions. `<!--[\s\S]*?-->` is
 * separate because a comment may legally contain `>`, which the tag pattern
 * would otherwise stop at.
 */
const MARKUP = /<!--[\s\S]*?-->|<[!?/]?[a-z][^>]*>|<[!?][^>]*>/gi;

function decodeEntities(value: string): string {
  return value.replace(/&(#[0-9]+|#x[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith("#")) {
      const code =
        body[1]?.toLowerCase() === "x"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);

      // Reject anything outside Unicode, and the surrogate range, which
      // `fromCodePoint` throws on.
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      if (code >= 0xd800 && code <= 0xdfff) return match;
      return String.fromCodePoint(code);
    }

    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * Sanitises a plain-text field: strips every tag and collapses whitespace.
 * Used for names, titles and any value rendered as text.
 *
 * The result is *text*, not HTML — entities are decoded, so a team called
 * "R&D" is stored as `R&D` rather than `R&amp;D`. Every consumer escapes on
 * output (React escapes children, react-pdf escapes text nodes), so this is
 * both safe and what the reader should see. It is also a fix: the previous
 * DOM-based version returned `5 &gt; 3 &amp; 2 &lt; 4` for `5 > 3 & 2 < 4`,
 * which was then displayed to the student literally.
 *
 * The invariant that keeps it safe is that these fields are never rendered as
 * HTML. `RichTextView` — the one `dangerouslySetInnerHTML` in the app — is
 * reserved for {@link sanitizeRichText} output. Do not point it at a field
 * sanitised here.
 *
 * Tags are removed *before* entities are decoded, so `&lt;script&gt;` survives
 * as the literal text `<script>` rather than being decoded into markup and
 * then stripped.
 */
export function sanitizePlainText(value: string | null | undefined): string | null {
  if (value == null) return null;

  const withoutMarkup = value.replace(RAW_TEXT_ELEMENTS, "").replace(MARKUP, "");
  const decoded = decodeEntities(withoutMarkup);
  const normalised = decoded.replace(/\s+/g, " ").trim();

  return normalised.length > 0 ? normalised : null;
}

// ---------------------------------------------------------------------------
// Rich text — DOMPurify, loaded on demand
// ---------------------------------------------------------------------------

/**
 * The allowlist is deliberately narrower than what the editor can produce — if
 * a tag is not on it, it is dropped rather than escaped, because the stored
 * value is later rendered with `dangerouslySetInnerHTML` in the review console
 * and re-parsed for the PDF.
 */
const CONFIG: Config = {
  ALLOWED_TAGS: [...ALLOWED_RICH_TEXT_TAGS],
  ALLOWED_ATTR: ["href", "target", "rel"],
  // No data:, no javascript:, no inline event handlers.
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
  FORBID_ATTR: ["style", "srcset", "formaction", "onerror", "onload"],
  KEEP_CONTENT: true,
  USE_PROFILES: { html: true },
};

/**
 * Held across calls so a request that sanitises eight narrative answers pays
 * for jsdom once rather than eight times.
 */
let purifyPromise: Promise<typeof import("isomorphic-dompurify").default> | null = null;

function loadPurify() {
  purifyPromise ??= import("isomorphic-dompurify").then((module) => module.default);
  return purifyPromise;
}

/**
 * Sanitises a rich-text answer. Returns null for content that is empty once
 * markup is stripped, so "the student left it blank" is a single condition
 * downstream rather than three.
 *
 * Async because DOMPurify is loaded on demand; a step that saves no narrative
 * fields never pays for it. The early return matters as much as the import —
 * a blank answer costs nothing.
 */
export async function sanitizeRichText(html: string | null | undefined): Promise<string | null> {
  if (!html) return null;

  const DOMPurify = await loadPurify();
  const clean = DOMPurify.sanitize(html, CONFIG) as unknown as string;

  if (isRichTextEmpty(clean)) return null;

  // Force safe link behaviour; DOMPurify allows the attributes but does not
  // add the protective pair on its own.
  return clean.replace(/<a\s+([^>]*)>/gi, (match, attrs: string) => {
    if (!/href=/i.test(attrs)) return match;
    const withoutTargetRel = attrs.replace(/\s*(target|rel)="[^"]*"/gi, "").trim();
    return `<a ${withoutTargetRel} target="_blank" rel="noopener noreferrer nofollow">`;
  });
}
