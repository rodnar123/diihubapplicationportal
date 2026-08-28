import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { ApplicationSummary } from "@/components/application/application-summary";
import { StatusBadge } from "@/components/application/status-badge";
import { StatusTimeline } from "@/components/application/status-timeline";
import { DeleteApplicationButton } from "@/components/admin/application-delete-controls";
import { CommentThread } from "@/components/admin/comment-thread";
import { PrintLink } from "@/components/admin/print-trigger";
import { ReviewPanel } from "@/components/admin/review-panel";
import { AssignReviewers } from "@/components/admin/assign-reviewers";
import { ScorecardPanel } from "@/components/admin/scorecard-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdmin, requireReviewer } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { getApplicationDetail } from "@/services/admin/review-service";
import { getPanelMembers, getReviewPanel } from "@/services/admin/scoring-service";

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

  // Independent of each other and of the detail read above, so they go together
  // rather than stacking three round trips to the pooler on one render.
  const [panel, panelMembers] = await Promise.all([
    getReviewPanel(reviewer, id),
    isAdmin(reviewer.role) ? getPanelMembers() : Promise.resolve([]),
  ]);

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
            <PrintLink href={ROUTES.adminApplicationPrint(id)} />
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
            <CardTitle>Application</CardTitle>
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
              <CardTitle>Review</CardTitle>
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

          {/*
            Below the decision panel, not above it. The order is the argument:
            a reviewer decides, and the marks inform that — putting a percentage
            first would invite the panel to read the number as the verdict.
          */}
          <ScorecardPanel
            criteria={panel.criteria}
            cards={panel.cards}
            aggregate={panel.score}
          />

          {isAdmin(reviewer.role) && (
            <AssignReviewers
              applicationId={id}
              members={panelMembers}
              assigned={panel.cards.map((card) => ({
                assignmentId: card.assignmentId,
                reviewerId: card.reviewerId,
                reviewerName: card.reviewerName,
                status: card.status,
              }))}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Comments &amp; notes</CardTitle>
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
              <CardTitle>History</CardTitle>
              <CardDescription>Every status change on this application.</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusTimeline events={detail.statusHistory} />
            </CardContent>
          </Card>

          {/*
            Administrators only, and last on the page on purpose: a reviewer's
            work is the decision panel at the top, and the control that removes
            the entry outright should not sit next to it.
          */}
          {isAdmin(reviewer.role) && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle>Delete this application</CardTitle>
                <CardDescription>
                  Removes the entry from the console and from {applicant.fullName}&rsquo;s
                  dashboard, and frees the team to start again this challenge year. It can
                  be restored from the deleted list.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteApplicationButton
                  applicationId={id}
                  referenceNumber={application.referenceNumber}
                  projectTitle={application.projectTitle}
                  ownerName={applicant.fullName}
                  redirectTo={ROUTES.adminApplications}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
