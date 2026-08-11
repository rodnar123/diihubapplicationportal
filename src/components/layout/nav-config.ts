import {
  Eye,
  FileText,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { ROUTES } from "@/lib/routes";

/**
 * Navigation is described as data so the sidebar, the command palette and the
 * mobile menu all render the same set of destinations from one definition.
 *
 * **`icon` is a name, not a component.** These groups are built in a Server
 * Component (the app shell) and handed to Client Components (the sidebar, the
 * command palette). A React component is a function, and functions cannot
 * cross that boundary — doing so fails the render with "Functions cannot be
 * passed directly to Client Components". The client side resolves the name
 * through {@link NAV_ICONS}, which keeps this module serialisable.
 */

export type NavIconName =
  | "dashboard"
  | "application"
  | "applications"
  | "settings"
  | "audit"
  | "preview";

/**
 * Name → component. Safe to import anywhere; only ever *dereferenced* inside a
 * Client Component, never passed across the boundary.
 */
export const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  application: FileText,
  applications: ListChecks,
  settings: Settings,
  audit: ScrollText,
  preview: Eye,
};

export interface NavItem {
  label: string;
  href: string;
  /** Key into {@link NAV_ICONS} — a string, so this stays serialisable. */
  icon: NavIconName;
  description: string;
  /** Marks the item active for any path beneath it, not just an exact match. */
  matchPrefix?: boolean;
  /** Restricts the entry to full administrators. */
  adminOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const STUDENT_NAV: NavGroup[] = [
  {
    label: "Challenge",
    items: [
      {
        label: "Dashboard",
        href: ROUTES.dashboard,
        icon: "dashboard",
        description: "Your application status and recent activity",
      },
      {
        label: "My application",
        href: ROUTES.application,
        icon: "application",
        description: "Complete and submit your entry",
        matchPrefix: true,
      },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Review",
    items: [
      {
        label: "Dashboard",
        href: ROUTES.admin,
        icon: "dashboard",
        description: "Submission statistics and recent activity",
      },
      {
        label: "Applications",
        href: ROUTES.adminApplications,
        icon: "applications",
        description: "Search, filter, review and export submissions",
        matchPrefix: true,
      },
      {
        label: "Student portal",
        href: ROUTES.adminPreview,
        icon: "preview",
        description: "Preview the form and dashboard as an applicant sees them",
        matchPrefix: true,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Settings",
        href: ROUTES.adminSettings,
        icon: "settings",
        description: "Team size, uploads, declaration mode and submission window",
        adminOnly: true,
      },
      {
        label: "Audit log",
        href: ROUTES.adminAudit,
        icon: "audit",
        description: "Every action taken in the portal",
        adminOnly: true,
      },
    ],
  },
];
