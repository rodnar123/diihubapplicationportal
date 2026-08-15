import { decodeHtmlEntities as decodeEntities, richTextToPlainText } from "@/domain/rich-text";

/**
 * Turns stored rich text into a flat block list that React-PDF can render.
 *
 * React-PDF has no HTML renderer, so the markup has to be converted into its
 * primitives. A full HTML parser would be overkill here: the input is not
 * arbitrary web content but the output of our own editor, already narrowed by
 * `sanitizeRichText` to a dozen tags. That closed set is what makes this small
 * tokeniser sufficient — and it stays sufficient only as long as the sanitiser
 * allowlist and `INLINE_STYLES`/`BLOCK_TAGS` below agree.
 */

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export type RichTextBlock =
  | { type: "paragraph"; runs: InlineRun[] }
  | { type: "heading"; runs: InlineRun[] }
  | { type: "list"; ordered: boolean; items: InlineRun[][] };

const INLINE_STYLES: Record<string, keyof Omit<InlineRun, "text">> = {
  strong: "bold",
  b: "bold",
  em: "italic",
  i: "italic",
  u: "underline",
  s: "strike",
};


const TOKEN = /<\/?([a-zA-Z0-9]+)(?:\s[^>]*)?\/?>|([^<]+)/g;

export function parseRichText(html: string | null | undefined): RichTextBlock[] {
  if (!html) return [];

  const blocks: RichTextBlock[] = [];

  // Active inline styles, as a stack so nested <strong><em> both apply.
  const styleStack: Array<keyof Omit<InlineRun, "text">> = [];

  let currentRuns: InlineRun[] = [];
  let currentType: "paragraph" | "heading" = "paragraph";
  let listContext: { ordered: boolean; items: InlineRun[][] } | null = null;
  let inListItem = false;

  const currentStyles = (): Omit<InlineRun, "text"> => {
    const styles: Omit<InlineRun, "text"> = {};
    for (const style of styleStack) styles[style] = true;
    return styles;
  };

  const pushText = (raw: string) => {
    const text = decodeEntities(raw).replace(/\s+/g, " ");
    if (!text || text === " ") {
      // Preserve a single separating space between two styled runs.
      if (text === " " && currentRuns.length > 0) {
        currentRuns.push({ text: " ", ...currentStyles() });
      }
      return;
    }
    currentRuns.push({ text, ...currentStyles() });
  };

  const flushBlock = () => {
    const runs = trimRuns(currentRuns);
    if (runs.length > 0) blocks.push({ type: currentType, runs });
    currentRuns = [];
    currentType = "paragraph";
  };

  const flushListItem = () => {
    const runs = trimRuns(currentRuns);
    if (listContext && runs.length > 0) listContext.items.push(runs);
    currentRuns = [];
  };

  const flushList = () => {
    if (listContext && listContext.items.length > 0) {
      blocks.push({ type: "list", ordered: listContext.ordered, items: listContext.items });
    }
    listContext = null;
  };

  for (const match of html.matchAll(TOKEN)) {
    const [token, tagName, textContent] = match;

    if (textContent !== undefined) {
      pushText(textContent);
      continue;
    }

    const tag = tagName?.toLowerCase();
    if (!tag) continue;

    const isClosing = token.startsWith("</");

    if (tag === "br") {
      currentRuns.push({ text: "\n", ...currentStyles() });
      continue;
    }

    if (tag in INLINE_STYLES) {
      const style = INLINE_STYLES[tag];
      if (isClosing) {
        const index = styleStack.lastIndexOf(style);
        if (index >= 0) styleStack.splice(index, 1);
      } else {
        styleStack.push(style);
      }
      continue;
    }

    switch (tag) {
      case "ul":
      case "ol":
        if (isClosing) {
          flushListItem();
          flushList();
        } else {
          flushBlock();
          listContext = { ordered: tag === "ol", items: [] };
        }
        break;

      case "li":
        if (isClosing) {
          flushListItem();
          inListItem = false;
        } else {
          if (inListItem) flushListItem();
          inListItem = true;
          currentRuns = [];
        }
        break;

      case "h3":
        if (isClosing) {
          flushBlock();
        } else {
          flushBlock();
          currentType = "heading";
        }
        break;

      case "p":
      case "div":
      case "blockquote":
        // Inside a list these are layout noise; the <li> owns the block.
        if (!listContext) {
          flushBlock();
        }
        break;

      default:
        // Anything else (e.g. <a>, <code>) contributes its text only.
        break;
    }
  }

  flushListItem();
  flushList();
  flushBlock();

  return blocks;
}

function trimRuns(runs: InlineRun[]): InlineRun[] {
  const cleaned = runs.filter((run) => run.text.length > 0);
  if (cleaned.length === 0) return [];

  cleaned[0] = { ...cleaned[0], text: cleaned[0].text.replace(/^\s+/, "") };
  const last = cleaned.length - 1;
  cleaned[last] = { ...cleaned[last], text: cleaned[last].text.replace(/\s+$/, "") };

  return cleaned.filter((run) => run.text.length > 0);
}

/**
 * Fallback for anywhere the block structure is not needed.
 */
export function richTextToPdfText(html: string | null | undefined): string {
  return richTextToPlainText(html);
}
