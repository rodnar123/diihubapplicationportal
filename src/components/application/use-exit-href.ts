"use client";

import { usePathname } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * Where the wizard's "leave this form" controls should go.
 *
 * Read from the path rather than passed down as a prop. The wizard's steps are
 * eight separate client components, several of which render their own exit
 * button, so threading one more prop through all of them — and through
 * `ApplicationStepBody` above them — would be a lot of plumbing for a single
 * link.
 *
 * It matters because those same step components are mounted twice: once at
 * `/application/[step]` for the student who owns the entry, and once at
 * `/admin/preview/[step]` for staff reading the form. `/dashboard` is a student
 * route, so from the preview it would bounce a reviewer to `/admin` with no
 * explanation of why.
 */
export function useExitHref(): { href: string; label: string } {
  const pathname = usePathname();

  return pathname.startsWith(ROUTES.adminPreview)
    ? { href: ROUTES.adminPreview, label: "Back to preview" }
    : { href: ROUTES.dashboard, label: "Return to dashboard" };
}
