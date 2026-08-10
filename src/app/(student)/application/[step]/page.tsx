import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApplicationSummary } from "@/components/application/application-summary";
import { AlternativesStep } from "@/components/application/steps/alternatives-step";
import { ApplicantStep } from "@/components/application/steps/applicant-step";
import { AttachmentsStep } from "@/components/application/steps/attachments-step";
import { DeclarationStep } from "@/components/application/steps/declaration-step";
import { ImpactStep } from "@/components/application/steps/impact-step";
import { PrototypeStep } from "@/components/application/steps/prototype-step";
import { ReviewSubmitPanel } from "@/components/application/steps/review-step";
import { TeamStep } from "@/components/application/steps/team-step";
import { VentureStep } from "@/components/application/steps/venture-step";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assessCompleteness } from "@/domain/application/completeness";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { isEditableByStudent } from "@/domain/application/status";
import {
  getStep,
  isApplicationStepSlug,
  nextStep,
  previousStep,
  STEP_SLUGS,
} from "@/domain/application/steps";
import { acceptAttributeFor, describeAllowedTypes, submissionWindow } from "@/domain/settings/app-settings";
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

export default async function ApplicationStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step: slug } = await params;
  if (!isApplicationStepSlug(slug)) notFound();

  const step = getStep(slug);
  const user = await requireStudent();

  const [{ application, applicant }, settings, schools, sectionLookup] = await Promise.all([
    loadStudentApplication(user),
    getAppSettings(),
    getSchoolsWithSections(),
    getSectionLookup(),
  ]);

  const readOnly = !isEditableByStudent(application.status);
  const previous = previousStep(slug);
  const next = nextStep(slug);
  const previousHref = previous ? ROUTES.applicationStep(previous.slug) : null;
  const nextHref = next ? ROUTES.applicationStep(next.slug) : null;

  const accept = acceptAttributeFor(settings["uploads.allowedMimeTypes"]);
  const allowedTypesLabel = describeAllowedTypes(settings["uploads.allowedMimeTypes"]);

  const body = (() => {
    switch (slug) {
      case "applicant":
        return (
          <ApplicantStep
            application={application}
            applicant={applicant}
            schools={schools}
            readOnly={readOnly}
            previousHref={previousHref}
            nextHref={nextHref}
          />
        );
      case "team":
        return (
          <TeamStep
            application={application}
            applicant={applicant}
            schools={schools}
            minSize={settings["team.minSize"]}
            maxSize={settings["team.maxSize"]}
            readOnly={readOnly}
            previousHref={previousHref}
            nextHref={nextHref}
          />
        );
      case "venture":
        return (
          <VentureStep
            application={application}
            themes={settings["challenge.themes"]}
            readOnly={readOnly}
            previousHref={previousHref}
            nextHref={nextHref}
          />
        );
      case "prototype":
        return (
          <PrototypeStep
            application={application}
            readOnly={readOnly}
            previousHref={previousHref}
            nextHref={nextHref}
          />
        );
      case "alternatives":
        return (
          <AlternativesStep
            application={application}
            readOnly={readOnly}
            previousHref={previousHref}
            nextHref={nextHref}
          />
        );
      case "impact":
        return (
          <ImpactStep
            application={application}
            readOnly={readOnly}
            previousHref={previousHref}
            nextHref={nextHref}
          />
        );
      case "attachments":
        return (
          <AttachmentsStep
            application={application}
            accept={accept}
            maxFileSizeMb={settings["uploads.maxFileSizeMb"]}
            maxFiles={settings["uploads.maxFilesPerApplication"]}
            allowedTypesLabel={allowedTypesLabel}
            readOnly={readOnly}
            previousHref={previousHref}
            nextHref={nextHref}
          />
        );
      case "declaration":
        return (
          <DeclarationStep
            application={application}
            applicant={applicant}
            allowedMode={settings["declaration.mode"]}
            accept={accept}
            maxFileSizeMb={settings["uploads.maxFileSizeMb"]}
            allowedTypesLabel={allowedTypesLabel}
            readOnly={readOnly}
            previousHref={previousHref}
            nextHref={nextHref}
          />
        );
      case "review": {
        const report = assessCompleteness(application, settings);
        const window = submissionWindow(settings);

        const closedReason = !window.open
          ? window.reason === "NOT_YET_OPEN"
            ? `Submissions open on ${window.opensAt?.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}.`
            : `Submissions closed on ${window.closesAt?.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}.`
          : null;

        const school = schools.find((candidate) => candidate.id === application.schoolId);
        const section = application.sectionId ? sectionLookup.get(application.sectionId) : null;

        return (
          <div className="space-y-8">
            {!readOnly && (
              <ReviewSubmitPanel
                applicationId={application.id}
                report={report}
                isResubmission={application.status === ApplicationStatus.REVISION_REQUESTED}
                submissionClosedReason={closedReason}
              />
            )}

            <ApplicationSummary
              application={application}
              applicant={applicant}
              schoolName={school?.name ?? null}
              sectionName={section?.name ?? null}
              sectionNameById={Object.fromEntries(
                [...sectionLookup.entries()].map(([id, value]) => [id, value.name]),
              )}
              allowDownload
            />
          </div>
        );
      }
    }
  })();

  return (
    <Card>
      <CardHeader>
        {step.formSection && (
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {step.formSection}
          </p>
        )}
        <CardTitle className="text-xl">{step.title}</CardTitle>
        <CardDescription>{step.description}</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
