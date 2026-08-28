import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CohortSummary } from "@/services/admin/cohort-service";

/**
 * This cycle against the one before it.
 *
 * Deliberately four numbers and no chart. The question a challenge office asks
 * between cycles is "are more teams entering, and are more of them finishing" —
 * that is answered by four deltas, and a trend line drawn through two points is
 * a decoration pretending to be an analysis.
 *
 * Direction is carried by an arrow as well as by colour, because a
 * red-green-only encoding is invisible to a chunk of the audience and this
 * strip is the densest thing on the page.
 */
export function CohortComparisonStrip({
  currentYear,
  previousYear,
  current,
  delta,
}: {
  currentYear: number;
  previousYear: number;
  current: CohortSummary;
  delta: { total: number; submitted: number; approved: number; completionRate: number };
}) {
  const metrics = [
    { label: "Applications", value: current.total, delta: delta.total, suffix: "" },
    { label: "Reached the panel", value: current.submitted, delta: delta.submitted, suffix: "" },
    { label: "Approved", value: current.approved, delta: delta.approved, suffix: "" },
    {
      label: "Completion",
      value: current.completionRate,
      delta: delta.completionRate,
      suffix: "%",
    },
  ];

  return (
    <section
      aria-label={`${currentYear} compared with ${previousYear}`}
      className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4"
    >
      {metrics.map((metric) => (
        <div key={metric.label} className="flex flex-col gap-1 bg-card p-4">
          <span className="text-xs text-muted-foreground">{metric.label}</span>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {metric.value}
            {metric.suffix}
          </span>
          <DeltaChip value={metric.delta} suffix={metric.suffix} since={previousYear} />
        </div>
      ))}
    </section>
  );
}

function DeltaChip({
  value,
  suffix,
  since,
}: {
  value: number;
  suffix: string;
  since: number;
}) {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs tabular-nums",
        value > 0 && "text-success",
        value < 0 && "text-destructive",
        value === 0 && "text-muted-foreground",
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {value > 0 ? "+" : ""}
      {value}
      {suffix} <span className="text-muted-foreground">vs {since}</span>
    </span>
  );
}
