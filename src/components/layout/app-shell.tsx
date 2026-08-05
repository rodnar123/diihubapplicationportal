import { AppSidebar } from "@/components/layout/app-sidebar";
import type { NavGroup } from "@/components/layout/nav-config";
import { UserMenu } from "@/components/layout/user-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Role } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";

const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  REVIEWER: "Reviewer",
  ADMIN: "Administrator",
};

/**
 * The signed-in application frame: collapsible sidebar, sticky header and a
 * main region that owns the page's scroll.
 */
export function AppShell({
  user,
  navigation,
  headerActions,
  children,
}: {
  user: SessionUser;
  navigation: NavGroup[];
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar
        groups={navigation}
        isAdmin={user.role === Role.ADMIN}
        footer={
          <UserMenu name={user.name} email={user.email} roleLabel={ROLE_LABELS[user.role]} />
        }
      />

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur print:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="flex flex-1 items-center justify-end gap-2">{headerActions}</div>
        </header>

        <main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
