"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { StatusBadge } from "@/components/application/status-badge";
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
import { callAction } from "@/lib/client-action";
import { ROUTES } from "@/lib/routes";
import { searchApplicationsAction } from "@/app/(admin)/admin/actions";
import type { ApplicationSearchHit } from "@/services/admin/application-query";

/** Below this, a search matches so much that the results are noise. */
const MIN_QUERY = 2;

/** Long enough to skip the intermediate states of a typed reference number. */
const DEBOUNCE_MS = 250;

/**
 * Keyboard-first navigation and application lookup (⌘K / Ctrl+K).
 *
 * Destinations are built from the same `NavGroup` data as the sidebar, so a
 * new page appears in both without being registered twice. Reviewers
 * additionally get free-text application search, which runs on the server
 * against the same fields as the review console's own search box.
 */
export function CommandPalette({
  groups,
  isAdmin,
  canSearchApplications = false,
}: {
  groups: NavGroup[];
  isAdmin: boolean;
  /**
   * Whether to offer application search. A convenience only — the action
   * behind it checks the caller's role for itself.
   */
  canSearchApplications?: boolean;
}) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /**
   * The last completed lookup, tagged with the term it answers.
   *
   * One piece of state rather than three, because "searching", "these are the
   * hits" and "it failed" are all just questions about whether a result for
   * the current term has arrived yet — and storing them separately meant
   * resetting them synchronously inside the effect, which costs a render pass
   * on every keystroke and risks the three disagreeing mid-type.
   */
  const [lookup, setLookup] = useState<{
    term: string;
    hits: ApplicationSearchHit[];
    error: string | null;
  } | null>(null);

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

  const term = query.trim();

  /*
   * Debounced server lookup.
   *
   * The `cancelled` flag matters as much as the timer: clearing the timeout
   * stops a *pending* request, but one already in flight still resolves, and
   * without the guard a slow early response could land after a faster later
   * one and repopulate the list with results for a query the reviewer has
   * moved on from.
   */
  useEffect(() => {
    if (!canSearchApplications || !open) return;
    if (term.length < MIN_QUERY) return;
    if (lookup?.term === term) return; // already answered

    let cancelled = false;

    const timer = setTimeout(async () => {
      const result = await callAction(() => searchApplicationsAction(term));
      if (cancelled) return;

      // A failed lookup is not an empty one. Reporting "no matches" for a
      // request that never completed would tell a reviewer the entry does not
      // exist, which is exactly the wrong conclusion.
      setLookup({
        term,
        hits: result.ok ? result.data.results : [],
        error: result.ok ? null : result.message,
      });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, canSearchApplications, open, lookup?.term]);

  // Start clean each time, rather than reopening onto a stale search.
  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setLookup(null);
    }
  }, []);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  /*
   * cmdk's own filtering is off, because it would re-test the server's results
   * against the raw query and drop any match the database found on a field the
   * item does not display — a student ID, say. So the destinations are matched
   * here instead, over the same text cmdk would have used.
   */
  const needle = term.toLowerCase();
  const matchedGroups = groups
    .map((group) => ({
      label: group.label,
      items: group.items.filter(
        (item) =>
          (!item.adminOnly || isAdmin) &&
          (needle.length === 0 ||
            `${item.label} ${item.description}`.toLowerCase().includes(needle)),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const themeMatches = needle.length === 0 || "theme dark light appearance".includes(needle);
  const showApplications = canSearchApplications && term.length >= MIN_QUERY;

  // Derived, not stored: a result is current only if it answers this term.
  const answered = lookup?.term === term;
  const searching = showApplications && !answered;
  const hits = answered ? (lookup?.hits ?? []) : [];
  const searchError = answered ? (lookup?.error ?? null) : null;

  // Only when the whole list is empty. The Applications group reports its own
  // searching/empty/failed state, so letting this render beside it produced
  // "No matches." directly above a group that was still describing itself.
  const nothingAtAll = !showApplications && matchedGroups.length === 0 && !themeMatches;

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
        onOpenChange={onOpenChange}
        title="Command palette"
        description={
          canSearchApplications
            ? "Search applications, or jump to a page"
            : "Jump to a page or change a setting"
        }
        shouldFilter={false}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={
            canSearchApplications
              ? "Search a reference, team, project or student…"
              : "Type a page name…"
          }
        />
        <CommandList>
          {nothingAtAll && <CommandEmpty>No matches.</CommandEmpty>}

          {showApplications && (
            <CommandGroup heading="Applications">
              {searching && hits.length === 0 && (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Searching…
                </div>
              )}

              {!searching && searchError && (
                <div className="px-2 py-3 text-sm text-destructive" role="alert">
                  {searchError}
                </div>
              )}

              {!searching && !searchError && hits.length === 0 && (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  No application matches &ldquo;{term}&rdquo;.
                </div>
              )}

              {hits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={hit.id}
                  onSelect={() => run(() => router.push(ROUTES.adminApplication(hit.id)))}
                >
                  <FileText className="size-4" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {hit.projectTitle || "Untitled venture"}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {hit.referenceNumber ?? "—"}
                    </span>
                  </span>
                  <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:inline">
                    {hit.teamName ? `Team ${hit.teamName}` : hit.applicantName}
                  </span>
                  <StatusBadge status={hit.status} showIcon={false} />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {showApplications && matchedGroups.length > 0 && <CommandSeparator />}

          {matchedGroups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                return (
                  <CommandItem
                    key={item.href}
                    value={item.href}
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
          ))}

          {themeMatches && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Appearance">
                <CommandItem
                  value="toggle-theme"
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
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
