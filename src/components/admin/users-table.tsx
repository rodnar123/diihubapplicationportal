"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw, ShieldOff, Trash2, UserCheck, Users } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/layout/empty-state";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/domain/admin/user-query";
import { Role } from "@/generated/prisma/enums";
import { callAction } from "@/lib/client-action";
import type { ActionResult } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { AdminUserRow } from "@/services/admin/user-admin";
import { cn } from "@/lib/utils";
import {
  deleteUserAction,
  restoreUserAction,
  setUserActiveAction,
  updateUserRoleAction,
} from "@/app/(admin)/admin/actions";

/**
 * The user directory.
 *
 * Every control here is disabled in exactly the cases the service refuses —
 * your own account, and the last remaining administrator. The disabling is a
 * courtesy so the reason is visible before the click; the service is what
 * actually enforces it, because a Server Action can be reached by POST without
 * passing through this table at all.
 */

const ROLE_ORDER = [Role.STUDENT, Role.REVIEWER, Role.ADMIN] as const;

function StatusBadge({ row }: { row: AdminUserRow }) {
  if (row.deletedAt) {
    return (
      <Badge variant="outline" className="border-destructive/40 text-destructive">
        Deleted
      </Badge>
    );
  }
  if (!row.isActive) return <Badge variant="secondary">Deactivated</Badge>;
  return <Badge variant="outline">Active</Badge>;
}

function formatWhen(value: string | null): string {
  if (!value) return "Never";
  return formatDate(value, { day: "numeric", month: "short", year: "numeric" });
}

export function UsersTable({
  rows,
  currentUserId,
  activeAdminCount,
  page,
  pageCount,
  total,
  pageSize,
}: {
  rows: AdminUserRow[];
  /** The signed-in administrator, so their own row can be locked and labelled. */
  currentUserId: string;
  activeAdminCount: number;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pageHref = (target: number) => {
    // Preserve the filters; only the page moves.
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(target));
    return `${pathname}?${params.toString()}`;
  };

  const run = <T,>(
    userId: string,
    invoke: () => Promise<ActionResult<T>>,
    success: string,
  ) => {
    setPendingId(userId);
    startTransition(async () => {
      const result = await callAction(invoke);
      setPendingId(null);

      if (!result.ok) {
        // The refusals here explain a rule ("this is the only administrator…"),
        // so they need longer than a default toast to be read.
        toast.error(result.message, { duration: 8000 });
        return;
      }

      toast.success(success);
      router.refresh();
    });
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No accounts match"
        description="Try widening your filters, or clear them to see everybody."
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
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>School / Section</TableHead>
              <TableHead className="whitespace-nowrap">Entries</TableHead>
              <TableHead className="whitespace-nowrap">Last sign-in</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => {
              const isSelf = row.id === currentUserId;
              const isLastAdmin =
                row.role === Role.ADMIN && row.isActive && !row.deletedAt && activeAdminCount <= 1;
              // Both conditions end with somebody locked out: yourself, or
              // everybody. Either way the row is read-only.
              const locked = isSelf || isLastAdmin;
              const busy = pendingId === row.id;

              return (
                <TableRow key={row.id} className={row.deletedAt ? "opacity-70" : undefined}>
                  <TableCell className="align-top">
                    <div className="min-w-0 max-w-64">
                      <p className="truncate font-medium">
                        {row.name}
                        {isSelf && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      {row.studentId && (
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {row.studentId}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <Select
                      value={row.role}
                      disabled={locked || busy || Boolean(row.deletedAt)}
                      onValueChange={(value) =>
                        run(
                          row.id,
                          () => updateUserRoleAction({ userId: row.id, role: value }),
                          `${row.name} is now a ${ROLE_LABELS[value as Role].toLowerCase()}.`,
                        )
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-40"
                        aria-label={`Role for ${row.name}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_ORDER.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 max-w-48 text-xs text-muted-foreground">
                      {isSelf
                        ? "You cannot change your own role."
                        : isLastAdmin
                          ? "The only administrator — promote somebody else first."
                          : ROLE_DESCRIPTIONS[row.role]}
                    </p>
                  </TableCell>

                  <TableCell className="align-top">
                    <StatusBadge row={row} />
                  </TableCell>

                  <TableCell className="align-top">
                    <div className="min-w-0 max-w-44">
                      <p className="truncate text-sm">{row.sectionName ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.schoolName ?? "—"}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell className="align-top text-sm tabular-nums">
                    {row.applicationCount > 0 ? (
                      <Link
                        href={`${ROUTES.adminApplications}?q=${encodeURIComponent(row.email)}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {row.applicationCount}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>

                  <TableCell className="align-top text-sm whitespace-nowrap text-muted-foreground">
                    {formatWhen(row.lastLoginAt)}
                  </TableCell>

                  <TableCell className="align-top">
                    <div className="flex items-center justify-end gap-0.5">
                      {busy && (
                        <Loader2
                          className="size-4 animate-spin text-muted-foreground"
                          aria-hidden
                        />
                      )}

                      {row.deletedAt ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          onClick={() =>
                            run(
                              row.id,
                              () => restoreUserAction({ userId: row.id }),
                              `${row.name} restored, deactivated. Reactivate them to let them sign in.`,
                            )
                          }
                        >
                          <RotateCcw className="size-4" aria-hidden />
                          <span className="sr-only">Restore {row.name}</span>
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={locked || busy}
                            title={
                              row.isActive
                                ? "Deactivate — blocks sign-in, keeps everything"
                                : "Reactivate"
                            }
                            onClick={() =>
                              run(
                                row.id,
                                () =>
                                  setUserActiveAction({
                                    userId: row.id,
                                    isActive: !row.isActive,
                                  }),
                                row.isActive
                                  ? `${row.name} can no longer sign in.`
                                  : `${row.name} can sign in again.`,
                              )
                            }
                          >
                            {row.isActive ? (
                              <ShieldOff className="size-4" aria-hidden />
                            ) : (
                              <UserCheck className="size-4" aria-hidden />
                            )}
                            <span className="sr-only">
                              {row.isActive ? "Deactivate" : "Reactivate"} {row.name}
                            </span>
                          </Button>

                          <DeleteUserButton
                            row={row}
                            disabled={locked || busy}
                            onConfirm={(reason) =>
                              run(
                                row.id,
                                () => deleteUserAction({ userId: row.id, reason }),
                                `Deleted ${row.email}.`,
                              )
                            }
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          Showing {firstRow}–{lastRow} of {total}
        </p>

        <nav aria-label="Pagination" className="flex items-center gap-2">
          <PagerStep href={pageHref(page - 1)} disabled={page <= 1}>
            Previous
          </PagerStep>
          <span className="px-1 text-sm tabular-nums">
            Page {page} of {pageCount}
          </span>
          <PagerStep href={pageHref(page + 1)} disabled={page >= pageCount}>
            Next
          </PagerStep>
        </nav>
      </div>
    </div>
  );
}

/**
 * One step of the pager.
 *
 * A disabled step is a real `<button>`, never `<Button asChild disabled>`
 * around a `<Link>`: `disabled` on an anchor means nothing, so both ends of the
 * pager would look and behave enabled on the first and last page.
 */
function PagerStep({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href} scroll={false}>
        {children}
      </Link>
    </Button>
  );
}

function DeleteUserButton({
  row,
  disabled,
  onConfirm,
}: {
  row: AdminUserRow;
  disabled: boolean;
  onConfirm: (reason: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setReason("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive" disabled={disabled}>
          <Trash2 className="size-4" aria-hidden />
          <span className="sr-only">Delete {row.name}</span>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {row.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {row.email} loses access immediately, including any session they are already
            signed in to, and signing in again will not recreate the account.
            {row.applicationCount > 0 && (
              <>
                {" "}
                Their {row.applicationCount} application
                {row.applicationCount === 1 ? " stays" : "s stay"} in the console — deleting
                a person is not a decision about their team&rsquo;s entry.
              </>
            )}{" "}
            The record is kept so the audit trail can still name them, and an administrator
            can restore the account.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor={`delete-user-reason-${row.id}`}>Reason (optional)</Label>
          <Textarea
            id={`delete-user-reason-${row.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. left the university, duplicate account"
          />
          <p className="text-xs text-muted-foreground">Recorded in the audit log.</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep the account</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              // The row shows a spinner and the toast reports the outcome, so
              // unlike the application dialog this one can close immediately.
              onConfirm(reason.trim() || null);
              setOpen(false);
              setReason("");
            }}
          >
            Delete account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
