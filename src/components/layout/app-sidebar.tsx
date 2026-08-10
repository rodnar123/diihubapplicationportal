"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLockup } from "@/components/brand/university-mark";
import { NAV_ICONS, type NavGroup } from "@/components/layout/nav-config";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { ROUTES } from "@/lib/routes";

function isActive(pathname: string, href: string, matchPrefix?: boolean): boolean {
  if (pathname === href) return true;
  return Boolean(matchPrefix && pathname.startsWith(`${href}/`));
}

export function AppSidebar({
  groups,
  isAdmin,
  footer,
}: {
  groups: NavGroup[];
  isAdmin: boolean;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          href={ROUTES.home}
          className="flex items-center rounded-md px-1 py-1.5 group-data-[collapsible=icon]:justify-center focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          onClick={() => setOpenMobile(false)}
        >
          <BrandLockup className="group-data-[collapsible=icon]:[&_span:last-child]:hidden" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => {
          const items = group.items.filter((item) => !item.adminOnly || isAdmin);
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = isActive(pathname, item.href, item.matchPrefix);
                    // Resolved here, on the client — the icon arrives as a name.
                    const Icon = NAV_ICONS[item.icon];

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          onClick={() => setOpenMobile(false)}
                        >
                          <Link href={item.href} aria-current={active ? "page" : undefined}>
                            <Icon aria-hidden />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
