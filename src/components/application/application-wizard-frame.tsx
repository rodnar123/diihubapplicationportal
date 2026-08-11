import { Lock } from "lucide-react";

import { StatusBadge } from "@/components/application/status-badge";
import { StepProgress } from "@/components/application/step-progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import type { CompletenessReport } from "@/domain/application/completeness";
import type { ApplicationDto } from "@/domain/application/types";

/**
 * Two-column wizard frame: the progress rail on the left, the active step on
 * the right.
 *
 * Shared by the student's `/application` layout and the staff preview, for the
 * same reason {@link ApplicationStepBody} is — one definition of what the
 * wizard looks like. The rail is rendered by the *layout* on the student side
 * so it does not remount, and lose its scroll position, as the student moves
 * between steps.
 */
export function ApplicationWizardFrame({
  application,
  report,
  readOnly,
  stepBasePath,
  notice,
  children,
}: {
  application: ApplicationDto;
  report: CompletenessReport;
  readOnly: boolean;
  /** Where the progress rail's links point. */
  stepBasePath?: string;
  /**
   * Replaces the "this application is locked" alert. The preview passes its
   * own banner: nothing is locked there, it simply is not a real entry.
   */
  notice?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start print:hidden">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {application.referenceNumber ?? `Draft · ${application.challengeYear}`}
              </span>
              <StatusBadge status={application.status} showIcon={false} />
            </div>

            <StepProgress
              steps={report.steps}
              percentComplete={report.percentComplete}
              canSubmit={report.canSubmit}
              basePath={stepBasePath}
            />
          </CardContent>
        </Card>
      </aside>

      <div className="min-w-0 space-y-6">
        {notice ??
          (readOnly && (
            <Alert>
              <Lock className="size-4" aria-hidden />
              <AlertTitle>This application is locked</AlertTitle>
              <AlertDescription>
                It has been submitted to the challenge office, so it can no longer be edited. You
                can still read every section and download a PDF copy.
              </AlertDescription>
            </Alert>
          ))}

        {children}
      </div>
    </div>
  );
}
