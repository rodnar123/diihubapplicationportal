"use client";

import { useState, useTransition } from "react";
import {
  Download,
  FileArchive,
  FileImage,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/layout/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { AttachmentDto } from "@/domain/application/types";
import { callAction } from "@/lib/client-action";
import { formatBytes } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { deleteAttachmentAction } from "@/app/(student)/application/actions";

export function fileIconFor(mimeType: string): LucideIcon {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("zip")) return FileArchive;
  return FileText;
}

/**
 * The uploaded-files list. `canDelete` is false once the application is
 * locked, which also removes the confirmation dialog entirely.
 *
 * The download URL is built here rather than taken as a prop: a function prop
 * cannot cross the Server→Client boundary, and every caller wanted the same
 * route anyway.
 */
export function AttachmentList({
  attachments,
  canDelete,
  emptyDescription = "Add supporting documents, prototype screenshots or a demonstration package.",
}: {
  attachments: AttachmentDto[];
  canDelete: boolean;
  emptyDescription?: string;
}) {
  const [pendingDelete, setPendingDelete] = useState<AttachmentDto | null>(null);
  const [isDeleting, startDelete] = useTransition();

  if (attachments.length === 0) {
    return <EmptyState icon={Paperclip} title="No files uploaded" description={emptyDescription} />;
  }

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;

    startDelete(async () => {
      const result = await callAction(() => deleteAttachmentAction(target.id));
      if (result.ok) {
        toast.success(`"${target.fileName}" was removed.`);
        setPendingDelete(null);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <>
      <ul className="divide-y rounded-md border">
        {attachments.map((attachment) => {
          const Icon = fileIconFor(attachment.mimeType);

          return (
            <li key={attachment.id} className="flex items-center gap-3 px-3 py-2.5">
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(attachment.sizeBytes)} ·{" "}
                  {new Date(attachment.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <Button asChild variant="ghost" size="icon" className="shrink-0">
                <a href={ROUTES.attachmentDownload(attachment.id)} download>
                  <Download className="size-4" aria-hidden />
                  <span className="sr-only">Download {attachment.fileName}</span>
                </a>
              </Button>

              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setPendingDelete(attachment)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  <span className="sr-only">Remove {attachment.fileName}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this file?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.fileName}&rdquo; will be deleted from your application. This
              cannot be undone — you would need to upload it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep file</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Removing…
                </>
              ) : (
                "Remove file"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
