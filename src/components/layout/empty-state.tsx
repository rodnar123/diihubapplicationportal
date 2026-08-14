import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shown wherever a list, table or dashboard has nothing to display. Always
 * says what would appear here and how to make it appear — an empty box with no
 * explanation reads as a bug.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "default",
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /**
   * `compact` is for an empty state filling a slot inside a card — a chart
   * that has no data yet. The default is a whole-page treatment: 48px of
   * padding above and below is right when it is the only thing on screen, and
   * far too much when the dashboard stacks six of them before launch.
   */
  size?: "default" | "compact";
}) {
  const compact = size === "compact";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
          compact ? "size-9" : "size-11",
        )}
      >
        <Icon className={compact ? "size-4" : "size-5"} aria-hidden />
      </span>
      <div className="space-y-1">
        <p className={cn("font-medium", compact && "text-sm")}>{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-pretty text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
