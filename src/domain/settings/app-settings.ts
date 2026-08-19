import { z } from "zod";

import { DEFAULT_MAX_TEAM_SIZE } from "@/domain/challenge/constants";
import { MAX_UPLOAD_MB } from "@/domain/settings/upload-limits";

/**
 * Runtime configuration an administrator can change without a deployment.
 *
 * Each leaf is persisted as one row in `app_settings` keyed by its dotted
 * name, then merged over `DEFAULT_APP_SETTINGS` and validated on read — so a
 * malformed or half-migrated row degrades to the shipped default rather than
 * taking the portal down.
 */

/**
 * Which declaration methods a team may use.
 * - ELECTRONIC    : tick-box + typed full name + date
 * - SIGNED_UPLOAD : download the PDF, sign it by hand, upload the scan
 * - BOTH          : the team chooses
 */
export const declarationModeSettingSchema = z.enum(["ELECTRONIC", "SIGNED_UPLOAD", "BOTH"]);
export type DeclarationModeSetting = z.infer<typeof declarationModeSettingSchema>;

export const appSettingsSchema = z.object({
  "challenge.year": z.number().int().min(2000).max(2100),
  "challenge.themes": z.array(z.string().min(1)).min(1),

  "team.minSize": z.number().int().min(1).max(50),
  "team.maxSize": z.number().int().min(1).max(50),

  "uploads.maxFileSizeMb": z.number().int().min(1).max(MAX_UPLOAD_MB),
  "uploads.maxFilesPerApplication": z.number().int().min(1).max(50),
  "uploads.allowedMimeTypes": z.array(z.string().min(1)).min(1),

  "declaration.mode": declarationModeSettingSchema,

  /** ISO-8601 instants, or null for "no window enforced". */
  "submission.opensAt": z.string().datetime().nullable(),
  "submission.closesAt": z.string().datetime().nullable(),

  /** How many days before `closesAt` the student's deadline notice turns amber. */
  "submission.closingSoonDays": z.number().int().min(1).max(90),

  /** Whether teams may still edit after submitting (before review starts). */
  "submission.allowWithdraw": z.boolean(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type AppSettingKey = keyof AppSettings;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  "challenge.year": 2026,
  "challenge.themes": [
    "Digital Innovation for Business",
    "FinTech and Financial Inclusion",
    "AgriTech and Food Security",
    "Health and Well-being Technology",
    "Education Technology",
    "Sustainable Tourism and Culture",
    "Climate, Energy and Environment",
    "Smart Communities and Public Services",
  ],

  "team.minSize": 2,
  "team.maxSize": DEFAULT_MAX_TEAM_SIZE,

  "uploads.maxFileSizeMb": 10,
  "uploads.maxFilesPerApplication": 10,
  "uploads.allowedMimeTypes": [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/zip",
    "application/x-zip-compressed",
  ],

  "declaration.mode": "BOTH",

  "submission.opensAt": null,
  "submission.closesAt": null,
  "submission.closingSoonDays": 7,
  "submission.allowWithdraw": true,
};

/**
 * Human-readable copy for the admin settings screen.
 */
export const APP_SETTING_DESCRIPTIONS: Record<AppSettingKey, string> = {
  "challenge.year": "The challenge cycle new applications are filed against.",
  "challenge.themes": "Themes a team can align its venture to.",
  "team.minSize": "Minimum number of members a team must have to submit.",
  "team.maxSize": "Maximum number of members a team may register.",
  "uploads.maxFileSizeMb": "Largest single file a team may upload, in megabytes.",
  "uploads.maxFilesPerApplication": "How many files one application may carry.",
  "uploads.allowedMimeTypes": "File types accepted by the uploader.",
  "declaration.mode": "Which declaration method(s) teams may use.",
  "submission.opensAt": "Submissions are rejected before this instant. Empty means no opening date.",
  "submission.closesAt": "Submissions are rejected after this instant. Empty means no closing date.",
  "submission.closingSoonDays":
    "How many days before the closing date the students' deadline notice turns amber.",
  "submission.allowWithdraw": "Allow teams to withdraw a submission that is not yet under review.",
};

export const APP_SETTING_KEYS = Object.keys(DEFAULT_APP_SETTINGS) as AppSettingKey[];

/**
 * Maps MIME types to the extensions shown to students and used for the
 * `accept` attribute on the file input.
 */
export const MIME_EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
};

export function acceptAttributeFor(mimeTypes: readonly string[]): string {
  const extensions = new Set<string>();
  for (const mime of mimeTypes) {
    for (const extension of MIME_EXTENSIONS[mime] ?? []) {
      extensions.add(extension);
    }
  }
  return [...mimeTypes, ...extensions].join(",");
}

export function describeAllowedTypes(mimeTypes: readonly string[]): string {
  const extensions = new Set<string>();
  for (const mime of mimeTypes) {
    for (const extension of MIME_EXTENSIONS[mime] ?? []) {
      extensions.add(extension.replace(".", "").toUpperCase());
    }
  }
  return [...extensions].join(", ");
}

/**
 * Merges persisted rows over the defaults. Individual malformed values fall
 * back rather than failing the whole read.
 */
export function mergeAppSettings(rows: ReadonlyArray<{ key: string; value: unknown }>): AppSettings {
  const merged: Record<string, unknown> = { ...DEFAULT_APP_SETTINGS };

  for (const row of rows) {
    if (!(row.key in DEFAULT_APP_SETTINGS)) continue;
    const leafSchema = appSettingsSchema.shape[row.key as AppSettingKey];
    const parsed = leafSchema.safeParse(row.value);
    if (parsed.success) {
      merged[row.key] = parsed.data;
    }
  }

  // `minSize` must never exceed `maxSize`, whatever the rows say.
  if ((merged["team.minSize"] as number) > (merged["team.maxSize"] as number)) {
    merged["team.minSize"] = merged["team.maxSize"];
  }

  return merged as AppSettings;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface SubmissionDeadline {
  closesAt: Date;
  msRemaining: number;
  hoursRemaining: number;
  daysRemaining: number;
  /** Inside `submission.closingSoonDays` — show this in amber. */
  closingSoon: boolean;
}

/**
 * The deadline a student still has time to meet.
 *
 * Returns `null` when no closing date is configured, or when it has already
 * passed — a deadline in the past is not a countdown, it is a closed window,
 * and {@link submissionWindow} is what reports that.
 *
 * Remaining time is measured from the instant, not from calendar days, so a
 * deadline 25 hours away reads as "1 day" rather than being rounded up into
 * a second day the team does not have.
 *
 * `closingSoon` is measured against `submission.closingSoonDays`, so an office
 * that wants a fortnight's notice rather than a week changes it in the admin
 * settings, not in a deployment.
 */
export function submissionDeadline(
  settings: AppSettings,
  now: Date = new Date(),
): SubmissionDeadline | null {
  const raw = settings["submission.closesAt"];
  if (!raw) return null;

  const closesAt = new Date(raw);
  if (Number.isNaN(closesAt.getTime())) return null;

  const msRemaining = closesAt.getTime() - now.getTime();
  if (msRemaining <= 0) return null;

  const daysRemaining = Math.floor(msRemaining / DAY_MS);

  return {
    closesAt,
    msRemaining,
    hoursRemaining: Math.floor(msRemaining / HOUR_MS),
    daysRemaining,
    closingSoon: msRemaining <= settings["submission.closingSoonDays"] * DAY_MS,
  };
}

/** "in 3 days", "in 5 hours", "in under an hour". */
export function describeTimeRemaining(deadline: SubmissionDeadline): string {
  if (deadline.daysRemaining >= 1) {
    return `in ${deadline.daysRemaining} day${deadline.daysRemaining === 1 ? "" : "s"}`;
  }
  if (deadline.hoursRemaining >= 1) {
    return `in ${deadline.hoursRemaining} hour${deadline.hoursRemaining === 1 ? "" : "s"}`;
  }
  return "in under an hour";
}

/**
 * Is the submission window open at `now`?
 */
export function submissionWindow(settings: AppSettings, now: Date = new Date()) {
  const opensAt = settings["submission.opensAt"] ? new Date(settings["submission.opensAt"]) : null;
  const closesAt = settings["submission.closesAt"] ? new Date(settings["submission.closesAt"]) : null;

  if (opensAt && now < opensAt) {
    return { open: false as const, reason: "NOT_YET_OPEN" as const, opensAt, closesAt };
  }
  if (closesAt && now > closesAt) {
    return { open: false as const, reason: "CLOSED" as const, opensAt, closesAt };
  }
  return { open: true as const, reason: null, opensAt, closesAt };
}
