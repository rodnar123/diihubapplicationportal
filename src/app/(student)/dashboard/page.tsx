import type { Metadata } from "next";

import { StudentDashboardView } from "@/components/dashboard/student-dashboard-view";
import { requireStudent } from "@/lib/auth/session";
import { getApplicationOverview } from "@/services/application/application-service";
import { getMemberApplications } from "@/services/application/membership-service";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The student's own dashboard. The view is {@link StudentDashboardView}, shared
 * with the staff preview at `/admin/preview`; this loads the caller's entry.
 */
export default async function StudentDashboardPage() {
  const user = await requireStudent();
  const { application, settings, statusHistory, sharedComments } =
    await getApplicationOverview(user);

  /*
   * Entries this student is *named on* but does not own.
   *
   * Every other read here is scoped to `ownerId`, which is why a team member
   * could previously see nothing at all — they were on a roster, but the portal
   * had no way to know it was them until roster lines carried an account.
   */
  const memberships = await getMemberApplications(user.id, settings["challenge.year"]);

  return (
    <StudentDashboardView
      greetingName={user.profile.firstName || user.name}
      application={application}
      settings={settings}
      statusHistory={statusHistory}
      sharedComments={sharedComments}
      memberships={memberships}
    />
  );
}
