import { AlternativesStep } from "@/components/application/steps/alternatives-step";
import { ApplicantStep } from "@/components/application/steps/applicant-step";
import { AttachmentsStep } from "@/components/application/steps/attachments-step";
import { DeclarationStep } from "@/components/application/steps/declaration-step";
import { ImpactStep } from "@/components/application/steps/impact-step";
import { PrototypeStep } from "@/components/application/steps/prototype-step";
import { ReviewSubmitPanel } from "@/components/application/steps/review-step";
import { TeamStep } from "@/components/application/steps/team-step";
import { VentureStep } from "@/components/application/steps/venture-step";
import { ApplicationSummary } from "@/components/application/application-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assessCompleteness } from "@/domain/application/completeness";
import type { ApplicationDto, ApplicantDto } from "@/domain/application/types";
import { submissionWindow, type AppSettings } from "@/domain/settings/app-settings";
import {
  acceptAttributeFor,
  describeAllowedTypes,
} from "@/domain/settings/app-settings";
import { getStep, nextStep, previousStep, type ApplicationStepSlug } from "@/domain/application/steps";
import { ApplicationStatus } from "@/generated/prisma/enums";
import type { SchoolOption } from "@/services/reference/reference-data";

/**
 * One step of the wizard, card and all.
 *
 * This lives outside the route because two routes render it: the student's own
 * `/application/[step]`, and the staff preview at `/admin/preview/[step]`. If
 * the switch below were inlined in the student route, the preview would need a
 * copy of it — and a copy is a thing that drifts. Staff would end up reviewing
 * a form that no longer matched the one students fill in, which defeats the
 * purpose of having a preview at all.
 *
 * Everything it needs is passed in; it performs no reads of its own, so the
 * caller decides whether the data came from the database or from
 * `buildPreviewApplication`.
 */
export function ApplicationStepBody({
  slug,
  application,
  applicant,
  settings,
  schools,
  sectionLookup,
  readOnly,
  hrefFor,
  allowDownload = true,
}: {
  slug: ApplicationStepSlug;
  application: ApplicationDto;
  applicant: ApplicantDto;
  settings: AppSettings;
  schools: SchoolOption[];
  sectionLookup: Map<string, { name: string; schoolName: string }>;
  readOnly: boolean;
  /** Builds the back/next links, so the preview can stay inside `/admin`. */
  hrefFor: (step: string) => string;
  /**
   * Off for the preview: its attachment ids are synthetic, so a download link
   * would resolve to nothing.
   */
  allowDownload?: boolean;
}) {
  const step = getStep(slug);
  const previous = previousStep(slug);
  const next = nextStep(slug);
  const previousHref = previous ? hrefFor(previous.slug) : null;
  const nextHref = next ? hrefFor(next.slug) : null;

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
              allowDownload={allowDownload}
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
