import { redirect } from "next/navigation";

import { assessCompleteness } from "@/domain/application/completeness";
import { isEditableByStudent } from "@/domain/application/status";
import { requireStudent } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { loadStudentApplication } from "@/services/application/application-service";
import { getAppSettings } from "@/services/settings/settings-service";

/**
 * `/application` is an entry point, not a page: it drops the student at the
 * first section that still needs work — or at the review screen once
 * everything is done.
 */
export default async function ApplicationEntryPage() {
  const user = await requireStudent();
  const [{ application }, settings] = await Promise.all([
    loadStudentApplication(user),
    getAppSettings(),
  ]);

  if (!isEditableByStudent(application.status)) {
    redirect(ROUTES.applicationReview);
  }

  const report = assessCompleteness(application, settings);
  const firstIncomplete = report.steps.find((step) => step.required && !step.complete);

  redirect(
    firstIncomplete ? ROUTES.applicationStep(firstIncomplete.slug) : ROUTES.applicationReview,
  );
}
