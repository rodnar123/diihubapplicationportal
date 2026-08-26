"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { flexRender, tableFeatures, useTable, type ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  MessageSquare,
  Paperclip,
  Trash2,
} from "lucide-react";

import {
  DeleteApplicationButton,
  RestoreApplicationButton,
} from "@/components/admin/application-delete-controls";
import { StatusBadge } from "@/components/application/status-badge";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAGE_SIZES, SORTABLE_COLUMNS, type SortableColumn } from "@/domain/admin/application-query";
import { YEAR_LEVEL_LABELS } from "@/domain/challenge/constants";
import type { AdminApplicationRow } from "@/services/admin/application-query";
import { formatDate as formatChallengeDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * The review console's table.
 *
 * Sorting and paging are *server-side* — TanStack Table runs in manual mode
 * and owns only column definitions and rendering. The alternative (fetching
 * every row and sorting in the browser) would break as soon as the challenge
 * has more entries than fit comfortably in a response, and would make the CSV
 * export disagree with the screen.
 */

/**
 * No optional features are registered: sorting, filtering and pagination all
 * happen in Postgres, so the table only needs its core row model. Registering
 * the client-side sorting feature would offer a second, disagreeing sort.
 */
const tableConfig = tableFeatures({});

type AppColumnDef = ColumnDef<typeof tableConfig, AdminApplicationRow>;

function isSortable(id: string): id is SortableColumn {
  return (SORTABLE_COLUMNS as readonly string[]).includes(id);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return formatChallengeDate(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ApplicationsTable({
  rows,
  page,
  pageCount,
  pageSize,
  total,
  sort,
  direction,
  canDelete = false,
  showingDeleted = false,
}: {
  rows: AdminApplicationRow[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  sort: SortableColumn;
  direction: "asc" | "desc";
  /**
   * Whether the viewer is a full administrator. Only a presentation decision —
   * the Server Action enforces the same rule, since a reviewer could otherwise
   * POST to it directly.
   */
  canDelete?: boolean;
  /** True when the table is listing the recycle bin rather than live entries. */
  showingDeleted?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    startTransition(() => {
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    });
  };

  const toggleSort = (column: SortableColumn) => {
    navigate((params) => {
      if (sort === column) {
        params.set("dir", direction === "asc" ? "desc" : "asc");
      } else {
        params.set("sort", column);
        // Dates read newest-first; text reads A→Z.
        params.set(
          "dir",
          column === "projectTitle" || column === "teamName" ? "asc" : "desc",
        );
      }
      params.delete("page");
    });
  };

  const columns = useMemo<AppColumnDef[]>(
    () => [
      {
        id: "referenceNumber",
        header: "Reference",
        /*
          Deleted entries are shown as plain text, not links: the detail page
          reads through `getApplicationDetail`, which filters them out, so every
          such link would land on a 404 and read as data loss rather than as the
          deletion the administrator performed a moment ago.
        */
        cell: ({ row }) =>
          row.original.deletedAt ? (
            <span className="font-mono text-xs font-medium text-muted-foreground">
              {row.original.referenceNumber ?? "Draft"}
            </span>
          ) : (
            <Link
              href={ROUTES.adminApplication(row.original.id)}
              className="font-mono text-xs font-medium underline-offset-4 hover:underline"
            >
              {row.original.referenceNumber ?? "Draft"}
            </Link>
          ),
      },
      {
        id: "projectTitle",
        header: "Project",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-xs">
            {row.original.deletedAt ? (
              <p className="truncate font-medium">
                {row.original.projectTitle ?? "Untitled venture"}
              </p>
            ) : (
              <Link
                href={ROUTES.adminApplication(row.original.id)}
                className="block truncate font-medium underline-offset-4 hover:underline"
              >
                {row.original.projectTitle ?? "Untitled venture"}
              </Link>
            )}
            {row.original.deletedAt ? (
              <p className="truncate text-xs text-muted-foreground">
                Deleted {formatDate(row.original.deletedAt)}
              </p>
            ) : (
              row.original.theme && (
                <p className="truncate text-xs text-muted-foreground">{row.original.theme}</p>
              )
            )}
          </div>
        ),
      },
      {
        id: "teamName",
        header: "Team",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-40">
            <p className="truncate">{row.original.teamName ?? "—"}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {row.original.memberCount} member{row.original.memberCount === 1 ? "" : "s"}
            </p>
          </div>
        ),
      },
      {
        id: "applicant",
        header: "Applicant",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-48">
            <p className="truncate">{row.original.applicantName}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.original.applicantStudentId ?? row.original.applicantEmail}
            </p>
          </div>
        ),
      },
      {
        id: "section",
        header: "School / Section",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-44">
            <p className="truncate text-sm">{row.original.sectionName ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.schoolName ?? "—"}
              {row.original.yearLevel && ` · ${YEAR_LEVEL_LABELS[row.original.yearLevel]}`}
            </p>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "submittedAt",
        header: "Submitted",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums whitespace-nowrap">
            {formatDate(row.original.submittedAt)}
          </span>
        ),
      },
      {
        id: "meta",
        header: () => <span className="sr-only">Attachments and comments</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
            {row.original.attachmentCount > 0 && (
              <span className="flex items-center gap-1" title="Attachments">
                <Paperclip className="size-3.5" aria-hidden />
                {row.original.attachmentCount}
                <span className="sr-only">attachments</span>
              </span>
            )}
            {row.original.commentCount > 0 && (
              <span className="flex items-center gap-1" title="Comments">
                <MessageSquare className="size-3.5" aria-hidden />
                {row.original.commentCount}
                <span className="sr-only">comments</span>
              </span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-0.5">
            {/* A deleted entry has no detail page — the reader excludes it — so
                the only thing to offer on one is putting it back. */}
            {!row.original.deletedAt && (
              <Button asChild variant="ghost" size="icon">
                <Link href={ROUTES.adminApplication(row.original.id)}>
                  <ExternalLink className="size-4" aria-hidden />
                  <span className="sr-only">
                    Open{" "}
                    {row.original.referenceNumber ??
                      row.original.projectTitle ??
                      "application"}
                  </span>
                </Link>
              </Button>
            )}

            {canDelete &&
              (row.original.deletedAt ? (
                <RestoreApplicationButton
                  applicationId={row.original.id}
                  referenceNumber={row.original.referenceNumber}
                  projectTitle={row.original.projectTitle}
                  presentation="icon"
                />
              ) : (
                <DeleteApplicationButton
                  applicationId={row.original.id}
                  referenceNumber={row.original.referenceNumber}
                  projectTitle={row.original.projectTitle}
                  ownerName={row.original.applicantName}
                  presentation="icon"
                />
              ))}
          </div>
        ),
      },
    ],
    [canDelete],
  );

  const table = useTable({
    features: tableConfig,
    data: rows,
    columns,
    getRowId: (row) => row.id,
  });

  if (rows.length === 0) {
    return showingDeleted ? (
      <EmptyState
        icon={Trash2}
        title="Nothing has been deleted"
        description="Deleted applications collect here, where an administrator can put them back."
      />
    ) : (
      <EmptyState
        icon={ClipboardList}
        title="No applications match"
        description="Try widening your filters, or clear them to see every entry."
      />
    );
  }

  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <div className={cn("space-y-4", isPending && "opacity-60 transition-opacity")}>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id;
                  const sortable = isSortable(columnId);
                  const isActive = sortable && sort === columnId;

                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        isActive ? (direction === "asc" ? "ascending" : "descending") : undefined
                      }
                      className="whitespace-nowrap"
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(columnId)}
                          className="-mx-2 flex items-center gap-1.5 rounded px-2 py-1 font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {isActive ? (
                            direction === "asc" ? (
                              <ArrowUp className="size-3.5" aria-hidden />
                            ) : (
                              <ArrowDown className="size-3.5" aria-hidden />
                            )
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {/* `getAllCells` rather than `getVisibleCells`: column
                    visibility is not a registered feature, so every column is
                    always shown. */}
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          Showing {firstRow}–{lastRow} of {total}
        </p>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-sm text-muted-foreground">
              Per page
            </label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) =>
                navigate((params) => {
                  params.set("size", value);
                  params.delete("page");
                })
              }
            >
              <SelectTrigger id="page-size" size="sm" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <nav aria-label="Pagination" className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => navigate((params) => params.set("page", String(page - 1)))}
            >
              <ChevronLeft className="size-4" aria-hidden />
              <span className="sr-only">Previous page</span>
            </Button>

            <span className="px-2 text-sm tabular-nums">
              Page {page} of {pageCount}
            </span>

            <Button
              variant="outline"
              size="icon"
              disabled={page >= pageCount}
              onClick={() => navigate((params) => params.set("page", String(page + 1)))}
            >
              <ChevronRight className="size-4" aria-hidden />
              <span className="sr-only">Next page</span>
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
}
