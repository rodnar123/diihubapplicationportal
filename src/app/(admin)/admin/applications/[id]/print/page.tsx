import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApplicationSummary } from "@/components/application/application-summary";
import { PrintTrigger } from "@/components/admin/print-trigger";
import { UniversityCrest } from "@/components/brand/university-mark";
import { APPLICATION_STATUS_META } from "@/domain/application/status";
import {
  CHALLENGE_HOST,
  CHALLENGE_NAME,
  UNIVERSITY_NAME,
} from "@/domain/challenge/constants";
import { requireReviewer } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import { getApplicationDetail } from "@/services/admin/review-service";

export const metadata: Metadata = {
  title: "Print application",
  robots: { index: false, follow: false },
};

/**
 * Print-optimised view.
 *
 * A separate route rather than a print stylesheet on the detail page, because
 * the review controls, comment box and history sidebar have no place on a
 * printed form — and hiding half a page with CSS tends to leave awkward gaps.
 */
export default async function PrintApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireReviewer();

  let detail;
  try {
    detail = await getApplicationDetail(id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const { application, applicant, schoolName, sectionName, sectionNameById } = detail;
  const statusMeta = APPLICATION_STATUS_META[application.status];

  return (
    <div className="mx-auto min-h-dvh max-w-4xl bg-background px-6 py-8 print:px-0 print:py-0">
      <PrintTrigger backHref={ROUTES.adminApplication(id)} />

      <header className="mb-8 border-b-2 border-primary pb-4">
        <div className="flex items-center gap-4">
          <UniversityCrest size={52} />
          <div>
            <p className="text-base font-semibold text-primary">{UNIVERSITY_NAME}</p>
            <p className="text-sm text-muted-foreground">{CHALLENGE_HOST}</p>
          </div>
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          {CHALLENGE_NAME} {application.challengeYear} — Application Form
        </h1>

        <dl className="mt-4 grid grid-cols-3 gap-4 rounded-md border bg-muted/40 px-4 py-3 text-sm print-surface">
          <div>
            <dt className="text-xs text-muted-foreground">Reference</dt>
            <dd className="font-mono font-medium">{application.referenceNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="font-medium">{statusMeta.label}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Submitted</dt>
            <dd className="font-medium">
              {application.submittedAt
                ? new Date(application.submittedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Not submitted"}
            </dd>
          </div>
        </dl>
      </header>

      <ApplicationSummary
        application={application}
        applicant={applicant}
        schoolName={schoolName}
        sectionName={sectionName}
        sectionNameById={sectionNameById}
      />

      <section className="mt-10 break-inside-avoid rounded-md border border-brand/50 bg-brand/5 p-4">
        <h2 className="text-xs font-semibold tracking-wide text-brand-foreground uppercase dark:text-brand">
          For official use only
        </h2>

        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <div className="h-10 border-b border-foreground" />
            <p className="mt-1 text-xs text-muted-foreground">Reviewer signature</p>
          </div>
          <div>
            <div className="h-10 border-b border-foreground" />
            <p className="mt-1 text-xs text-muted-foreground">Date</p>
          </div>
        </div>
      </section>

      <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">
        <p>
          {CHALLENGE_NAME} · {CHALLENGE_HOST} · {UNIVERSITY_NAME}
        </p>
        <p>Printed {new Date().toLocaleString()}</p>
      </footer>
    </div>
  );
}
