import { AppShell } from "@/components/layout/app-shell";
import { HeaderActions } from "@/components/layout/header-actions";
import { STUDENT_NAV } from "@/components/layout/nav-config";
import { requireStudent } from "@/lib/auth/session";

/**
 * Every student route re-checks the role against the database. The proxy has
 * already confirmed there *is* a session; this confirms whose it is.
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();

  return (
    <AppShell
      user={user}
      navigation={STUDENT_NAV}
      headerActions={<HeaderActions user={user} navigation={STUDENT_NAV} />}
    >
      {children}
    </AppShell>
  );
}
