import "server-only";

import { Resend } from "resend";

import { serverEnv } from "@/lib/env.server";

/**
 * Outbound email.
 *
 * When `RESEND_API_KEY` is unset — the default in development — messages are
 * written to the server log instead of being sent. That keeps a developer from
 * mailing real students while testing the revision loop, and means the rest of
 * the code never has to ask whether email is configured.
 */

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type EmailResult =
  | { delivered: true; id: string | null }
  | { delivered: false; reason: string };

let client: Resend | null = null;

function resendClient(): Resend | null {
  if (!serverEnv.RESEND_API_KEY) return null;
  client ??= new Resend(serverEnv.RESEND_API_KEY);
  return client;
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const recipients = Array.isArray(message.to) ? message.to : [message.to];
  const valid = recipients.filter((address) => address.includes("@"));

  if (valid.length === 0) {
    return { delivered: false, reason: "No valid recipients." };
  }

  const resend = resendClient();

  if (!resend) {
    console.info(
      `[email:dev] → ${valid.join(", ")}\n  subject: ${message.subject}\n${message.text
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n")}`,
    );
    return { delivered: false, reason: "RESEND_API_KEY not configured — logged instead." };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: serverEnv.EMAIL_FROM,
      to: valid,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });

    if (error) {
      console.error("[email] send failed", { subject: message.subject, error });
      return { delivered: false, reason: error.message };
    }

    return { delivered: true, id: data?.id ?? null };
  } catch (error) {
    console.error("[email] transport error", { subject: message.subject, error });
    return {
      delivered: false,
      reason: error instanceof Error ? error.message : "Unknown transport error",
    };
  }
}
