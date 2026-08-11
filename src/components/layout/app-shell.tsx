import { AppSidebar } from "@/components/layout/app-sidebar";
import type { NavGroup } from "@/components/layout/nav-config";
import { UserMenu } from "@/components/layout/user-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UNIVERSITY_SHORT_NAME } from "@/domain/challenge/constants";
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
        {/*
          The header shares the sidebar's surface and foreground so the two
          read as one piece of chrome rather than two competing bars.

          Three things hold that illusion together, and all three have to stay
          in step with <AppSidebar>: the same `h-14`, so the two bottom
          hairlines meet as a single rule; the same gold hairline colour; and
          `.on-brand-control` on every control, so a button in the header
          behaves exactly like the brand link in the sidebar next to it. The
          gradient's first stop is the sidebar's own first stop, which is what
          makes the seam at x=16rem disappear.
        */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-gold-hairline bg-gradient-brand px-4 text-sidebar-foreground print:hidden">
          <SidebarTrigger className="on-brand-control -ml-1.5" />
          <Separator orientation="vertical" className="mr-1 h-4 bg-white/20" />

          <span className="min-w-0 truncate text-sm font-medium tracking-tight text-sidebar-foreground/90 md:hidden">
            {UNIVERSITY_SHORT_NAME}
          </span>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{headerActions}</div>
        </header>

        <main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
