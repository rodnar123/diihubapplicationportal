"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ROLE_LABELS,
  USER_STATUS_FILTERS,
  type UserStatusFilter,
} from "@/domain/admin/user-query";
import { Role } from "@/generated/prisma/enums";

/**
 * Filters for the user directory.
 *
 * Same contract as the applications console: state lives in the URL so a view
 * can be bookmarked, shared and reached with the back button, and every change
 * is a navigation inside a transition so the table dims rather than blanking.
 */

const STATUS_LABELS: Record<UserStatusFilter, string> = {
  active: "Active",
  inactive: "Deactivated",
  deleted: "Deleted",
};

const ROLE_FILTER_ORDER = [Role.ADMIN, Role.REVIEWER, Role.STUDENT] as const;

export function UserFilters({ totalResults }: { totalResults: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("q") ?? "";
  const [searchText, setSearchText] = useState(currentQuery);
  const [syncedQuery, setSyncedQuery] = useState(currentQuery);

  // Keep the box in step with a URL changed from elsewhere (back button, "clear
  // all") without fighting the user mid-word. Adjusting state during render is
  // React's documented alternative to a syncing effect.
  if (syncedQuery !== currentQuery) {
    setSyncedQuery(currentQuery);
    setSearchText(currentQuery);
  }

  const selectedRoles = useMemo(
    () => (searchParams.get("role")?.split(",").filter(Boolean) ?? []) as Role[],
    [searchParams],
  );

  const selectedStatuses = useMemo(
    () =>
      (searchParams.get("status")?.split(",").filter(Boolean) ?? []) as UserStatusFilter[],
    [searchParams],
  );

  const hasAnyFilter =
    currentQuery.length > 0 || selectedRoles.length > 0 || selectedStatuses.length > 0;

  const apply = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");

    startTransition(() => {
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    });
  };

  const setParam = (key: string, value: string | null) =>
    apply((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

  const toggleInList = (key: string, value: string, current: string[]) => {
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    setParam(key, next.length > 0 ? next.join(",") : null);
  };

  // Applied on blur as well as Enter, so a typed term is never left showing in
  // the box while the count below reports the unfiltered set.
  const commitSearch = () => {
    const next = searchText.trim();
    if (next === currentQuery) return;
    setParam("q", next || null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            commitSearch();
          }}
          className="relative min-w-0 flex-1 sm:max-w-sm"
        >
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onBlur={commitSearch}
            placeholder="Search name, email or student ID…"
            aria-label="Search users"
            className="pl-9"
          />
        </form>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Role
              {selectedRoles.length > 0 && (
                <Badge variant="secondary" className="ml-1 tabular-nums">
                  {selectedRoles.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <fieldset className="space-y-0.5">
              <legend className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Filter by role
              </legend>
              {ROLE_FILTER_ORDER.map((role) => (
                <Label
                  key={role}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleInList("role", role, selectedRoles)}
                  />
                  {ROLE_LABELS[role]}
                </Label>
              ))}
            </fieldset>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Status
              {selectedStatuses.length > 0 && (
                <Badge variant="secondary" className="ml-1 tabular-nums">
                  {selectedStatuses.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <fieldset className="space-y-0.5">
              <legend className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Filter by status
              </legend>
              {USER_STATUS_FILTERS.map((status) => (
                <Label
                  key={status}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={() => toggleInList("status", status, selectedStatuses)}
                  />
                  {STATUS_LABELS[status]}
                </Label>
              ))}
            </fieldset>
            <p className="px-2 pt-2 text-xs text-muted-foreground">
              Deleted accounts are hidden unless you ask for them.
            </p>
          </PopoverContent>
        </Popover>

        {hasAnyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              startTransition(() => {
                router.replace(pathname, { scroll: false });
              })
            }
          >
            <X className="size-4" aria-hidden />
            Clear all
          </Button>
        )}
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {/* The verb agrees with the count too — "1 account match" reads as a
            typo on the one screen where a single result is the common case. */}
        {totalResults} account{totalResults === 1 ? "" : "s"}
        {hasAnyFilter ? (totalResults === 1 ? " matches your filters" : " match your filters") : ""}
      </p>
    </div>
  );
}
