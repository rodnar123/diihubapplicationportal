import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Trophy } from "lucide-react";

import { AutoAssignControl } from "@/components/admin/auto-assign-control";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isAdmin, requireReviewer } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getLeaderboard } from "@/services/admin/scoring-service";
import { getAppSettings } from "@/services/settings/settings-service";

export const metadata: Metadata = { title: "Ranking" };

/**
 * The cohort, ordered by panel score.
 *
 * The banner is not decoration. A ranked list looks like a result, and this one
 * is not: it is the arithmetic of whatever marks happen to be in so far, and a
 * panel that mistakes it for the outcome has skipped the part where people
 * decide. Entries nobody has marked sit at the bottom without a rank rather
 * than at zero, for the same reason.
 */
export default async function LeaderboardPage() {
  const viewer = await requireReviewer();
  const [rows, settings] = await Promise.all([getLeaderboard(viewer), getAppSettings()]);

  const ranked = rows.filter((row) => row.rank !== null);
  const unscored = rows.filter((row) => row.rank === null);

  return (
    <>
      <PageHeader
        title="Ranking"
        description={`${settings["challenge.year"]} cycle · ${ranked.length} scored, ${unscored.length} awaiting marks`}
      />

      <p className="rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info">
        This ordering is advisory. It reflects the marks submitted so far and decides
        nothing on its own — approving or rejecting an entry is a separate, deliberate
        action recorded against that application.
      </p>

      {isAdmin(viewer.role) && <AutoAssignControl />}

      {rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nothing to rank yet"
          description="Entries appear here once they have been submitted for review."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Venture</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Reviewers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.applicationId}>
                  <TableCell className="font-mono tabular-nums">
                    {row.rank ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={ROUTES.adminApplication(row.applicationId)}
                      className="font-medium hover:underline"
                    >
                      {row.projectTitle ?? "Untitled venture"}
                    </Link>
                    {row.referenceNumber && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {row.referenceNumber}
                      </span>
                    )}
                    {row.needsModeration && (
                      <Badge
                        variant="outline"
                        className="ml-2 gap-1 border-warning/40 bg-warning/15 text-warning"
                      >
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        Split panel
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.teamName ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {row.percentage === null ? (
                      <span className="text-muted-foreground">Not scored</span>
                    ) : (
                      `${row.percentage}%`
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {row.countedCards}
                    {row.pendingCards > 0 && (
                      <span className="text-muted-foreground"> +{row.pendingCards}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
