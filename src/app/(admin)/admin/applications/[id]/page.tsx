import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Printer } from "lucide-react";

import { ApplicationSummary } from "@/components/application/application-summary";
import { StatusBadge } from "@/components/application/status-badge";
import { StatusTimeline } from "@/components/application/status-timeline";
import { CommentThread } from "@/components/admin/comment-thread";
import { ReviewPanel } from "@/components/admin/review-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireReviewer } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { getApplicationDetail } from "@/services/admin/review-service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const detail = await getApplicationDetail(id);
    return {
      title: detail.application.referenceNumber ?? detail.application.projectTitle ?? "Application",
    };
  } catch {
    return { title: "Application" };
  }
}

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reviewer = await requireReviewer();

  let detail;
  try {
    detail = await getApplicationDetail(id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const { application, applicant, schoolName, sectionName, sectionNameById } = detail;

  // Viewing a student's submission is itself an auditable event.
  await recordAudit({
    action: AUDIT_ACTIONS.applicationViewed,
    entityType: "Application",
    entityId: id,
    actorId: reviewer.id,
    actorEmail: reviewer.email,
  });

  return (
    <>
      <PageHeader
        title={application.projectTitle ?? "Untitled venture"}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusBadge status={application.status} />
            {application.referenceNumber && (
              <span className="font-mono text-xs">{application.referenceNumber}</span>
            )}
            <span>·</span>
            <span>
              {application.team?.name ? `Team ${application.team.name}` : "No team name"} ·{" "}
              {applicant.fullName}
            </span>
          </span>
        }
        breadcrumbs={[
          { label: "Admin", href: ROUTES.admin },
          { label: "Applications", href: ROUTES.adminApplications },
          { label: application.referenceNumber ?? "Application" },
        ]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.adminApplicationPrint(id)} target="_blank">
                <Printer className="size-4" aria-hidden />
                Print
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={ROUTES.applicationPdf(id)} download>
                <Download className="size-4" aria-hidden />
                Download PDF
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle className="text-base">Application</CardTitle>
            <CardDescription>
              Everything the team submitted, in the order of the official form.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApplicationSummary
              application={application}
              applicant={applicant}
              schoolName={schoolName}
              sectionName={sectionName}
              sectionNameById={sectionNameById}
              allowDownload
            />
          </CardContent>
        </Card>

        <div className="order-1 space-y-6 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review</CardTitle>
              <CardDescription>Record a decision on this entry.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReviewPanel
                applicationId={id}
                currentStatus={application.status}
                reviewerRole={reviewer.role}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comments &amp; notes</CardTitle>
              <CardDescription>
                Internal notes stay with the panel; shared comments reach the team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CommentThread applicationId={id} comments={detail.comments} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
              <CardDescription>Every status change on this application.</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusTimeline events={detail.statusHistory} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
