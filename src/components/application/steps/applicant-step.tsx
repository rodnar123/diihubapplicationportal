"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { StepFooter } from "@/components/application/step-footer";
import { DraftRecoveryBanner } from "@/components/application/draft-recovery-banner";
import { useStepForm } from "@/components/application/use-step-form";
import { FormRow } from "@/components/forms/form-row";
import { SchoolSectionFields } from "@/components/forms/school-section-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applicantSectionSchema,
  type ApplicantSectionInput,
} from "@/domain/application/schemas";
import { YEAR_LEVEL_OPTIONS } from "@/domain/challenge/constants";
import type { ApplicantDto, ApplicationDto } from "@/domain/application/types";
import { ROUTES } from "@/lib/routes";
import type { SchoolOption } from "@/services/reference/reference-data";
import { saveApplicantStep } from "@/app/(student)/application/actions";

/**
 * Section A. Identity (name, student ID, email) is fixed by the account and
 * shown read-only; the enrolment details are per-application, because a
 * student's year level changes between challenge cycles.
 */
export function ApplicantStep({
  application,
  applicant,
  schools,
  readOnly,
  previousHref,
  nextHref,
}: {
  application: ApplicationDto;
  applicant: ApplicantDto;
  schools: SchoolOption[];
  readOnly: boolean;
  previousHref: string | null;
  nextHref: string | null;
}) {
  const {
    form,
    submit,
    saveAndExit,
    isSubmitting,
    autosaveState,
    lastSavedAt,
    recoverable,
    restoreDraft,
    discardDraft,
  } =
    useStepForm<ApplicantSectionInput>({
      schema: applicantSectionSchema,
      applicationId: application.id,
      step: "applicant",
      action: saveApplicantStep,
      nextHref,
      readOnly,
      defaultValues: {
        applicantPhone: application.applicantPhone ?? "",
        schoolId: application.schoolId ?? "",
        sectionId: application.sectionId ?? "",
        program: application.program ?? "",
        yearLevel: application.yearLevel ?? undefined,
      },
    });

  const rootError = form.formState.errors.root?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {recoverable && (
        <DraftRecoveryBanner
          savedAt={recoverable.savedAt}
          onRestore={restoreDraft}
          onDiscard={discardDraft}
        />
      )}

      {rootError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>We couldn&rsquo;t save this section</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Full name</dt>
            <dd className="mt-0.5 text-sm font-medium">{applicant.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Student ID</dt>
            <dd className="mt-0.5 font-mono text-sm font-medium">{applicant.studentId}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">University email</dt>
            {/* Wraps rather than truncates, like the summary: an address cut to
                "…@student.pnguot.ac" is not something the reader can recover. */}
            <dd className="mt-0.5 text-sm font-medium [overflow-wrap:anywhere]">
              {applicant.email}
            </dd>
          </div>
        </dl>

        {/* The `<p>` used to sit directly inside the `<dl>`, which may only hold
            dt/dd/div — browsers silently reparent it, and React then hydrates
            against a tree the server did not describe. */}
        <p className="text-xs text-muted-foreground">
          These come from your account.{" "}
          {/* A `Link`, not an `<a>`. A hard navigation tears the page down
              without running React cleanup, so the step's pending autosave
              would never flush and the last edits here would be lost. */}
          <Link
            href={ROUTES.onboarding}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Update your profile
          </Link>{" "}
          if anything is wrong.
        </p>
      </div>

      <FieldGroup>
        <FormRow
          control={form.control}
          name="applicantPhone"
          label="Contact phone number"
          required
          description="The number the challenge office should use for this application."
        >
          {({ field, id, describedBy, invalid }) => (
            <Input
              {...field}
              value={field.value ?? ""}
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+675 7123 4567"
              disabled={readOnly}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </FormRow>

        <SchoolSectionFields
          control={form.control}
          setValue={form.setValue}
          schools={schools}
          schoolFieldName="schoolId"
          sectionFieldName="sectionId"
          disabled={readOnly}
        />

        <FormRow
          control={form.control}
          name="program"
          label="Programme of study"
          required
          description="For example, Bachelor of Business (Information Technology)."
        >
          {({ field, id, describedBy, invalid }) => (
            <Input
              {...field}
              value={field.value ?? ""}
              id={id}
              disabled={readOnly}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </FormRow>

        <FormRow
          control={form.control}
          name="yearLevel"
          label="Year level"
          required
          description="Your year level for this challenge cycle."
        >
          {({ field, id, describedBy, invalid }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={readOnly}>
              <SelectTrigger
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className="w-full sm:w-64"
              >
                <SelectValue placeholder="Select your year level" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormRow>
      </FieldGroup>

      <StepFooter
        previousHref={previousHref}
        isSubmitting={isSubmitting}
        autosaveState={autosaveState}
        lastSavedAt={lastSavedAt}
        readOnly={readOnly}
        onSaveAndExit={() => saveAndExit(ROUTES.dashboard)}
      />
    </form>
  );
}
