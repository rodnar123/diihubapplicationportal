"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UniversityCrest } from "@/components/brand/university-mark";
import { NAV_ICONS, type NavGroup } from "@/components/layout/nav-config";
import { CHALLENGE_NAME, UNIVERSITY_SHORT_NAME } from "@/domain/challenge/constants";
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
      {/*
        The lockup is composed here rather than reusing <BrandLockup> so the
        text block can be dropped cleanly in icon-collapsed mode, and so the
        wordmark can be the short form. The full university name overflowed the
        16rem sidebar; `min-w-0` + `truncate` now bound it whatever the string.

        `h-14` is not decoration: it is the app header's height. Pinning the two
        to the same number is what makes their bottom hairlines meet as one rule
        across the window instead of stepping at the sidebar's edge. The header
        that grew to fit its own padding was what pushed the wordmark out of
        line, so the padding here is horizontal only and the text block is given
        explicit leading that fits inside the row.
      */}
      <SidebarHeader className="h-14 shrink-0 justify-center border-b border-gold-hairline px-2 py-0">
        <Link
          href={ROUTES.home}
          className="on-brand-control flex h-10 min-w-0 items-center gap-2.5 px-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          onClick={() => setOpenMobile(false)}
        >
          <UniversityCrest size={32} />
          <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm/5 font-semibold tracking-tight text-sidebar-foreground">
              {UNIVERSITY_SHORT_NAME}
            </span>
            <span className="truncate text-[11px]/4 text-sidebar-foreground/70">
              {CHALLENGE_NAME}
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => {
          const items = group.items.filter((item) => !item.adminOnly || isAdmin);
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[11px] font-semibold tracking-[0.08em] text-brand/75 uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = isActive(pathname, item.href, item.matchPrefix);
                    // Resolved here, on the client — the icon arrives as a name.
                    const Icon = NAV_ICONS[item.icon];

                    return (
                      <SidebarMenuItem key={item.href}>
                        {/*
                          The active item is marked with a gold rail and a gold
                          icon rather than by the maroon fill alone. On a maroon
                          gradient the fill is a weak signal — and gold is the
                          third colour of the identity, which otherwise appears
                          nowhere in the navigation. `inset` keeps the rail
                          inside the button's own rounding.
                        */}
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          onClick={() => setOpenMobile(false)}
                          className="data-active:shadow-[inset_2px_0_0_0_var(--sidebar-primary)] data-active:[&_svg]:text-sidebar-primary"
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
