import "server-only";

import DOMPurify, { type Config } from "isomorphic-dompurify";

import { ALLOWED_RICH_TEXT_TAGS, isRichTextEmpty } from "@/domain/rich-text";

/**
 * Server-side HTML sanitisation.
 *
 * Everything a student types is treated as hostile. The allowlist is
 * deliberately narrower than what the editor can produce — if a tag is not on
 * it, it is dropped rather than escaped, because the stored value is later
 * rendered with `dangerouslySetInnerHTML` in the review console and re-parsed
 * for the PDF.
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
 * Sanitises a rich-text answer. Returns null for content that is empty once
 * markup is stripped, so "the student left it blank" is a single condition
 * downstream rather than three.
 */
export function sanitizeRichText(html: string | null | undefined): string | null {
  if (!html) return null;

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

/**
 * Sanitises a plain-text field: strips every tag and collapses whitespace.
 * Used for names, titles and any value rendered as text.
 */
export function sanitizePlainText(value: string | null | undefined): string | null {
  if (value == null) return null;

  const clean = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }) as unknown as string;

  const normalised = clean.replace(/\s+/g, " ").trim();
  return normalised.length > 0 ? normalised : null;
}
