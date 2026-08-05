"use client";

import { ChevronsUpDown, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { ROUTES } from "@/lib/routes";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1 && parts[0].length > 0) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu({
  name,
  email,
  roleLabel,
}: {
  name: string;
  email: string;
  roleLabel: string;
}) {
  const { setTheme } = useTheme();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                  {initials(name, email)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs opacity-70">{roleLabel}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
          >
            <DropdownMenuLabel className="font-normal">
              <div className="grid text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Appearance
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {THEMES.map(({ value, label, icon: Icon }) => (
                <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
                  <Icon className="size-4" aria-hidden />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Sign-out is a POST so it cannot be triggered by a prefetch. */}
            <form action={ROUTES.signOut} method="post">
              <DropdownMenuItem asChild variant="destructive">
                <button type="submit" className="w-full">
                  <LogOut className="size-4" aria-hidden />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
