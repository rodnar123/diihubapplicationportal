import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApplicationStepBody } from "@/components/application/application-step-body";
import { isEditableByStudent } from "@/domain/application/status";
import { getStep, isApplicationStepSlug, STEP_SLUGS } from "@/domain/application/steps";
import { requireStudent } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { loadStudentApplication } from "@/services/application/application-service";
import { getSchoolsWithSections, getSectionLookup } from "@/services/reference/reference-data";
import { getAppSettings } from "@/services/settings/settings-service";

export async function generateStaticParams() {
  return STEP_SLUGS.map((step) => ({ step }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ step: string }>;
}): Promise<Metadata> {
  const { step } = await params;
  if (!isApplicationStepSlug(step)) return { title: "Application" };
  return { title: getStep(step).title };
}

/**
 * One step of the student's own application.
 *
 * The step itself is rendered by {@link ApplicationStepBody}, which the staff
 * preview at `/admin/preview/[step]` also uses. This route's job is to load the
 * caller's real entry and decide whether it is still editable.
 */
export default async function ApplicationStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step: slug } = await params;
  if (!isApplicationStepSlug(slug)) notFound();

  const user = await requireStudent();

  const [{ application, applicant }, settings, schools, sectionLookup] = await Promise.all([
    loadStudentApplication(user),
    getAppSettings(),
    getSchoolsWithSections(),
    getSectionLookup(),
  ]);

  return (
    <ApplicationStepBody
      slug={slug}
      application={application}
      applicant={applicant}
      settings={settings}
      schools={schools}
      sectionLookup={sectionLookup}
      readOnly={!isEditableByStudent(application.status)}
      hrefFor={ROUTES.applicationStep}
    />
  );
}
