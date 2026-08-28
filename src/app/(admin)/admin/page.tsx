import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  FileEdit,
  Inbox,
  Users,
  XCircle,
} from "lucide-react";

import { StatusBadge } from "@/components/application/status-badge";
import { BreakdownTabs } from "@/components/admin/breakdown-tabs";
import { CohortComparisonStrip } from "@/components/admin/cohort-comparison-strip";
import { CohortSwitcher } from "@/components/admin/cohort-switcher";
import { CategoryBarChart, SubmissionTrendChart } from "@/components/admin/charts";
import { StatTile } from "@/components/admin/stat-tile";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APPLICATION_STATUS_META } from "@/domain/application/status";
import { CHALLENGE_NAME } from "@/domain/challenge/constants";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { requireReviewer } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { getAdminStatistics } from "@/services/admin/statistics";
import { compareCohorts, listCohorts, resolveCohortYear } from "@/services/admin/cohort-service";

export const metadata: Metadata = { title: "Admin dashboard" };

function applicationsHref(status?: ApplicationStatus[]) {
  if (!status?.length) return ROUTES.adminApplications;
  return `${ROUTES.adminApplications}?status=${status.join(",")}`;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requireReviewer();

  const { year } = await searchParams;

  /*
   * The cycle comes from the query string, not from settings.
   *
   * `challengeYear` has always been on the row and `getAdminStatistics` has
   * always taken one — but every caller passed the current setting, so rolling
   * the year forward made the previous cohort unreachable. The data was never
   * gone; nothing could ask for it.
   */
  const challengeYear = await resolveCohortYear(year);

  const [stats, cohorts, comparison] = await Promise.all([
    getAdminStatistics(challengeYear),
    listCohorts(),
    compareCohorts(challengeYear),
  ]);

  const statusChartData = stats.byStatus
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      label: APPLICATION_STATUS_META[entry.status].label,
      count: entry.count,
    }));

  return (
    <>
      <PageHeader
        title="Challenge dashboard"
        description={`${CHALLENGE_NAME} ${stats.challengeYear} — ${stats.total} application${stats.total === 1 ? "" : "s"} across ${stats.totalParticipants} registered participant${stats.totalParticipants === 1 ? "" : "s"}.`}
        actions={
          <>
            <CohortSwitcher cohorts={cohorts} selected={challengeYear} />
            <Button asChild>
              <Link href={ROUTES.adminApplications}>
                <ClipboardList className="size-4" aria-hidden />
                Review applications
              </Link>
            </Button>
          </>
        }
      />

      {/*
        Only once there is a previous cycle to compare against. A
        year-over-year strip in the first year of a challenge is four dashes
        pretending to be information.
      */}
      {comparison?.previous && comparison.delta && (
        <CohortComparisonStrip
          currentYear={challengeYear}
          previousYear={comparison.previous.challengeYear}
          current={comparison.current}
          delta={comparison.delta}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Total applications"
          value={stats.total}
          icon={ClipboardList}
          href={applicationsHref()}
        />
        <StatTile
          label="Awaiting review"
          // Kept to one line: the tiles are a grid row, so a hint that wraps
          // stretches all five tiles and leaves a gap under every other number.
          hint="In the reviewer queue"
          value={stats.pendingReview}
          icon={Inbox}
          tone="info"
          href={applicationsHref([
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.UNDER_REVIEW,
            ApplicationStatus.REVISION_REQUESTED,
          ])}
        />
        <StatTile
          label="Drafts"
          value={stats.drafts}
          hint="Not submitted yet"
          icon={FileEdit}
          href={applicationsHref([ApplicationStatus.DRAFT])}
        />
        <StatTile
          label="Approved"
          value={stats.approved}
          icon={CheckCircle2}
          tone="success"
          href={applicationsHref([ApplicationStatus.APPROVED])}
        />
        <StatTile
          label="Rejected"
          value={stats.rejected}
          icon={XCircle}
          tone="danger"
          href={applicationsHref([ApplicationStatus.REJECTED])}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applications by status</CardTitle>
            <CardDescription>Where every entry sits in the workflow.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={statusChartData} emptyLabel="No applications yet" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submissions over time</CardTitle>
            <CardDescription>Entries submitted each day this cycle.</CardDescription>
          </CardHeader>
          <CardContent>
            <SubmissionTrendChart
              data={stats.submissionsByDay}
              emptyLabel="Nothing has been submitted yet"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Who is entering</CardTitle>
          <CardDescription>
            The same count, cut four ways. Sections show the top ten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BreakdownTabs
            bySchool={stats.bySchool.map((entry) => ({ label: entry.label, count: entry.count }))}
            bySection={stats.bySection.map((entry) => ({ label: entry.label, count: entry.count }))}
            byYearLevel={stats.byYearLevel.map((entry) => ({
              label: entry.label,
              count: entry.count,
            }))}
            byTheme={stats.byTheme.map((entry) => ({ label: entry.label, count: entry.count }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Recent submissions</CardTitle>
              <CardDescription>The eight most recently submitted entries.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={ROUTES.adminApplications}>View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.recent.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No submissions yet"
              description="Entries will appear here as teams submit them."
            />
          ) : (
            <ul className="divide-y">
              {stats.recent.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={ROUTES.adminApplication(entry.id)}
                    className="flex flex-wrap items-center gap-3 py-3 transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {entry.projectTitle ?? "Untitled venture"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.teamName ? `Team ${entry.teamName}` : entry.applicantName}
                        {entry.referenceNumber && ` · ${entry.referenceNumber}`}
                      </p>
                    </div>
                    <StatusBadge status={entry.status} />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {entry.submittedAt
                        ? formatDate(entry.submittedAt, {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
