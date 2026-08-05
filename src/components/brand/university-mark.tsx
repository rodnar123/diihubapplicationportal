import { cn } from "@/lib/utils";
import { CHALLENGE_NAME, UNIVERSITY_NAME, UNIVERSITY_SHORT_NAME } from "@/domain/challenge/constants";

/**
 * Placeholder for the official PNGUoT crest.
 *
 * Drop the real artwork in `public/university-crest.svg` and swap the `<svg>`
 * below for an `<Image>`; nothing else needs to change. It is drawn rather
 * than imported so the portal ships without depending on an asset the
 * university has not supplied yet.
 */
export function UniversityCrest({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${UNIVERSITY_SHORT_NAME} crest`}
      className={cn("size-10 shrink-0", className)}
    >
      <defs>
        <linearGradient id="crest-shield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <path
        d="M24 2.5 42 8v16.5c0 9.9-7.1 17.6-18 21.1C13.1 42.1 6 34.4 6 24.5V8L24 2.5Z"
        fill="url(#crest-shield)"
      />
      <path
        d="M24 2.5 42 8v16.5c0 9.9-7.1 17.6-18 21.1C13.1 42.1 6 34.4 6 24.5V8L24 2.5Z"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="1.5"
      />
      {/* Open book — teaching and research. */}
      <path
        d="M13.5 20.5c3.6-1.5 7.1-1.5 10.5 0 3.4-1.5 6.9-1.5 10.5 0v10c-3.6-1.5-7.1-1.5-10.5 0-3.4-1.5-6.9-1.5-10.5 0v-10Z"
        fill="var(--brand)"
        fillOpacity="0.9"
      />
      <path d="M24 20.5v10" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.5" />
      {/* Gear tooth motif — technology. */}
      <circle cx="24" cy="13" r="3.6" fill="none" stroke="var(--brand)" strokeWidth="1.6" />
      <circle cx="24" cy="13" r="1.1" fill="var(--brand)" />
    </svg>
  );
}

/**
 * Crest plus wordmark. `compact` drops the second line for tight spaces such
 * as the mobile header.
 */
export function BrandLockup({
  className,
  compact = false,
  subtitle = CHALLENGE_NAME,
}: {
  className?: string;
  compact?: boolean;
  subtitle?: string;
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <UniversityCrest className="size-9 text-primary" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold tracking-tight">
          {compact ? UNIVERSITY_SHORT_NAME : UNIVERSITY_NAME}
        </span>
        {!compact && (
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </span>
    </span>
  );
}
