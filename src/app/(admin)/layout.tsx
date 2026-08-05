import { AppShell } from "@/components/layout/app-shell";
import { HeaderActions } from "@/components/layout/header-actions";
import { ADMIN_NAV } from "@/components/layout/nav-config";
import { requireReviewer } from "@/lib/auth/session";

/**
 * Guards the whole `/admin` tree. The proxy only knows a session exists; the
 * role is checked here against the database on every request.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireReviewer();

  return (
    <AppShell
      user={user}
      navigation={ADMIN_NAV}
      headerActions={<HeaderActions user={user} navigation={ADMIN_NAV} />}
    >
      {children}
    </AppShell>
  );
}
