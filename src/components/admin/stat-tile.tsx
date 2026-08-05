import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A single headline number.
 *
 * Deliberately not a chart: one value with a label reads faster as text than
 * as a one-bar plot. The whole tile is the link target when it has one, so the
 * hit area matches what looks clickable.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "info" | "warning" | "success" | "danger";
}) {
  const toneClasses = {
    default: "bg-muted text-muted-foreground",
    info: "bg-info/10 text-info",
    warning: "bg-warning/15 text-warning-foreground dark:text-warning",
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
  }[tone];

  const body = (
    <CardContent className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", toneClasses)}>
        <Icon className="size-4" aria-hidden />
      </span>
    </CardContent>
  );

  if (!href) {
    return <Card>{body}</Card>;
  }

  return (
    <Card className="transition-colors hover:border-primary/40 hover:bg-accent/30">
      <Link
        href={href}
        className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {body}
      </Link>
    </Card>
  );
}
