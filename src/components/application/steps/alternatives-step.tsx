"use client";

import { AlertCircle, Info } from "lucide-react";

import { StepFooter } from "@/components/application/step-footer";
import { useStepForm } from "@/components/application/use-step-form";
import { RichTextRow } from "@/components/forms/rich-text-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import { alternativesSchema, type AlternativesInput } from "@/domain/application/schemas";
import { REQUIRED_ALTERNATIVE_COUNT } from "@/domain/challenge/constants";
import type { ApplicationDto } from "@/domain/application/types";
import { ROUTES } from "@/lib/routes";
import { saveAlternativesStep } from "@/app/(student)/application/actions";

export function AlternativesStep({
  application,
  readOnly,
  previousHref,
  nextHref,
}: {
  application: ApplicationDto;
  readOnly: boolean;
  previousHref: string | null;
  nextHref: string | null;
}) {
  const { form, submit, saveAndExit, isSubmitting, autosaveState, lastSavedAt } =
    useStepForm<AlternativesInput>({
      schema: alternativesSchema,
      applicationId: application.id,
      action: saveAlternativesStep,
      nextHref,
      readOnly,
      defaultValues: {
        alternatives: application.alternatives ?? "",
        justification: application.justification ?? "",
      },
    });

  const rootError = form.formState.errors.root?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {rootError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>We couldn&rsquo;t save this section</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="size-4" aria-hidden />
        <AlertTitle>What reviewers look for</AlertTitle>
        <AlertDescription>
          Name {REQUIRED_ALTERNATIVE_COUNT} solutions that already exist for the problem you
          identified — including the informal ones people use today. Showing you understand the
          current alternatives is what makes your justification credible.
        </AlertDescription>
      </Alert>

      <FieldGroup>
        <RichTextRow
          control={form.control}
          name="alternatives"
          label="Alternative solutions"
          required
          min={150}
          max={3000}
          disabled={readOnly}
          description={`List and briefly explain ${REQUIRED_ALTERNATIVE_COUNT} existing solutions that may address the challenge you identified. Numbering them makes this easier to read.`}
        />

        <RichTextRow
          control={form.control}
          name="justification"
          label="Justification"
          required
          min={60}
          max={2000}
          disabled={readOnly}
          description="Briefly explain why your solution is preferred over the alternatives."
        />
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
