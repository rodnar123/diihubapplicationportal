"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReviewAssignmentStatus } from "@/generated/prisma/enums";
import { callAction } from "@/lib/client-action";
import {
  assignReviewerAction,
  unassignReviewerAction,
} from "@/app/(admin)/admin/review-actions";

/**
 * Who is marking this entry.
 *
 * Administrators only — the guard is in the action as well as here, because a
 * Server Action is reachable by POST without going near this component.
 */
export function AssignReviewers({
  applicationId,
  members,
  assigned,
}: {
  applicationId: string;
  members: Array<{ id: string; name: string; email: string; openCount: number }>;
  assigned: Array<{
    assignmentId: string;
    reviewerId: string;
    reviewerName: string;
    status: ReviewAssignmentStatus;
  }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [isPending, startTransition] = useTransition();

  const held = new Set(assigned.map((entry) => entry.reviewerId));
  const available = members.filter((member) => !held.has(member.id));

  const add = () => {
    if (!selected) return;

    startTransition(async () => {
      const result = await callAction(() =>
        assignReviewerAction({ applicationId, reviewerId: selected }),
      );

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.data.created ? "Reviewer allocated." : "That reviewer already holds this entry.");
      setSelected("");
      router.refresh();
    });
  };

  const remove = (assignmentId: string, name: string) => {
    startTransition(async () => {
      const result = await callAction(() => unassignReviewerAction({ assignmentId }));

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(`${name} is no longer allocated this entry.`);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocated reviewers</CardTitle>
        <CardDescription>
          Who is expected to mark this entry. Withdrawing an allocation keeps any marks
          already submitted on the record.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is allocated to this entry yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {assigned.map((entry) => (
              <li key={entry.assignmentId} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  {entry.reviewerName}
                  {entry.status === ReviewAssignmentStatus.SUBMITTED && (
                    <Badge
                      variant="outline"
                      className="border-success/30 bg-success/10 text-success"
                    >
                      Marked
                    </Badge>
                  )}
                  {entry.status === ReviewAssignmentStatus.RECUSED && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Stepped away
                    </Badge>
                  )}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => remove(entry.assignmentId, entry.reviewerName)}
                  aria-label={`Withdraw ${entry.reviewerName} from this entry`}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="min-w-48 flex-1" aria-label="Reviewer to allocate">
                <SelectValue placeholder="Add a reviewer" />
              </SelectTrigger>
              <SelectContent>
                {available.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} · {member.openCount} open
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={add} disabled={!selected || isPending} variant="outline">
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="size-4" aria-hidden="true" />
              )}
              Allocate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
