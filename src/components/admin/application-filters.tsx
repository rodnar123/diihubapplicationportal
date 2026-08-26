"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Loader2, Search, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { APPLICATION_STATUS_META, STATUS_FILTER_ORDER } from "@/domain/application/status";
import { YEAR_LEVEL_OPTIONS } from "@/domain/challenge/constants";
import type { ApplicationStatus, YearLevel } from "@/generated/prisma/enums";
import type { SchoolOption } from "@/services/reference/reference-data";

/**
 * Filters for the review console.
 *
 * State lives in the URL, not in the component: a reviewer can bookmark a
 * working set, share it, and use the back button. Every change is a navigation
 * wrapped in a transition, so the table dims rather than blanking while the
 * server re-queries.
 */

const ALL_SCHOOLS = "__all__";

export function ApplicationFilters({
  schools,
  totalResults,
  canViewDeleted = false,
}: {
  schools: SchoolOption[];
  totalResults: number;
  /** Administrators can swap the list for the recycle bin. */
  canViewDeleted?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("q") ?? "";
  const [searchText, setSearchText] = useState(currentQuery);
  const [syncedQuery, setSyncedQuery] = useState(currentQuery);

  // Keep the box in step when the URL changes from elsewhere (back button,
  // "clear all"), without fighting the user while they type. Adjusting state
  // during render is React's documented alternative to a syncing effect: it
  // re-renders immediately rather than painting the stale value first.
  if (syncedQuery !== currentQuery) {
    setSyncedQuery(currentQuery);
    setSearchText(currentQuery);
  }

  const selectedStatuses = useMemo(
    () => (searchParams.get("status")?.split(",").filter(Boolean) ?? []) as ApplicationStatus[],
    [searchParams],
  );

  const selectedYears = useMemo(
    () => (searchParams.get("year")?.split(",").filter(Boolean) ?? []) as YearLevel[],
    [searchParams],
  );

  const selectedSchool = searchParams.get("school") ?? "";
  const selectedSection = searchParams.get("section") ?? "";
  const fromDate = searchParams.get("from") ?? "";
  const toDate = searchParams.get("to") ?? "";

  const deletedParam = searchParams.get("deleted");
  const showingDeleted = canViewDeleted && (deletedParam === "1" || deletedParam === "true");

  const activeCount =
    selectedStatuses.length +
    selectedYears.length +
    (selectedSchool ? 1 : 0) +
    (selectedSection ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0);

  const hasAnyFilter = activeCount > 0 || currentQuery.length > 0;

  const apply = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    // Any filter change invalidates the current page position.
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

  /**
   * Applied on blur as well as on Enter.
   *
   * Without the blur, typing a term and then reaching for any other control
   * left the box showing text that was never applied — and the summary line
   * below still read "N applications match your filters", so the screen
   * claimed a filter that was not in the query. Blur is exactly the moment
   * that divergence would otherwise become visible.
   *
   * Guarded against re-navigating when nothing changed, since blur fires on
   * every pass through the field.
   */
  const commitSearch = () => {
    const next = searchText.trim();
    if (next === currentQuery) return;
    setParam("q", next || null);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    commitSearch();
  };

  const sections = schools.find((school) => school.id === selectedSchool)?.sections ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onBlur={commitSearch}
            placeholder="Search ID, name, email, project, team…"
            aria-label="Search applications"
            className="pl-9"
          />
        </form>

        {/* Status */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="size-4" aria-hidden />
              Status
              {selectedStatuses.length > 0 && (
                <Badge variant="secondary" className="ml-1 tabular-nums">
                  {selectedStatuses.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-2">
            <fieldset className="space-y-0.5">
              <legend className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Filter by status
              </legend>
              {STATUS_FILTER_ORDER.map((status) => (
                <Label
                  key={status}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={() => toggleInList("status", status, selectedStatuses)}
                  />
                  {APPLICATION_STATUS_META[status].label}
                </Label>
              ))}
            </fieldset>
          </PopoverContent>
        </Popover>

        {/* Year level */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Year
              {selectedYears.length > 0 && (
                <Badge variant="secondary" className="ml-1 tabular-nums">
                  {selectedYears.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-2">
            <fieldset className="space-y-0.5">
              <legend className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Filter by year level
              </legend>
              {YEAR_LEVEL_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedYears.includes(option.value)}
                    onCheckedChange={() => toggleInList("year", option.value, selectedYears)}
                  />
                  {option.label}
                </Label>
              ))}
            </fieldset>
          </PopoverContent>
        </Popover>

        {/* School / section */}
        <Select
          value={selectedSchool || ALL_SCHOOLS}
          onValueChange={(value) =>
            apply((params) => {
              if (value === ALL_SCHOOLS) params.delete("school");
              else params.set("school", value);
              // A section belongs to a school; changing the school invalidates it.
              params.delete("section");
            })
          }
        >
          <SelectTrigger size="sm" className="w-auto min-w-40" aria-label="Filter by school">
            <SelectValue placeholder="All schools" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SCHOOLS}>All schools</SelectItem>
            {schools.map((school) => (
              <SelectItem key={school.id} value={school.id}>
                {school.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {sections.length > 0 && (
          <Select
            value={selectedSection || ALL_SCHOOLS}
            onValueChange={(value) =>
              setParam("section", value === ALL_SCHOOLS ? null : value)
            }
          >
            <SelectTrigger size="sm" className="w-auto min-w-36" aria-label="Filter by section">
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Sections</SelectLabel>
                <SelectItem value={ALL_SCHOOLS}>All sections</SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}

        {/* Submission date range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Submitted
              {(fromDate || toDate) && (
                <Badge variant="secondary" className="ml-1">
                  1
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="filter-from" className="text-xs">
                From
              </Label>
              <Input
                id="filter-from"
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => setParam("from", event.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-to" className="text-xs">
                To
              </Label>
              <Input
                id="filter-to"
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => setParam("to", event.target.value || null)}
              />
            </div>
            {(fromDate || toDate) && (
              <>
                <Separator />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    apply((params) => {
                      params.delete("from");
                      params.delete("to");
                    })
                  }
                >
                  Clear dates
                </Button>
              </>
            )}
          </PopoverContent>
        </Popover>

        {hasAnyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              startTransition(() => {
                // `deleted` survives a clear: it selects *which list* is being
                // filtered, not one of the filters on it. Dropping it would
                // silently walk the administrator out of the recycle bin.
                const target = showingDeleted ? `${pathname}?deleted=1` : pathname;
                router.replace(target, { scroll: false });
              })
            }
          >
            <X className="size-4" aria-hidden />
            Clear all
          </Button>
        )}

        {canViewDeleted && (
          <Button
            variant={showingDeleted ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={showingDeleted}
            className={showingDeleted ? "ml-auto" : "ml-auto text-muted-foreground"}
            onClick={() => setParam("deleted", showingDeleted ? null : "1")}
          >
            <Trash2 className="size-4" aria-hidden />
            {showingDeleted ? "Viewing deleted" : "Deleted"}
          </Button>
        )}
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {totalResults} {showingDeleted ? "deleted " : ""}application
        {totalResults === 1 ? "" : "s"}
        {hasAnyFilter
          ? totalResults === 1
            ? " matches your filters"
            : " match your filters"
          : " in total"}
      </p>
    </div>
  );
}
