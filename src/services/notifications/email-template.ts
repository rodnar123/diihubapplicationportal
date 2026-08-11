import "server-only";

import { CHALLENGE_HOST, CHALLENGE_NAME, UNIVERSITY_NAME } from "@/domain/challenge/constants";
import { APP_URL } from "@/lib/env";

/**
 * A single, plain email layout.
 *
 * Table-based and inline-styled because that is what mail clients render
 * reliably, and every message ships a text alternative — university mail
 * filters treat HTML-only mail less kindly.
 */

export interface EmailContentBlock {
  heading?: string;
  paragraphs: string[];
  quote?: string | null;
  action?: { label: string; href: string } | null;
}

/*
 * The identity, restated as literal hex.
 *
 * Mail clients strip <style> blocks and have never heard of a CSS custom
 * property, so `globals.css` cannot be the source of truth here — these have to
 * be inlined. They are copied from the `:root` block; change them together.
 *
 * The header is a flat maroon rather than the app's gradient: Outlook drops
 * `background-image` on a table cell and would render the band white, taking
 * the white wordmark with it. Gold appears as the rule under the header, which
 * every client honours.
 */
const MAROON = "#5c0022";
const GOLD = "#f0e030";
const MAROON_TINT = "#f6eef1";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail(block: EmailContentBlock): { html: string; text: string } {
  const heading = block.heading ? escapeHtml(block.heading) : null;
  const paragraphs = block.paragraphs.map(escapeHtml);
  const quote = block.quote ? escapeHtml(block.quote) : null;
  const actionHref = block.action ? new URL(block.action.href, APP_URL).toString() : null;
  // Absolute, because a mail client has no origin to resolve a path against.
  // `alt` is deliberately empty: the wordmark beside it already carries the
  // name, so a client with images off should show nothing rather than a
  // broken-image caption repeating it.
  const crestSrc = new URL("/logo.png", APP_URL).toString();

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;border:1px solid #e4e6eb;overflow:hidden;">
          <tr>
            <td style="background:${MAROON};border-bottom:3px solid ${GOLD};padding:18px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="padding-right:12px;" valign="middle">
                  <img src="${crestSrc}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border:0;border-radius:6px;background:#ffffff;">
                </td>
                <td valign="middle">
                  <div style="color:#ffffff;font-size:15px;font-weight:600;">${escapeHtml(UNIVERSITY_NAME)}</div>
                  <div style="color:#f0d9e2;font-size:12px;margin-top:2px;">${escapeHtml(CHALLENGE_NAME)} · ${escapeHtml(CHALLENGE_HOST)}</div>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;color:#1f2937;font-size:14px;line-height:1.6;">
              ${heading ? `<h1 style="margin:0 0 14px;font-size:18px;line-height:1.35;color:#111827;">${heading}</h1>` : ""}
              ${paragraphs.map((text) => `<p style="margin:0 0 12px;">${text}</p>`).join("")}
              ${
                quote
                  ? `<blockquote style="margin:16px 0;padding:12px 14px;background:${MAROON_TINT};border-left:3px solid ${MAROON};color:#374151;font-size:14px;">${quote}</blockquote>`
                  : ""
              }
              ${
                actionHref && block.action
                  ? `<p style="margin:22px 0 6px;">
                       <a href="${actionHref}" style="display:inline-block;background:${MAROON};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">${escapeHtml(block.action.label)}</a>
                     </p>
                     <p style="margin:0;font-size:12px;color:#6b7280;">If the button does not work, copy this link into your browser:<br>${escapeHtml(actionHref)}</p>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e4e6eb;color:#6b7280;font-size:12px;">
              You are receiving this because you hold an application in the ${escapeHtml(CHALLENGE_NAME)} portal.
              Please do not reply to this address.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    block.heading,
    "",
    ...block.paragraphs,
    block.quote ? `\n"${block.quote}"\n` : null,
    actionHref && block.action ? `${block.action.label}: ${actionHref}` : null,
    "",
    `${CHALLENGE_NAME} · ${CHALLENGE_HOST}`,
    UNIVERSITY_NAME,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n")
    .trim();

  return { html, text };
}
