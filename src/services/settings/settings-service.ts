import "server-only";

import { cache } from "react";

import {
  APP_SETTING_DESCRIPTIONS,
  DEFAULT_APP_SETTINGS,
  appSettingsSchema,
  mergeAppSettings,
  type AppSettingKey,
  type AppSettings,
} from "@/domain/settings/app-settings";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";

/**
 * Reads and writes the runtime configuration.
 *
 * `cache` scopes the read to a single request: a page that consults the
 * settings in four different components performs one query.
 */
export const getAppSettings = cache(async (): Promise<AppSettings> => {
  try {
    const rows = await prisma.appSetting.findMany({ select: { key: true, value: true } });
    return mergeAppSettings(rows);
  } catch (error) {
    // A configuration read must never be the thing that takes the portal down;
    // the shipped defaults are a safe fallback.
    console.error("[settings] falling back to defaults", error);
    return DEFAULT_APP_SETTINGS;
  }
});

/**
 * Applies a partial update. Each key is validated on its own so one bad value
 * cannot corrupt the rest, and the pair invariant (min ≤ max) is enforced
 * against the *resulting* configuration rather than the submitted fragment.
 */
export async function updateAppSettings(
  updates: Partial<AppSettings>,
  actorId: string,
): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = { ...current, ...updates };

  const parsed = appSettingsSchema.safeParse(next);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "settings");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw new AppError("VALIDATION", "Some settings were not valid.", { fieldErrors });
  }

  if (parsed.data["team.minSize"] > parsed.data["team.maxSize"]) {
    throw new AppError("VALIDATION", "Minimum team size cannot exceed the maximum.", {
      fieldErrors: { "team.minSize": ["Minimum team size cannot exceed the maximum."] },
    });
  }

  const opensAt = parsed.data["submission.opensAt"];
  const closesAt = parsed.data["submission.closesAt"];
  if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) {
    throw new AppError("VALIDATION", "The submission window closes before it opens.", {
      fieldErrors: { "submission.closesAt": ["The closing date must be after the opening date."] },
    });
  }

  const changedKeys = (Object.keys(updates) as AppSettingKey[]).filter(
    (key) => JSON.stringify(current[key]) !== JSON.stringify(parsed.data[key]),
  );

  if (changedKeys.length === 0) return current;

  await prisma.$transaction(
    changedKeys.map((key) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value: parsed.data[key] as never, updatedById: actorId },
        create: {
          key,
          value: parsed.data[key] as never,
          description: APP_SETTING_DESCRIPTIONS[key],
          updatedById: actorId,
        },
      }),
    ),
  );

  return parsed.data;
}
