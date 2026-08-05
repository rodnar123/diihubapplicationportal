import { YearLevel } from "@/generated/prisma/enums";

/**
 * Challenge-wide constants. Pure data — safe to import from client components.
 */

export const CHALLENGE_NAME = "DiiHub BizTech Challenge";
export const CHALLENGE_HOST = "School of Business Studies";
export const UNIVERSITY_NAME = "Papua New Guinea University of Technology";
export const UNIVERSITY_SHORT_NAME = "PNGUoT";

/**
 * Reference number prefix, e.g. DBTC-2026-0007.
 */
export const REFERENCE_PREFIX = "DBTC";

export const YEAR_LEVEL_OPTIONS: ReadonlyArray<{ value: YearLevel; label: string }> = [
  { value: YearLevel.YEAR_1, label: "Year 1" },
  { value: YearLevel.YEAR_2, label: "Year 2" },
  { value: YearLevel.YEAR_3, label: "Year 3" },
  { value: YearLevel.YEAR_4, label: "Year 4" },
  { value: YearLevel.YEAR_5, label: "Year 5" },
  { value: YearLevel.POSTGRADUATE, label: "Postgraduate" },
];

export const YEAR_LEVEL_LABELS: Record<YearLevel, string> = Object.fromEntries(
  YEAR_LEVEL_OPTIONS.map((option) => [option.value, option.label]),
) as Record<YearLevel, string>;

/**
 * The 17 UN Sustainable Development Goals. Applications declare which goals
 * their venture contributes to.
 */
export const SDG_GOALS: ReadonlyArray<{ code: string; number: number; title: string }> = [
  { code: "SDG_1", number: 1, title: "No Poverty" },
  { code: "SDG_2", number: 2, title: "Zero Hunger" },
  { code: "SDG_3", number: 3, title: "Good Health and Well-being" },
  { code: "SDG_4", number: 4, title: "Quality Education" },
  { code: "SDG_5", number: 5, title: "Gender Equality" },
  { code: "SDG_6", number: 6, title: "Clean Water and Sanitation" },
  { code: "SDG_7", number: 7, title: "Affordable and Clean Energy" },
  { code: "SDG_8", number: 8, title: "Decent Work and Economic Growth" },
  { code: "SDG_9", number: 9, title: "Industry, Innovation and Infrastructure" },
  { code: "SDG_10", number: 10, title: "Reduced Inequalities" },
  { code: "SDG_11", number: 11, title: "Sustainable Cities and Communities" },
  { code: "SDG_12", number: 12, title: "Responsible Consumption and Production" },
  { code: "SDG_13", number: 13, title: "Climate Action" },
  { code: "SDG_14", number: 14, title: "Life Below Water" },
  { code: "SDG_15", number: 15, title: "Life on Land" },
  { code: "SDG_16", number: 16, title: "Peace, Justice and Strong Institutions" },
  { code: "SDG_17", number: 17, title: "Partnerships for the Goals" },
];

export const SDG_CODES = SDG_GOALS.map((goal) => goal.code);

export const SDG_LABELS: Record<string, string> = Object.fromEntries(
  SDG_GOALS.map((goal) => [goal.code, `SDG ${goal.number} — ${goal.title}`]),
);

/**
 * Prototype categories offered by the official form
 * ("Desktop, Web app, mobile app, digital tool, etc.").
 */
export const PROTOTYPE_TYPES: ReadonlyArray<string> = [
  "Web Application",
  "Mobile Application",
  "Desktop Application",
  "Digital Tool / Utility",
  "Hardware / IoT Device",
  "Data / Analytics Platform",
  "Other",
];

/**
 * The official form asks for exactly three alternative solutions.
 */
export const REQUIRED_ALTERNATIVE_COUNT = 3;

/**
 * The paper form provides seven team-member rows. This is the shipped default
 * for `team.maxSize`; administrators can change it at runtime.
 */
export const DEFAULT_MAX_TEAM_SIZE = 7;
