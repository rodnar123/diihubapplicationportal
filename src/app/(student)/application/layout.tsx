import { ApplicationWizardFrame } from "@/components/application/application-wizard-frame";
import { assessCompleteness } from "@/domain/application/completeness";
import { isEditableByStudent } from "@/domain/application/status";
import { requireStudent } from "@/lib/auth/session";
import { loadStudentApplication } from "@/services/application/application-service";
import { getAppSettings } from "@/services/settings/settings-service";

/**
 * The wizard frame for the student's own application. The frame itself lives in
 * {@link ApplicationWizardFrame}, shared with the staff preview; this loads the
 * entry it describes.
 */
export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();
  const [{ application }, settings] = await Promise.all([
    loadStudentApplication(user),
    getAppSettings(),
  ]);

  return (
    <ApplicationWizardFrame
      application={application}
      report={assessCompleteness(application, settings)}
      readOnly={!isEditableByStudent(application.status)}
    >
      {children}
    </ApplicationWizardFrame>
  );
}
