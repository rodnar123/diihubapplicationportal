"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, ArrowRight, Download, FileSignature, Loader2 } from "lucide-react";

import { AttachmentList } from "@/components/application/attachment-list";
import { FileUploader } from "@/components/application/file-uploader";
import { useExitHref } from "@/components/application/use-exit-href";
import { FormRow } from "@/components/forms/form-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AttachmentKind, DeclarationMode } from "@/generated/prisma/enums";
import { declarationSchema, type DeclarationInput } from "@/domain/application/schemas";
import { CHALLENGE_HOST, CHALLENGE_NAME } from "@/domain/challenge/constants";
import type { DeclarationModeSetting } from "@/domain/settings/app-settings";
import type { ApplicantDto, ApplicationDto } from "@/domain/application/types";
import { applyFieldErrors } from "@/lib/form-errors";
import { callAction } from "@/lib/client-action";
import { saveDeclarationStep } from "@/app/(student)/application/actions";

/**
 * The declaration.
 *
 * Deliberately not autosaved: signing is an act, not a draft. The student
 * either affirms it or they do not, and the timestamp, IP and user agent
 * recorded alongside it are what make the electronic version defensible.
 */

const DECLARATION_TEXT = `We hereby declare that this proposal and prototype are original works of our team and submitted for the ${CHALLENGE_HOST}, ${CHALLENGE_NAME}.`;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function DeclarationStep({
  application,
  applicant,
  allowedMode,
  accept,
  maxFileSizeMb,
  allowedTypesLabel,
  readOnly,
  previousHref,
  nextHref,
}: {
  application: ApplicationDto;
  applicant: ApplicantDto;
  allowedMode: DeclarationModeSetting;
  accept: string;
  maxFileSizeMb: number;
  allowedTypesLabel: string;
  readOnly: boolean;
  previousHref: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();
  const exit = useExitHref();
  const [isPending, startTransition] = useTransition();

  const existing = application.declaration;
  const signedDeclarations = application.attachments.filter(
    (attachment) => attachment.kind === AttachmentKind.SIGNED_DECLARATION,
  );

  const initialMode: DeclarationInput["mode"] =
    allowedMode === "ELECTRONIC"
      ? "ELECTRONIC"
      : allowedMode === "SIGNED_UPLOAD"
        ? "SIGNED_UPLOAD"
        : existing?.mode === DeclarationMode.SIGNED_UPLOAD
          ? "SIGNED_UPLOAD"
          : "ELECTRONIC";

  const [mode, setMode] = useState<DeclarationInput["mode"]>(initialMode);

  const form = useForm<DeclarationInput>({
    resolver: zodResolver(declarationSchema),
    mode: "onSubmit",
    defaultValues: {
      mode: initialMode,
      accepted: existing?.accepted ?? false,
      signatoryName: existing?.signatoryName || applicant.fullName,
      signedDate: existing?.signedAt ? existing.signedAt.slice(0, 10) : todayIso(),
      /*
       * Falls back to the uploaded file itself, not just the declaration
       * record. Uploading does not create that record — so a student who
       * uploaded their signed copy and left without pressing the button came
       * back to see the file listed on screen while this field was empty, and
       * was told to "Upload the signed declaration to continue" with the
       * document sitting right there. Newest last: attachments arrive ordered
       * by `createdAt` ascending.
       */
      signedDocumentId: existing?.signedDocumentId ?? signedDeclarations.at(-1)?.id ?? "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await callAction(() =>
        saveDeclarationStep({
          applicationId: application.id,
          values,
        }),
      );

      if (!result.ok) {
        applyFieldErrors(form, result.fieldErrors, result.message);
        toast.error(result.message);
        return;
      }

      toast.success("Declaration recorded.");
      if (nextHref) router.push(nextHref);
      else router.refresh();
    });
  });

  const changeMode = (next: DeclarationInput["mode"]) => {
    setMode(next);
    form.setValue("mode", next, { shouldValidate: false });
    form.clearErrors();
  };

  const rootError = form.formState.errors.root?.message;
  const acceptedError = form.formState.errors.accepted?.message;
  const documentError = form.formState.errors.signedDocumentId?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {rootError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>We couldn&rsquo;t record your declaration</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <blockquote className="rounded-lg border-l-4 border-primary bg-muted/40 p-4 text-sm leading-relaxed">
        {DECLARATION_TEXT}
      </blockquote>

      {allowedMode === "BOTH" && !readOnly && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">How would you like to declare?</legend>
          <RadioGroup
            value={mode}
            onValueChange={(next) => changeMode(next as DeclarationInput["mode"])}
            className="grid gap-3 sm:grid-cols-2"
          >
            <FieldLabel htmlFor="declaration-electronic">
              <Field orientation="horizontal">
                <RadioGroupItem value="ELECTRONIC" id="declaration-electronic" />
                <FieldContent>
                  <span className="text-sm font-medium">Declare electronically</span>
                  <FieldDescription>
                    Tick the box and type your full name. Fastest option.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>

            <FieldLabel htmlFor="declaration-upload">
              <Field orientation="horizontal">
                <RadioGroupItem value="SIGNED_UPLOAD" id="declaration-upload" />
                <FieldContent>
                  <span className="text-sm font-medium">Upload a signed copy</span>
                  <FieldDescription>
                    Download the declaration, sign it by hand, and upload the scan.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          </RadioGroup>
        </fieldset>
      )}

      {mode === "SIGNED_UPLOAD" && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Signed declaration</h2>
              <p className="text-sm text-muted-foreground">
                Download the form, sign it as team leader, then upload the signed copy.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/applications/${application.id}/declaration`} download>
                <Download className="size-4" aria-hidden />
                Download declaration
              </a>
            </Button>
          </div>

          {!readOnly && (
            <FileUploader
              applicationId={application.id}
              kind={AttachmentKind.SIGNED_DECLARATION}
              accept={accept}
              maxFileSizeMb={maxFileSizeMb}
              allowedTypesLabel={allowedTypesLabel}
              label="Upload signed declaration"
              onUploaded={(attachmentId) => {
                form.setValue("signedDocumentId", attachmentId, { shouldValidate: true });
                router.refresh();
              }}
            />
          )}

          {signedDeclarations.length > 0 && (
            <AttachmentList
              attachments={signedDeclarations}
              canDelete={!readOnly}
              emptyDescription="Upload the signed declaration to continue."
            />
          )}

          {documentError && (
            <p role="alert" className="text-sm text-destructive">
              {documentError}
            </p>
          )}
        </div>
      )}

      {mode === "ELECTRONIC" && (
        <Field orientation="horizontal" data-invalid={Boolean(acceptedError) || undefined}>
          <Checkbox
            id="declaration-accepted"
            checked={form.watch("accepted") === true}
            disabled={readOnly}
            onCheckedChange={(checked) =>
              form.setValue("accepted", checked === true, { shouldValidate: true })
            }
          />
          <FieldContent>
            <FieldLabel htmlFor="declaration-accepted">
              I declare that the information provided is true and correct.
            </FieldLabel>
            <FieldDescription>
              By ticking this box you confirm the declaration above on behalf of your team. The date
              and time are recorded with your submission.
            </FieldDescription>
            {acceptedError && <FieldError>{acceptedError}</FieldError>}
          </FieldContent>
        </Field>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow
          control={form.control}
          name="signatoryName"
          label="Team leader's full name"
          required
          description="Typed in full, as it appears on your student record."
        >
          {({ field, id, describedBy, invalid }) => (
            <Input
              {...field}
              value={(field.value as string) ?? ""}
              id={id}
              autoComplete="name"
              disabled={readOnly}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </FormRow>

        <FormRow control={form.control} name="signedDate" label="Date" required>
          {({ field, id, describedBy, invalid }) => (
            <Input
              {...field}
              value={(field.value as string) ?? ""}
              id={id}
              type="date"
              max={todayIso()}
              disabled={readOnly}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </FormRow>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        {previousHref ? (
          <Button asChild variant="outline" type="button">
            <Link href={previousHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </Link>
          </Button>
        ) : (
          <span />
        )}

        {readOnly ? (
          <Button asChild variant="outline">
            <Link href={exit.href}>{exit.label}</Link>
          </Button>
        ) : (
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Recording…
              </>
            ) : (
              <>
                <FileSignature className="size-4" aria-hidden />
                Record declaration &amp; review
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
