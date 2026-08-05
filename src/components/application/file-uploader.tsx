"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { AttachmentKind } from "@/generated/prisma/enums";
import { uploadAttachmentAction } from "@/app/(student)/application/actions";
import { cn } from "@/lib/utils";

/**
 * Drag-and-drop uploader with a keyboard-reachable fallback.
 *
 * Client-side size and type checks exist purely to fail fast — the server
 * re-checks both, and also verifies the file's magic bytes, because none of
 * this can be trusted from the browser.
 */
export function FileUploader({
  applicationId,
  kind,
  accept,
  maxFileSizeMb,
  allowedTypesLabel,
  disabled = false,
  onUploaded,
  label = "Upload a file",
}: {
  applicationId: string;
  kind?: AttachmentKind;
  accept: string;
  maxFileSizeMb: number;
  allowedTypesLabel: string;
  disabled?: boolean;
  onUploaded?: (attachmentId: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, startUpload] = useTransition();
  const [queueLength, setQueueLength] = useState(0);
  const [completed, setCompleted] = useState(0);

  const upload = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const maxBytes = maxFileSizeMb * 1024 * 1024;
    const tooBig = list.filter((file) => file.size > maxBytes);
    if (tooBig.length > 0) {
      toast.error(
        `${tooBig.map((file) => `"${file.name}"`).join(", ")} exceeds the ${maxFileSizeMb} MB limit.`,
      );
      return;
    }

    setQueueLength(list.length);
    setCompleted(0);

    startUpload(async () => {
      let succeeded = 0;

      // Sequential rather than parallel: the per-application file cap is
      // checked server-side per upload, and concurrent requests would race it.
      for (const file of list) {
        const formData = new FormData();
        formData.set("applicationId", applicationId);
        formData.set("file", file);
        if (kind) formData.set("kind", kind);

        const result = await uploadAttachmentAction(formData);

        if (result.ok) {
          succeeded += 1;
          setCompleted(succeeded);
          onUploaded?.(result.data.id);
        } else {
          toast.error(result.message);
          break;
        }
      }

      if (succeeded > 0) {
        toast.success(succeeded === 1 ? "File uploaded." : `${succeeded} files uploaded.`);
      }

      setQueueLength(0);
      setCompleted(0);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setIsDragging(false);
          upload(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
          isDragging && "border-primary bg-primary/5",
          disabled && "opacity-60",
        )}
      >
        <Upload className="mx-auto size-6 text-muted-foreground" aria-hidden />

        <p className="mt-3 text-sm font-medium">
          Drag files here, or{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            browse your device
          </Button>
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {allowedTypesLabel} · up to {maxFileSizeMb} MB each
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          aria-label={label}
          disabled={disabled || isUploading}
          onChange={(event) => {
            if (event.target.files) upload(event.target.files);
          }}
        />
      </div>

      {isUploading && (
        <div className="space-y-1.5" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Uploading {completed + 1} of {queueLength}…
          </p>
          <Progress value={queueLength === 0 ? 0 : (completed / queueLength) * 100} />
        </div>
      )}
    </div>
  );
}
