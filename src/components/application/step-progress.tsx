"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Circle, CircleAlert } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { APPLICATION_STEPS } from "@/domain/application/steps";
import type { StepStatus } from "@/domain/application/completeness";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * The wizard's progress rail.
 *
 * Steps are always reachable — a student may fill the form in any order — so
 * the icons report state rather than gating navigation.
 */
export function StepProgress({
  steps,
  percentComplete,
  canSubmit,
}: {
  steps: StepStatus[];
  percentComplete: number;
  canSubmit: boolean;
}) {
  const pathname = usePathname();
  const statusBySlug = new Map(steps.map((step) => [step.slug, step]));

  return (
    <nav aria-label="Application sections" className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm tabular-nums text-muted-foreground">{percentComplete}%</span>
        </div>
        <Progress
          value={percentComplete}
          aria-label={`Application ${percentComplete}% complete`}
        />
      </div>

      <ol className="space-y-0.5">
        {APPLICATION_STEPS.map((step, index) => {
          const href = ROUTES.applicationStep(step.slug);
          const isActive = pathname === href;
          const status = statusBySlug.get(step.slug);
          const isReview = step.slug === "review";

          const complete = isReview ? canSubmit : (status?.complete ?? false);
          const incompleteRequired = !isReview && status?.required && !status.complete;

          return (
            <li key={step.slug}>
              <Link
                href={href}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex items-start gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                  "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isActive && "bg-accent font-medium",
                )}
              >
                <span className="mt-0.5 shrink-0">
                  {complete ? (
                    <Check className="size-4 text-success" aria-hidden />
                  ) : incompleteRequired ? (
                    <CircleAlert className="size-4 text-muted-foreground" aria-hidden />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" aria-hidden />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <span className="tabular-nums text-muted-foreground">{index + 1}.</span>{" "}
                    {step.shortTitle}
                  </span>
                  <span className="sr-only">
                    {complete
                      ? " — complete"
                      : incompleteRequired
                        ? ` — incomplete, ${status?.missing.length} item(s) outstanding`
                        : " — optional"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
