"use client";

import { AlertCircle } from "lucide-react";

import { StepFooter } from "@/components/application/step-footer";
import { useStepForm } from "@/components/application/use-step-form";
import { FormRow } from "@/components/forms/form-row";
import { RichTextRow } from "@/components/forms/rich-text-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { impactSchema, type ImpactInput } from "@/domain/application/schemas";
import type { ApplicationDto } from "@/domain/application/types";
import { ROUTES } from "@/lib/routes";
import { saveImpactStep } from "@/app/(student)/application/actions";

/**
 * Impact & feasibility, plus the optional budget and the required timeline.
 */
export function ImpactStep({
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
    useStepForm<ImpactInput>({
      schema: impactSchema,
      applicationId: application.id,
      action: saveImpactStep,
      nextHref,
      readOnly,
      defaultValues: {
        valueProposition: application.valueProposition ?? "",
        implementationPlan: application.implementationPlan ?? "",
        expectedImpact: application.expectedImpact ?? "",
        sustainability: application.sustainability ?? "",
        timeline: application.timeline ?? "",
        budgetAmount: application.budgetAmount ?? "",
        budgetNotes: application.budgetNotes ?? "",
      },
    });

  const rootError = form.formState.errors.root?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {rootError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>We couldn&rsquo;t save this section</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <RichTextRow
          control={form.control}
          name="valueProposition"
          label="Value proposition"
          required
          min={60}
          max={2000}
          disabled={readOnly}
          description="How does your solution improve lives, processes, or opportunities?"
        />

        <RichTextRow
          control={form.control}
          name="implementationPlan"
          label="Implementation plan"
          required
          min={80}
          max={3000}
          disabled={readOnly}
          description="The steps and resources needed to bring your idea to life."
        />

        <RichTextRow
          control={form.control}
          name="expectedImpact"
          label="Expected impact"
          required
          min={60}
          max={2000}
          disabled={readOnly}
          description="What is the impact of this solution? Quantify it where you can."
        />

        <RichTextRow
          control={form.control}
          name="timeline"
          label="Timeline"
          required
          min={40}
          max={2000}
          disabled={readOnly}
          description="The phases of work and roughly when each happens."
        />

        <RichTextRow
          control={form.control}
          name="sustainability"
          label="Sustainability"
          min={0}
          max={2000}
          disabled={readOnly}
          description="Optional. How the venture keeps running once the challenge is over."
        />
      </FieldGroup>

      <FieldSet>
        <FieldLegend>Budget (optional)</FieldLegend>
        <FieldGroup>
          <FormRow
            control={form.control}
            name="budgetAmount"
            label="Estimated budget"
            description="Total funding you estimate the venture needs, in kina."
          >
            {({ field, id, describedBy, invalid }) => (
              <InputGroup className="sm:w-64">
                <InputGroupAddon>K</InputGroupAddon>
                <InputGroupInput
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={field.value === null || field.value === undefined ? "" : String(field.value)}
                  onChange={(event) => {
                    const raw = event.target.value;
                    field.onChange(raw === "" ? "" : Number(raw));
                  }}
                  onBlur={field.onBlur}
                  placeholder="48500.00"
                  disabled={readOnly}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                />
              </InputGroup>
            )}
          </FormRow>

          <RichTextRow
            control={form.control}
            name="budgetNotes"
            label="Budget notes"
            min={0}
            max={1500}
            disabled={readOnly}
            description="Optional. What the budget covers, and any funding you have already secured."
          />
        </FieldGroup>
      </FieldSet>

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
