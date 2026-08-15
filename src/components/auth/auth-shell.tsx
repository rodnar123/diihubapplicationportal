import Link from "next/link";
import { FileCheck2, Lightbulb, Users } from "lucide-react";

import { BrandLockup } from "@/components/brand/university-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  CHALLENGE_HOST,
  CHALLENGE_NAME,
  UNIVERSITY_NAME,
} from "@/domain/challenge/constants";
import { DEFAULT_APP_SETTINGS } from "@/domain/settings/app-settings";
import { ROUTES } from "@/lib/routes";

/**
 * What a visitor is signing in to do. Deliberately *not* the eligibility
 * rules — those live in the card, where they are visible at every width. This
 * panel is decoration plus orientation; nothing here is load-bearing, so it
 * can be hidden below `lg` without losing information.
 */
const PANEL_POINTS = [
  {
    icon: Users,
    title: "Register your team",
    body: "Nominate a leader and add your members, sections and roles.",
  },
  {
    icon: Lightbulb,
    title: "Describe your venture",
    body: "The problem, your tech-driven solution, and the prototype behind it.",
  },
  {
    icon: FileCheck2,
    title: "Declare and submit",
    body: "Sign online or upload a signed copy, then download your PDF.",
  },
] as const;

/**
 * The frame shared by every page a signed-out (or half-signed-in) visitor can
 * reach: sign-in, the sign-in error page, access-denied.
 *
 * Two columns from `lg` up. The brand panel takes the horizontal space the
 * old single centred column left empty, which is what lets the card itself
 * stay short enough to fit a laptop viewport without the page scrolling —
 * the thing that was wrong with the previous layout.
 *
 * Scrolling is contained rather than forbidden. The shell is pinned to the
 * viewport at `lg` and the content column owns the only scroll area, so the
 * page never scrolls as a whole; on a window too short for the card, that one
 * column scrolls instead of the chrome sliding away. The inner `min-h-full`
 * wrapper is what makes centring safe inside a scroll container: without it,
 * `items-center` on an overflowing flex parent clips the top of the card out
 * of reach.
 */
export function AuthShell({
  children,
  /** Extra controls for the top-right, beside the theme toggle. */
  actions,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:h-dvh lg:grid-cols-2 lg:overflow-hidden">
      <aside className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-gradient-brand p-8 text-sidebar-foreground short:gap-6 lg:flex xl:gap-12 xl:p-14">
        {/* Gold bloom over the maroon, matching the app chrome. Decorative. */}
        <div
          className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-brand/10 blur-3xl"
          aria-hidden
        />

        <Link
          href={ROUTES.home}
          className="relative w-fit rounded-lg focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        >
          <BrandLockup tone="onDark" size={44} />
        </Link>

        <div className="relative space-y-7">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-hairline bg-white/5 px-3 py-1 text-xs font-medium">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              {CHALLENGE_HOST}
            </span>

            <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-balance xl:text-4xl">
              {CHALLENGE_NAME} {DEFAULT_APP_SETTINGS["challenge.year"]}
            </h2>

            <p className="max-w-md text-pretty text-sm text-sidebar-foreground/80 short:hidden xl:text-base">
              Turn a real Papua New Guinean problem into a working prototype — registered,
              written up and submitted entirely online.
            </p>
          </div>

          <ul className="space-y-4">
            {PANEL_POINTS.map((point) => (
              <li key={point.title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand">
                  <point.icon className="size-4.5" aria-hidden />
                </span>
                <span className="space-y-0.5">
                  <span className="block text-sm font-semibold">{point.title}</span>
                  <span className="block text-pretty text-sm text-sidebar-foreground/80">
                    {point.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/70">{UNIVERSITY_NAME}</p>
      </aside>

      <div className="flex min-h-dvh flex-col lg:min-h-0">
        {/*
          `min-w-0` on the link and `shrink-0` on the controls are load-bearing
          on a phone. A flex item defaults to `min-width: auto`, so without it
          the lockup holds the full intrinsic width of "Papua New Guinea
          University of Technology" — its own `truncate` never gets the chance
          to fire — and the theme toggle is pushed past the right edge, giving
          the page 50px of sideways scroll at 360px wide.
        */}
        <header className="flex shrink-0 items-center gap-3 px-5 py-4 short:py-3 sm:px-8">
          <Link
            href={ROUTES.home}
            className="min-w-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
          >
            <BrandLockup />
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </header>

        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-5 py-4 short:py-2 sm:px-8">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </main>

        {/*
          Hidden from `lg` up, where the brand panel already carries the
          challenge name — and where the 40px it costs is the difference
          between the card fitting a short laptop and the column scrolling.
        */}
        <footer className="shrink-0 px-5 py-4 text-center text-xs text-muted-foreground short:py-3 sm:px-8 lg:hidden">
          <p>
            {CHALLENGE_NAME} · {CHALLENGE_HOST}
          </p>
        </footer>
      </div>
    </div>
  );
}
