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
  accessDenied: "/access-denied",

  onboarding: "/onboarding",

  dashboard: "/dashboard",
  application: "/application",
  applicationStep: (step: string) => `/application/${step}`,
  applicationReview: "/application/review",
  applicationPdf: (id: string) => `/api/applications/${id}/pdf`,

  admin: "/admin",
  adminApplications: "/admin/applications",
  adminApplication: (id: string) => `/admin/applications/${id}`,
  adminApplicationPrint: (id: string) => `/admin/applications/${id}/print`,
  adminSettings: "/admin/settings",
  adminAudit: "/admin/audit",
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
