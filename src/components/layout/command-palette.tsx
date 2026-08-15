"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ICONS, type NavGroup } from "@/components/layout/nav-config";

/**
 * Keyboard-first navigation (⌘K / Ctrl+K).
 *
 * Built from the same `NavGroup` data as the sidebar, so a new destination
 * appears in both without being registered twice.
 */
export function CommandPalette({
  groups,
  isAdmin,
}: {
  groups: NavGroup[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <>
      {/* Sits on the maroon header. `.on-brand-control` is the same hover and
          gold focus ring the sidebar's items use, so the two bars match; the
          gold hairline round the shortcut key echoes the one under the bar. */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="on-brand-control border-gold-hairline gap-2 bg-white/10 hover:bg-white/20"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="border-gold-hairline hidden rounded border bg-white/10 px-1.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command palette"
        description="Jump to a page or change a setting"
      >
        <CommandInput placeholder="Type a page name…" />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>

          {groups.map((group) => {
            const items = group.items.filter((item) => !item.adminOnly || isAdmin);
            if (items.length === 0) return null;

            return (
              <CommandGroup key={group.label} heading={group.label}>
                {items.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  return (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.description}`}
                    onSelect={() => run(() => router.push(item.href))}
                  >
                    <Icon className="size-4" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    <span className="hidden max-w-64 truncate text-xs text-muted-foreground sm:inline">
                      {item.description}
                    </span>
                  </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}

          <CommandSeparator />

          <CommandGroup heading="Appearance">
            <CommandItem
              value="toggle theme dark light"
              onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
              {/* No CommandShortcut here: ⌘K opens this palette, it does not
                  toggle the theme, and advertising it as this item's shortcut
                  promised a binding that does not exist. */}
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
