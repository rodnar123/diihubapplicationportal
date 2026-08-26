import { z } from "zod";

import { Role } from "@/generated/prisma/enums";

/**
 * The user directory's query contract.
 *
 * Mirrors `application-query`: filters live in the URL so a view can be
 * bookmarked and the back button behaves, and parsing is tolerant so a
 * hand-edited or stale URL falls back to defaults rather than throwing.
 */

/**
 * Accounts are filtered by lifecycle rather than by the two booleans behind it,
 * because "deactivated" and "deleted" are the two different things an
 * administrator actually means and `isActive`/`deletedAt` do not read as either
 * on their own.
 */
export const USER_STATUS_FILTERS = ["active", "inactive", "deleted"] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

export const USER_PAGE_SIZES = [25, 50, 100] as const;

const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) => {
      if (!raw) return [] as string[];
      const list = Array.isArray(raw) ? raw : raw.split(",");
      return list
        .map((entry) => entry.trim())
        .filter((entry) => (values as readonly string[]).includes(entry));
    });

export const userQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),

  role: csvEnum(Object.values(Role) as unknown as [string, ...string[]]).transform(
    (values) => values as Role[],
  ),

  /**
   * Empty means "every live account" — active and deactivated, but not deleted.
   * Deleted accounts are only ever shown when asked for by name, so the
   * directory does not open onto a list of people who are no longer there.
   */
  status: csvEnum(USER_STATUS_FILTERS as unknown as [string, ...string[]]).transform(
    (values) => values as UserStatusFilter[],
  ),

  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce
    .number()
    .int()
    .refine((value) => (USER_PAGE_SIZES as readonly number[]).includes(value), {
      message: "Unsupported page size.",
    })
    .default(25),
});

export type UserQuery = z.infer<typeof userQuerySchema>;

export function parseUserQuery(
  raw: Record<string, string | string[] | undefined>,
): UserQuery {
  const result = userQuerySchema.safeParse(raw);
  if (result.success) return result.data;

  // Drop only the fields that failed, so a bad `size` does not also clear the
  // administrator's search text.
  const failedKeys = new Set(result.error.issues.map((issue) => String(issue.path[0])));
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !failedKeys.has(key)),
  );

  return userQuerySchema.parse(cleaned);
}

export function hasActiveUserFilters(query: UserQuery): boolean {
  return Boolean(query.q || query.role.length > 0 || query.status.length > 0);
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.STUDENT]: "Student",
  [Role.REVIEWER]: "Reviewer",
  [Role.ADMIN]: "Administrator",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [Role.STUDENT]: "Files an entry. No access to the review console.",
  [Role.REVIEWER]: "Reads every entry, records decisions and comments.",
  [Role.ADMIN]: "Everything a reviewer can do, plus settings, users and deletion.",
};
