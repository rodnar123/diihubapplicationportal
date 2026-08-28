import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewAssignmentStatus } from "@/generated/prisma/enums";
import { requireReviewer } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { getMyReviewQueue } from "@/services/admin/scoring-service";

export const metadata: Metadata = { title: "My queue" };

/**
 * The signed-in reviewer's own allocation.
 *
 * Deliberately not a filter on the applications table: that table answers "what
 * is the state of the cohort", and this answers "what is left for me". A panel
 * member who has to reconstruct their own workload from a shared list is a
 * panel member who reviews whatever is at the top.
 */
export default async function ReviewQueuePage() {
  const reviewer = await requireReviewer();
  const queue = await getMyReviewQueue(reviewer);

  const outstanding = queue.filter(
    (entry) =>
      entry.status === ReviewAssignmentStatus.PENDING ||
      entry.status === ReviewAssignmentStatus.IN_PROGRESS,
  );

  return (
    <>
      <PageHeader
        title="My queue"
        description={
          queue.length === 0
            ? "Nothing has been allocated to you yet."
            : `${outstanding.length} of ${queue.length} still to mark.`
        }
      />

      {queue.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No entries allocated to you"
          description="An administrator allocates review work from an application's page, or in bulk from the ranking screen."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.map((entry) => (
            <li key={entry.assignmentId}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <Link
                      href={ROUTES.adminApplication(entry.applicationId)}
                      className="font-medium hover:underline"
                    >
                      {entry.projectTitle ?? "Untitled venture"}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {entry.referenceNumber && (
                        <span className="font-mono text-xs">{entry.referenceNumber}</span>
                      )}
                      {entry.referenceNumber && entry.teamName && " · "}
                      {entry.teamName && `Team ${entry.teamName}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground tabular-nums">
                      {entry.scoredCount}/{entry.criterionCount}
                    </span>
                    <QueueBadge entry={entry} />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function QueueBadge({
  entry,
}: {
  entry: { status: ReviewAssignmentStatus; submittedAt: string | null };
}) {
  switch (entry.status) {
    case ReviewAssignmentStatus.SUBMITTED:
      return (
        <Badge className="border-success/30 bg-success/10 text-success" variant="outline">
          Submitted{entry.submittedAt ? ` · ${formatDateTime(entry.submittedAt)}` : ""}
        </Badge>
      );
    case ReviewAssignmentStatus.IN_PROGRESS:
      return (
        <Badge className="border-info/30 bg-info/10 text-info" variant="outline">
          In progress
        </Badge>
      );
    case ReviewAssignmentStatus.RECUSED:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Stepped away
        </Badge>
      );
    default:
      return <Badge variant="outline">Not started</Badge>;
  }
}
