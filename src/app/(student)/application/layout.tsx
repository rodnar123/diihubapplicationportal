import { Lock } from "lucide-react";

import { StepProgress } from "@/components/application/step-progress";
import { StatusBadge } from "@/components/application/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { assessCompleteness } from "@/domain/application/completeness";
import { isEditableByStudent } from "@/domain/application/status";
import { requireStudent } from "@/lib/auth/session";
import { loadStudentApplication } from "@/services/application/application-service";
import { getAppSettings } from "@/services/settings/settings-service";

/**
 * Two-column wizard frame: the progress rail on the left, the active step on
 * the right. The rail is rendered here so it does not remount (and lose its
 * scroll position) as the student moves between steps.
 */
export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();
  const [{ application }, settings] = await Promise.all([
    loadStudentApplication(user),
    getAppSettings(),
  ]);

  const report = assessCompleteness(application, settings);
  const readOnly = !isEditableByStudent(application.status);

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
            />
          </CardContent>
        </Card>
      </aside>

      <div className="min-w-0 space-y-6">
        {readOnly && (
          <Alert>
            <Lock className="size-4" aria-hidden />
            <AlertTitle>This application is locked</AlertTitle>
            <AlertDescription>
              It has been submitted to the challenge office, so it can no longer be edited. You can
              still read every section and download a PDF copy.
            </AlertDescription>
          </Alert>
        )}

        {children}
      </div>
    </div>
  );
}
