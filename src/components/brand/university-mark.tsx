import Image from "next/image";

import { cn } from "@/lib/utils";
import { CHALLENGE_NAME, UNIVERSITY_NAME, UNIVERSITY_SHORT_NAME } from "@/domain/challenge/constants";

/**
 * The university crest.
 *
 * `public/logo.png` is generated from the supplied `logo.jfif` by
 * `npm run brand:icons`; edit the original, not the output. Its ground is
 * transparent, but the mark itself is maroon outlined in black, so it still
 * needs the white tile below to stay legible against the maroon sidebar — the
 * tile is what carries the rounding and the hairline ring, not the file.
 *
 * `priority` is set because the crest is in the header of every page and is
 * part of the first meaningful paint.
 */
export function UniversityCrest({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-black/10",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo.png"
        alt={`${UNIVERSITY_SHORT_NAME} crest`}
        width={size}
        height={size}
        priority
        className="size-full object-contain"
      />
    </span>
  );
}

/**
 * Crest plus wordmark.
 *
 * The text block is `min-w-0` with truncating children so a long university
 * name cannot push the lockup past its container — which is what made the
 * sidebar header overflow. `compact` drops the second line for tight spaces.
 */
export function BrandLockup({
  className,
  compact = false,
  subtitle = CHALLENGE_NAME,
  title = UNIVERSITY_NAME,
  size = 36,
  tone = "default",
}: {
  className?: string;
  compact?: boolean;
  subtitle?: string;
  title?: string;
  size?: number;
  /** `onDark` inverts the text for the maroon sidebar. */
  tone?: "default" | "onDark";
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <UniversityCrest size={size} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span
          className={cn(
            "truncate text-sm font-semibold tracking-tight",
            tone === "onDark" && "text-sidebar-foreground",
          )}
        >
          {compact ? UNIVERSITY_SHORT_NAME : title}
        </span>
        {!compact && (
          <span
            className={cn(
              "truncate text-xs",
              tone === "onDark" ? "text-sidebar-foreground/70" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
