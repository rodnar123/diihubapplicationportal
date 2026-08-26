"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/client-action";
import { ROUTES } from "@/lib/routes";
import {
  deleteApplicationAction,
  restoreApplicationAction,
} from "@/app/(admin)/admin/actions";

/**
 * Delete and restore controls for an application.
 *
 * Both confirmations keep the dialog open until the server has answered:
 * Radix closes on `AlertDialogAction` by default, which would dismiss the
 * dialog the instant the button was pressed and leave a failure to be
 * discovered from a toast over a row that never changed. `preventDefault` plus
 * an explicitly controlled `open` means the dialog closes because the deletion
 * succeeded, not because a button was clicked.
 */

/** Names the entry in the confirmation, so nobody deletes an anonymous row. */
function describe(reference: string | null, title: string | null): string {
  if (reference && title) return `${reference} — ${title}`;
  return reference ?? title ?? "this untitled draft";
}

export function DeleteApplicationButton({
  applicationId,
  referenceNumber,
  projectTitle,
  ownerName,
  /** Where to go once it is gone. Omit to stay put and refresh in place. */
  redirectTo,
  presentation = "button",
}: {
  applicationId: string;
  referenceNumber: string | null;
  projectTitle: string | null;
  ownerName?: string;
  redirectTo?: string;
  presentation?: "button" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const label = describe(referenceNumber, projectTitle);

  const confirm = () => {
    startTransition(async () => {
      const result = await callAction(() =>
        deleteApplicationAction({ applicationId, reason: reason.trim() || null }),
      );

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setOpen(false);
      setReason("");
      toast.success(`Deleted ${label}.`);

      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // A request in flight must not be abandoned by an outside click or Esc.
        if (isPending) return;
        setOpen(next);
        if (!next) setReason("");
      }}
    >
      <AlertDialogTrigger asChild>
        {presentation === "icon" ? (
          <Button variant="ghost" size="icon" className="text-destructive">
            <Trash2 className="size-4" aria-hidden />
            <span className="sr-only">Delete {label}</span>
          </Button>
        ) : (
          <Button variant="destructive">
            <Trash2 className="size-4" aria-hidden />
            Delete application
          </Button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            {ownerName ? `${ownerName}'s entry ` : "This entry "}
            disappears from the review console and from the applicant&rsquo;s dashboard, and
            the team is free to start a new entry for this challenge year. Nothing is erased
            — an administrator can restore it from the deleted list, and the audit trail
            keeps a record either way.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor={`delete-reason-${applicationId}`}>Reason (optional)</Label>
          <Textarea
            id={`delete-reason-${applicationId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. duplicate entry, submitted for testing"
          />
          <p className="text-xs text-muted-foreground">
            Recorded in the audit log. The applicant is not told.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RestoreApplicationButton({
  applicationId,
  referenceNumber,
  projectTitle,
  presentation = "button",
}: {
  applicationId: string;
  referenceNumber: string | null;
  projectTitle: string | null;
  presentation?: "button" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const label = describe(referenceNumber, projectTitle);

  const confirm = () => {
    startTransition(async () => {
      const result = await callAction(() => restoreApplicationAction({ applicationId }));

      if (!result.ok) {
        // The common failure is a live replacement entry for the same year, and
        // that message names it — worth reading, so give it time on screen.
        toast.error(result.message, { duration: 8000 });
        return;
      }

      setOpen(false);
      toast.success(`Restored ${label}.`, {
        action: {
          label: "Open",
          onClick: () => router.push(ROUTES.adminApplication(applicationId)),
        },
      });
      router.refresh();
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        {presentation === "icon" ? (
          <Button variant="ghost" size="icon">
            <RotateCcw className="size-4" aria-hidden />
            <span className="sr-only">Restore {label}</span>
          </Button>
        ) : (
          <Button variant="outline">
            <RotateCcw className="size-4" aria-hidden />
            Restore
          </Button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            The entry returns to the review console at the status it held when it was
            deleted, and becomes visible to the applicant again. If the team has since
            started a replacement for the same challenge year, the restore is refused
            rather than leaving them with two.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Restoring…
              </>
            ) : (
              "Restore"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
