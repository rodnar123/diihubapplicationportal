"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Shuffle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { callAction } from "@/lib/client-action";
import { autoAssignAction } from "@/app/(admin)/admin/review-actions";

/**
 * Spreads unallocated entries across the panel.
 *
 * This exists because the alternative — an administrator allocating two hundred
 * entries by hand — is the step at which a panel workflow quietly stops being
 * used. It only ever *adds*: an entry that already has enough reviewers is
 * skipped, so running it twice tops up rather than reshuffling work somebody
 * has already started.
 */
export function AutoAssignControl() {
  const router = useRouter();
  const [perApplication, setPerApplication] = useState("2");
  const [isPending, startTransition] = useTransition();

  const run = () => {
    startTransition(async () => {
      const result = await callAction(() =>
        autoAssignAction({ reviewersPerApplication: Number(perApplication) }),
      );

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const { created, skipped } = result.data;
      toast.success(
        created === 0
          ? "Every entry already has enough reviewers."
          : `Allocated ${created} ${created === 1 ? "review" : "reviews"}.` +
              (skipped > 0 ? ` ${skipped} already covered.` : ""),
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
      <span className="text-sm font-medium">Allocate unassigned entries to</span>

      <Select value={perApplication} onValueChange={setPerApplication}>
        <SelectTrigger className="w-36" aria-label="Reviewers per application">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5].map((count) => (
            <SelectItem key={count} value={String(count)}>
              {count} {count === 1 ? "reviewer" : "reviewers"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button onClick={run} disabled={isPending} variant="outline">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Shuffle className="size-4" aria-hidden="true" />
        )}
        Allocate
      </Button>

      <span className="text-xs text-muted-foreground">
        Lightest workload first. Entries that already have enough reviewers are left alone.
      </span>
    </div>
  );
}
