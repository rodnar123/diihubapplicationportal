"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarRange, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CohortSummary } from "@/services/admin/cohort-service";

/**
 * Switches the dashboard between challenge cycles.
 *
 * The year goes in the query string rather than component state so a reviewer
 * can link a colleague to "the 2025 numbers" and have them see the same screen
 * — which is what people do with a dashboard, and what state in a `useState`
 * would quietly break.
 */
export function CohortSwitcher({
  cohorts,
  selected,
}: {
  cohorts: CohortSummary[];
  selected: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Only one cycle has ever run, so there is nothing to switch between.
  if (cohorts.length <= 1) return null;

  const change = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("year", value);

    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {isPending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : (
        <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" />
      )}

      <Select value={String(selected)} onValueChange={change}>
        <SelectTrigger className="w-44" aria-label="Challenge cycle">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {cohorts.map((cohort) => (
            <SelectItem key={cohort.challengeYear} value={String(cohort.challengeYear)}>
              <span className="flex items-center gap-2">
                {cohort.challengeYear}
                {cohort.isCurrent && (
                  <Badge variant="outline" className="px-1 py-0 text-[10px]">
                    current
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
