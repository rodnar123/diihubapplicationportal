import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Download,
  FileText,
  MessageSquare,
  Paperclip,
  Users,
} from "lucide-react";

import { StatusBadge } from "@/components/application/status-badge";
import { StatusTimeline } from "@/components/application/status-timeline";
import { WithdrawApplicationDialog } from "@/components/application/withdraw-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { assessCompleteness } from "@/domain/application/completeness";
import { APPLICATION_STATUS_META, isEditableByStudent } from "@/domain/application/status";
import { CHALLENGE_NAME } from "@/domain/challenge/constants";
import { submissionWindow } from "@/domain/settings/app-settings";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { requireStudent } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getApplicationOverview } from "@/services/application/application-service";

export const metadata: Metadata = { title: "Dashboard" };

function formatDate(value: string | Date | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

export default async function StudentDashboardPage() {
  const user = await requireStudent();
  const { application, settings, statusHistory, sharedComments } =
    await getApplicationOverview(user);

  const window = submissionWindow(settings);
  const report = application ? assessCompleteness(application, settings) : null;
  const meta = application ? APPLICATION_STATUS_META[application.status] : null;
  const editable = application ? isEditableByStudent(application.status) : true;

  return (
    <>
      <PageHeader
        title={`Kia ora, ${user.profile.firstName || user.name}`}
        description={
          <>
            Your {CHALLENGE_NAME} {settings["challenge.year"]} entry lives here. Everything is saved
            as you go.
          </>
        }
        actions={
          application &&
          application.referenceNumber && (
            <Button asChild variant="outline">
              <a href={ROUTES.applicationPdf(application.id)} download>
                <Download className="size-4" aria-hidden />
                Download PDF
              </a>
            </Button>
          )
        }
      />

      {!window.open && editable && (
        <Alert>
          <CalendarClock className="size-4" aria-hidden />
          <AlertTitle>
            {window.reason === "NOT_YET_OPEN" ? "Submissions are not open yet" : "Submissions have closed"}
          </AlertTitle>
          <AlertDescription>
            {window.reason === "NOT_YET_OPEN"
              ? `You can keep working on your entry now. Submissions open on ${formatDate(window.opensAt)}.`
              : `The window closed on ${formatDate(window.closesAt)}. Contact the challenge office if you believe this is a mistake.`}
          </AlertDescription>
        </Alert>
      )}

      {!application ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={FileText}
              title="You haven't started an application yet"
              description={`Register your team and set out your venture for the ${CHALLENGE_NAME} ${settings["challenge.year"]}.`}
              action={
                <Button asChild>
                  <Link href={ROUTES.application}>
                    Start my application
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Primary status card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-balance">
                    {application.projectTitle || "Untitled venture"}
                  </CardTitle>
                  <CardDescription>
                    {application.team?.name ? `Team ${application.team.name}` : "Team not named yet"}
                    {application.referenceNumber && (
                      <>
                        {" · "}
                        <span className="font-mono">{application.referenceNumber}</span>
                      </>
                    )}
                  </CardDescription>
                </div>
                <StatusBadge status={application.status} />
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">{meta?.description}</p>

              {report && editable && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">Completeness</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {report.percentComplete}%
                    </span>
                  </div>
                  <Progress
                    value={report.percentComplete}
                    aria-label={`Application ${report.percentComplete}% complete`}
                  />
                  {!report.canSubmit && (
                    <p className="text-sm text-muted-foreground">
                      {report.blockingReasons.length} item
                      {report.blockingReasons.length === 1 ? "" : "s"} still to complete before you
                      can submit.
                    </p>
                  )}
                </div>
              )}

              <dl className="grid gap-4 border-t pt-4 sm:grid-cols-3">
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Users className="size-3.5" aria-hidden />
                    Team size
                  </dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">
                    {application.team?.members.length ?? 0} of {settings["team.maxSize"]}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Paperclip className="size-3.5" aria-hidden />
                    Attachments
                  </dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">
                    {application.attachments.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    {application.submittedAt ? "Submitted" : "Last saved"}
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {formatDate(application.submittedAt ?? application.updatedAt)}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button asChild>
                  <Link href={ROUTES.application}>
                    {editable ? "Continue my application" : "View my application"}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>

                {application.status === ApplicationStatus.SUBMITTED &&
                  settings["submission.allowWithdraw"] && (
                    <WithdrawApplicationDialog applicationId={application.id} />
                  )}
              </div>
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>Every change to your application&rsquo;s status.</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusTimeline events={statusHistory} />
            </CardContent>
          </Card>

          {/* Feedback from the panel */}
          {sharedComments.length > 0 && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="size-4" aria-hidden />
                  Feedback from the review panel
                </CardTitle>
                <CardDescription>
                  Address these points before you re-submit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {sharedComments.map((comment) => (
                    <li key={comment.id} className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-pretty text-sm">{comment.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {comment.authorName} · {formatDate(comment.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
