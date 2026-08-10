"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";

import { AttachmentList } from "@/components/application/attachment-list";
import { FileUploader } from "@/components/application/file-uploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AttachmentKind } from "@/generated/prisma/enums";
import type { ApplicationDto } from "@/domain/application/types";
import { ROUTES } from "@/lib/routes";

/**
 * Attachments are optional, so this step has no form and no validation — just
 * upload, list and remove.
 */
export function AttachmentsStep({
  application,
  accept,
  maxFileSizeMb,
  maxFiles,
  allowedTypesLabel,
  readOnly,
  previousHref,
  nextHref,
}: {
  application: ApplicationDto;
  accept: string;
  maxFileSizeMb: number;
  maxFiles: number;
  allowedTypesLabel: string;
  readOnly: boolean;
  previousHref: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();

  // The signed declaration is managed on its own step; don't duplicate it here.
  const supporting = application.attachments.filter(
    (attachment) => attachment.kind !== AttachmentKind.SIGNED_DECLARATION,
  );

  const atLimit = application.attachments.length >= maxFiles;

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="size-4" aria-hidden />
        <AlertTitle>Optional, but they help</AlertTitle>
        <AlertDescription>
          Screenshots of your prototype, a short design document, or a packaged demo give reviewers
          something concrete to look at. You can add up to {maxFiles} files in total.
        </AlertDescription>
      </Alert>

      {!readOnly && (
        <FileUploader
          applicationId={application.id}
          kind={AttachmentKind.SUPPORTING_DOCUMENT}
          accept={accept}
          maxFileSizeMb={maxFileSizeMb}
          allowedTypesLabel={allowedTypesLabel}
          disabled={atLimit}
          onUploaded={() => router.refresh()}
          label="Upload supporting documents"
        />
      )}

      {atLimit && !readOnly && (
        <p className="text-sm text-muted-foreground">
          You have reached the {maxFiles}-file limit. Remove a file before adding another.
        </p>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">
          Uploaded files{" "}
          <span className="font-normal tabular-nums text-muted-foreground">
            ({supporting.length})
          </span>
        </h2>

        <AttachmentList
          attachments={supporting}
          canDelete={!readOnly}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        {previousHref ? (
          <Button asChild variant="outline">
            <Link href={previousHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </Link>
          </Button>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost">
            <Link href={ROUTES.dashboard}>Finish later</Link>
          </Button>
          {nextHref && (
            <Button asChild>
              <Link href={nextHref}>
                Continue
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
