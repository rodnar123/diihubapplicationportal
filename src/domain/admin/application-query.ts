import { z } from "zod";

import { ApplicationStatus, YearLevel } from "@/generated/prisma/enums";

/**
 * The admin list's query contract.
 *
 * Filters live in the URL rather than component state so a reviewer can
 * bookmark "all revision-requested entries from the School of Business
 * Studies", share it with a colleague, and have the back button behave.
 * Parsing therefore has to be tolerant: a stale or hand-edited URL should fall
 * back to defaults, never 500.
 */

const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) => {
      if (!raw) return [] as string[];
      const list = Array.isArray(raw) ? raw : raw.split(",");
      return list.map((entry) => entry.trim()).filter((entry) => (values as readonly string[]).includes(entry));
    });

export const SORTABLE_COLUMNS = [
  "submittedAt",
  "updatedAt",
  "createdAt",
  "projectTitle",
  "teamName",
  "status",
  "referenceNumber",
] as const;

export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const applicationQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),

  status: csvEnum(
    Object.values(ApplicationStatus) as unknown as [string, ...string[]],
  ).transform((values) => values as ApplicationStatus[]),

  year: csvEnum(Object.values(YearLevel) as unknown as [string, ...string[]]).transform(
    (values) => values as YearLevel[],
  ),

  school: z.string().trim().max(40).optional(),
  section: z.string().trim().max(40).optional(),

  /** ISO date (yyyy-mm-dd) bounds on the submission date. */
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),

  challengeYear: z.coerce.number().int().min(2000).max(2100).optional(),

  sort: z.enum(SORTABLE_COLUMNS).default("submittedAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),

  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().refine((value) => (PAGE_SIZES as readonly number[]).includes(value), {
    message: "Unsupported page size.",
  }).default(25),
});

export type ApplicationQuery = z.infer<typeof applicationQuerySchema>;

/**
 * Parses raw `searchParams`, falling back to defaults for anything malformed.
 */
export function parseApplicationQuery(
  raw: Record<string, string | string[] | undefined>,
): ApplicationQuery {
  const result = applicationQuerySchema.safeParse(raw);
  if (result.success) return result.data;

  // Retry without the fields that failed rather than discarding the whole
  // query — a bad `size` should not also clear the reviewer's search text.
  const failedKeys = new Set(result.error.issues.map((issue) => String(issue.path[0])));
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !failedKeys.has(key)),
  );

  return applicationQuerySchema.parse(cleaned);
}

/** Serialises a query back into a URL search string. */
export function buildApplicationQueryString(
  query: Partial<ApplicationQuery>,
  overrides: Partial<ApplicationQuery> = {},
): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (merged.q) params.set("q", merged.q);
  if (merged.status?.length) params.set("status", merged.status.join(","));
  if (merged.year?.length) params.set("year", merged.year.join(","));
  if (merged.school) params.set("school", merged.school);
  if (merged.section) params.set("section", merged.section);
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  if (merged.challengeYear) params.set("challengeYear", String(merged.challengeYear));
  if (merged.sort && merged.sort !== "submittedAt") params.set("sort", merged.sort);
  if (merged.dir && merged.dir !== "desc") params.set("dir", merged.dir);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  if (merged.size && merged.size !== 25) params.set("size", String(merged.size));

  const search = params.toString();
  return search ? `?${search}` : "";
}

export function hasActiveFilters(query: ApplicationQuery): boolean {
  return Boolean(
    query.q ||
      query.status.length > 0 ||
      query.year.length > 0 ||
      query.school ||
      query.section ||
      query.from ||
      query.to,
  );
}
