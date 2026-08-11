import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApplicationStepBody } from "@/components/application/application-step-body";
import { ApplicationWizardFrame } from "@/components/application/application-wizard-frame";
import { PageHeader } from "@/components/layout/page-header";
import { assessCompleteness } from "@/domain/application/completeness";
import { buildPreviewApplicationWithApplicant } from "@/domain/application/preview";
import { getStep, isApplicationStepSlug, STEP_SLUGS } from "@/domain/application/steps";
import { requireReviewer } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getSchoolsWithSections, getSectionLookup } from "@/services/reference/reference-data";
import { getAppSettings } from "@/services/settings/settings-service";

import { PreviewBanner } from "../preview-banner";

export async function generateStaticParams() {
  return STEP_SLUGS.map((step) => ({ step }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ step: string }>;
}): Promise<Metadata> {
  const { step } = await params;
  if (!isApplicationStepSlug(step)) return { title: "Student portal preview" };
  return { title: `${getStep(step).title} · Preview` };
}

/**
 * One step of the student wizard, rendered for staff.
 *
 * The step, the frame and the progress rail are the student's own components —
 * only the data differs. It comes from `buildPreviewApplicationWithApplicant`,
 * which allocates nothing: no `applications` row, no audit entry, no effect on
 * the dashboard counts or the exports. The reference tables are read for real,
 * so the school and section selects show the options students actually get.
 */
export default async function PreviewStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step: slug } = await params;
  if (!isApplicationStepSlug(slug)) notFound();

  await requireReviewer();

  const [settings, schools, sectionLookup] = await Promise.all([
    getAppSettings(),
    getSchoolsWithSections(),
    getSectionLookup(),
  ]);

  const { application, applicant } = buildPreviewApplicationWithApplicant(
    settings["challenge.year"],
  );

  return (
    <>
      <PageHeader
        title="Student portal preview"
        description="The application form exactly as students fill it in."
        breadcrumbs={[
          { label: "Admin", href: ROUTES.admin },
          { label: "Student portal", href: ROUTES.adminPreview },
          { label: getStep(slug).shortTitle },
        ]}
      />

      <ApplicationWizardFrame
        application={application}
        report={assessCompleteness(application, settings)}
        readOnly
        stepBasePath={ROUTES.adminPreview}
        notice={<PreviewBanner />}
      >
        <ApplicationStepBody
          slug={slug}
          application={application}
          applicant={applicant}
          settings={settings}
          schools={schools}
          sectionLookup={sectionLookup}
          readOnly
          hrefFor={ROUTES.adminPreviewStep}
          allowDownload={false}
        />
      </ApplicationWizardFrame>
    </>
  );
}
