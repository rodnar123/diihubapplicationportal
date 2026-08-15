"use client";

import { useMemo } from "react";
import { AlertCircle } from "lucide-react";

import { StepFooter } from "@/components/application/step-footer";
import { useStepForm } from "@/components/application/use-step-form";
import { FormRow } from "@/components/forms/form-row";
import { RichTextRow } from "@/components/forms/rich-text-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createVentureSchema, type VentureInput } from "@/domain/application/schemas";
import { SDG_GOALS } from "@/domain/challenge/constants";
import type { ApplicationDto } from "@/domain/application/types";
import { ROUTES } from "@/lib/routes";
import { saveVentureStep } from "@/app/(student)/application/actions";

/**
 * Section C — the venture itself. This is the heart of the application and
 * carries the questions reviewers weight most heavily.
 */
export function VentureStep({
  application,
  themes,
  readOnly,
  previousHref,
  nextHref,
}: {
  application: ApplicationDto;
  themes: string[];
  readOnly: boolean;
  previousHref: string | null;
  nextHref: string | null;
}) {
  const schema = useMemo(() => createVentureSchema({ themes }), [themes]);

  const { form, submit, saveAndExit, isSubmitting, autosaveState, lastSavedAt } =
    useStepForm<VentureInput>({
      schema,
      applicationId: application.id,
      action: saveVentureStep,
      nextHref,
      readOnly,
      defaultValues: {
        projectTitle: application.projectTitle ?? "",
        theme: application.theme ?? "",
        sdgAlignment: application.sdgAlignment ?? [],
        problemStatement: application.problemStatement ?? "",
        proposedSolution: application.proposedSolution ?? "",
        innovation: application.innovation ?? "",
        objectives: application.objectives ?? "",
        targetUsers: application.targetUsers ?? "",
      },
    });

  const rootError = form.formState.errors.root?.message;

  /*
   * Administrators can rename or remove a theme at any time, and the setting
   * takes effect immediately. When that happens to a theme a team already
   * chose, the Select has no option matching the saved value and simply shows
   * its placeholder — the student's answer disappears from the screen with no
   * explanation, and saving then fails the `themes.includes` check for a
   * reason they cannot see. Say what happened instead.
   */
  const savedTheme = application.theme ?? "";
  const themeRetired = savedTheme.length > 0 && !themes.includes(savedTheme);

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {rootError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>We couldn&rsquo;t save this section</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      {themeRetired && !readOnly && (
        <Alert>
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Your theme is no longer offered</AlertTitle>
          <AlertDescription>
            You chose &ldquo;{savedTheme}&rdquo;, which the challenge office has since changed.
            Pick the closest theme from the list before saving.
          </AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <FormRow
          control={form.control}
          name="projectTitle"
          label="Proposed venture / project title"
          required
          description="The name your venture will be listed under."
        >
          {({ field, id, describedBy, invalid }) => (
            <Input
              {...field}
              value={field.value ?? ""}
              id={id}
              placeholder="MarketLink PNG — Direct Farmer-to-Buyer Marketplace"
              disabled={readOnly}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </FormRow>

        <FormRow
          control={form.control}
          name="theme"
          label="Theme"
          required
          description="The challenge theme your venture sits under."
        >
          {({ field, id, describedBy, invalid }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={readOnly}>
              <SelectTrigger
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className="w-full"
              >
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme} value={theme}>
                    {theme}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormRow>

        <FormRow
          control={form.control}
          name="sdgAlignment"
          label="SDG alignment"
          required
          description="Select up to five Sustainable Development Goals your venture contributes to."
        >
          {({ field, describedBy, invalid }) => {
            const selected = (field.value as string[]) ?? [];

            return (
              <div
                role="group"
                aria-label="Sustainable Development Goals"
                aria-describedby={describedBy}
                // `aria-invalid` is not valid on role="group"; the error text is
                // announced through `aria-describedby` instead.
                data-invalid={invalid || undefined}
                className="rounded-md border data-[invalid=true]:border-destructive"
              >
                <ScrollArea className="h-64">
                  <ul className="divide-y">
                    {SDG_GOALS.map((goal) => {
                      const checked = selected.includes(goal.code);
                      const atLimit = selected.length >= 5 && !checked;

                      return (
                        <li key={goal.code}>
                          <label
                            className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-accent/60 ${
                              atLimit ? "cursor-not-allowed opacity-50" : ""
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={readOnly || atLimit}
                              onCheckedChange={(next) => {
                                field.onChange(
                                  next === true
                                    ? [...selected, goal.code]
                                    : selected.filter((code) => code !== goal.code),
                                );
                              }}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-medium tabular-nums">SDG {goal.number}</span>
                              <span className="text-muted-foreground"> — {goal.title}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
                <p className="border-t bg-muted/40 px-3 py-1.5 text-xs tabular-nums text-muted-foreground">
                  {selected.length} of 5 selected
                </p>
              </div>
            );
          }}
        </FormRow>

        <RichTextRow
          control={form.control}
          name="problemStatement"
          label="Problem statement"
          required
          min={120}
          max={3000}
          disabled={readOnly}
          description="Briefly describe the real-world challenge your solution addresses. Be specific about who experiences it and how often."
        />

        <RichTextRow
          control={form.control}
          name="proposedSolution"
          label="Tech-driven solution"
          required
          min={120}
          max={3000}
          disabled={readOnly}
          description="Outline your innovative idea and how technology is applied."
        />

        <RichTextRow
          control={form.control}
          name="innovation"
          label="Innovation"
          required
          min={60}
          max={2000}
          disabled={readOnly}
          description="What is genuinely new here, compared with how the problem is handled today?"
        />

        <RichTextRow
          control={form.control}
          name="objectives"
          label="Objectives"
          required
          min={60}
          max={2000}
          disabled={readOnly}
          description="What you intend to achieve. Measurable objectives are stronger than general aims."
        />

        <RichTextRow
          control={form.control}
          name="targetUsers"
          label="Target users / beneficiaries"
          required
          min={40}
          max={1500}
          disabled={readOnly}
          description="Who are the target users or beneficiaries?"
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
