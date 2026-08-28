/**
 * Single source of truth for the portal's URLs.
 *
 * Middleware, navigation and redirects all read from here so a route can be
 * renamed without hunting for string literals.
 */

export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  authError: "/auth/error",
  /** NextAuth owns everything under this prefix. */
  authApi: "/api/auth",
  signOut: "/auth/sign-out",
  /** Deployment diagnostics — reports missing configuration, no secrets. */
  health: "/api/health",
  accessDenied: "/access-denied",

  onboarding: "/onboarding",

  dashboard: "/dashboard",
  application: "/application",
  applicationStep: (step: string) => `/application/${step}`,
  applicationReview: "/application/review",
  applicationPdf: (id: string) => `/api/applications/${id}/pdf`,
  applicationDeclarationPdf: (id: string) => `/api/applications/${id}/declaration`,
  attachmentDownload: (id: string) => `/api/attachments/${id}`,

  admin: "/admin",
  adminApplications: "/admin/applications",
  adminApplication: (id: string) => `/admin/applications/${id}`,
  adminApplicationPrint: (id: string) => `/admin/applications/${id}/print`,
  adminSettings: "/admin/settings",
  adminAudit: "/admin/audit",
  adminUsers: "/admin/users",
  /** The signed-in reviewer's own allocation of work. */
  adminReviewQueue: "/admin/queue",
  /** The cohort ranked by aggregate score. Advisory — it decides nothing. */
  adminLeaderboard: "/admin/leaderboard",
  /**
   * The student portal as staff see it: the real dashboard and the real wizard,
   * rendered read-only from a blank in-memory entry. Under `/admin` on purpose,
   * so the reviewer guard on that tree covers it without a rule of its own.
   */
  adminPreview: "/admin/preview",
  adminPreviewStep: (step: string) => `/admin/preview/${step}`,
  adminExportCsv: "/api/admin/applications/export",
  adminExportPdf: "/api/admin/applications/export-pdf",
} as const;

/** Paths reachable without a session. */
export const PUBLIC_PATHS = [
  ROUTES.home,
  ROUTES.signIn,
  ROUTES.authError,
  ROUTES.authApi,
  ROUTES.signOut,
  ROUTES.accessDenied,
  ROUTES.health,
] as const;

/** Prefixes that require a valid session. */
export const PROTECTED_PREFIXES = [
  ROUTES.dashboard,
  ROUTES.application,
  ROUTES.onboarding,
  ROUTES.admin,
] as const;

/** Prefixes that additionally require a reviewer or administrator role. */
export const ADMIN_PREFIXES = [ROUTES.admin] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAuthPath(pathname: string): boolean {
  return pathname === ROUTES.signIn;
}
