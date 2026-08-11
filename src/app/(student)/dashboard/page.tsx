import type { Metadata } from "next";

import { StudentDashboardView } from "@/components/dashboard/student-dashboard-view";
import { requireStudent } from "@/lib/auth/session";
import { getApplicationOverview } from "@/services/application/application-service";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The student's own dashboard. The view is {@link StudentDashboardView}, shared
 * with the staff preview at `/admin/preview`; this loads the caller's entry.
 */
export default async function StudentDashboardPage() {
  const user = await requireStudent();
  const { application, settings, statusHistory, sharedComments } =
    await getApplicationOverview(user);

  return (
    <StudentDashboardView
      greetingName={user.profile.firstName || user.name}
      application={application}
      settings={settings}
      statusHistory={statusHistory}
      sharedComments={sharedComments}
    />
  );
}
