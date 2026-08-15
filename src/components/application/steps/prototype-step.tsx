"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";

import { StepFooter } from "@/components/application/step-footer";
import { useStepForm } from "@/components/application/use-step-form";
import { FormRow } from "@/components/forms/form-row";
import { RichTextRow } from "@/components/forms/rich-text-row";
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
import { prototypeSchema, type PrototypeInput } from "@/domain/application/schemas";
import { PROTOTYPE_TYPES } from "@/domain/challenge/constants";
import type { ApplicationDto } from "@/domain/application/types";
import { ROUTES } from "@/lib/routes";
import { savePrototypeStep } from "@/app/(student)/application/actions";

/**
 * Prototype details. `Other` swaps the select for a free-text box rather than
 * silently storing the literal word "Other".
 */
export function PrototypeStep({
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
    useStepForm<PrototypeInput>({
      schema: prototypeSchema,
      applicationId: application.id,
      action: savePrototypeStep,
      nextHref,
      readOnly,
      defaultValues: {
        prototypeType: application.prototypeType ?? "",
        prototypeFeatures: application.prototypeFeatures ?? "",
        developmentTools: application.developmentTools ?? "",
      },
    });

  const rootError = form.formState.errors.root?.message;

  /*
   * Whether the free-text box is showing is component state, not something
   * encoded in the field value.
   *
   * It used to be inferred from the value, with a single space as the "Other"
   * sentinel and `value.trim()` rendered into the input to hide it. That made
   * the input fight the typist: every render reset the DOM value to the
   * trimmed form, so a space could never be entered and characters around it
   * were dropped. Typing " prototype" onto "Hardware rig" produced
   * "Hardware rigtotype" — multi-word types were unenterable and the result
   * was silently mangled.
   *
   * A stored value of literally "Other" counts as custom too: it is a preset
   * name, but it describes nothing, so the student is asked to say what they
   * built.
   */
  const savedType = application.prototypeType ?? "";
  const [isCustomType, setIsCustomType] = useState(
    savedType !== "" && (!PROTOTYPE_TYPES.includes(savedType) || savedType === "Other"),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {rootError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>We couldn&rsquo;t save this section</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <FormRow
          control={form.control}
          name="prototypeType"
          label="Prototype type"
          required
          description="Desktop, web app, mobile app, digital tool, and so on."
        >
          {({ field, id, describedBy, invalid }) => {
            const value = (field.value as string) ?? "";

            return (
              <div className="space-y-2">
                <Select
                  value={isCustomType ? "Other" : value}
                  onValueChange={(next) => {
                    setIsCustomType(next === "Other");
                    // Clear on switching to Other so the box starts empty and
                    // the "describe your prototype type" rule can bite.
                    field.onChange(next === "Other" ? "" : next);
                  }}
                  disabled={readOnly}
                >
                  <SelectTrigger
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    className="w-full sm:w-80"
                  >
                    <SelectValue placeholder="Select a prototype type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROTOTYPE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {isCustomType && (
                  <Input
                    value={value}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    placeholder="Describe your prototype type"
                    aria-label="Prototype type (other)"
                    disabled={readOnly}
                    className="sm:w-80"
                  />
                )}
              </div>
            );
          }}
        </FormRow>

        <RichTextRow
          control={form.control}
          name="prototypeFeatures"
          label="Prototype features"
          required
          min={60}
          max={2000}
          disabled={readOnly}
          description="List the main functions your prototype demonstrates. A bulleted list works well here."
        />

        <RichTextRow
          control={form.control}
          name="developmentTools"
          label="Development tools / platforms"
          required
          min={20}
          max={1000}
          disabled={readOnly}
          description="Name the development tools and/or platforms you used to build it."
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
