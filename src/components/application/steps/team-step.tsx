"use client";

import { useMemo } from "react";
import { useFieldArray } from "react-hook-form";
import { AlertCircle, Plus, Trash2, Users } from "lucide-react";

import { StepFooter } from "@/components/application/step-footer";
import { useStepForm } from "@/components/application/use-step-form";
import { FormRow } from "@/components/forms/form-row";
import { EmptyState } from "@/components/layout/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTeamSchema, type TeamInput } from "@/domain/application/schemas";
import type { ApplicantDto, ApplicationDto } from "@/domain/application/types";
import { ROUTES } from "@/lib/routes";
import type { SchoolOption } from "@/services/reference/reference-data";
import { saveTeamStep } from "@/app/(student)/application/actions";

/**
 * Section B — the team roster.
 *
 * The leader is captured separately and then appears as row 1 of the member
 * table on the printed form, which is exactly how the paper version reads. The
 * rows below are therefore the *other* members, and the limits shown account
 * for the leader occupying one of the places.
 */
export function TeamStep({
  application,
  applicant,
  schools,
  sectionNameById,
  minSize,
  maxSize,
  readOnly,
  previousHref,
  nextHref,
}: {
  application: ApplicationDto;
  applicant: ApplicantDto;
  schools: SchoolOption[];
  /** Covers deactivated sections, which `schools` deliberately omits. */
  sectionNameById: Record<string, string>;
  minSize: number;
  maxSize: number;
  readOnly: boolean;
  previousHref: string | null;
  nextHref: string | null;
}) {
  const schema = useMemo(() => createTeamSchema({ minSize, maxSize }), [minSize, maxSize]);

  /*
   * `schools` carries only active sections, so a member recorded against one
   * that has since been deactivated had no matching option and the select
   * rendered blank — while the review page and the printed form still showed
   * their section, because the name lookup covers inactive rows. The value is
   * still good data and the server preserves it, so it is kept in the list
   * rather than warned about; only the picker had forgotten it.
   */
  const activeSectionIds = useMemo(
    () => new Set(schools.flatMap((school) => school.sections.map((section) => section.id))),
    [schools],
  );
  const team = application.team;
  const otherMembers = team?.members.filter((member) => !member.isLeader) ?? [];

  const { form, submit, saveAndExit, isSubmitting, autosaveState, lastSavedAt } =
    useStepForm<TeamInput>({
      schema,
      applicationId: application.id,
      action: saveTeamStep,
      nextHref,
      readOnly,
      defaultValues: {
        name: team?.name ?? "",
        leaderName: team?.leaderName || applicant.fullName,
        leaderStudentId: team?.leaderStudentId || applicant.studentId,
        leaderEmail: team?.leaderEmail || applicant.email,
        leaderPhone: team?.leaderPhone ?? application.applicantPhone ?? "",
        supervisorName: team?.supervisorName ?? "",
        supervisorEmail: team?.supervisorEmail ?? "",
        members: otherMembers.map((member) => ({
          studentId: member.studentId,
          firstName: member.firstName,
          surname: member.surname,
          sectionId: member.sectionId ?? "",
          sectionLabel: member.sectionLabel ?? "",
          role: member.role ?? "",
          email: member.email ?? "",
          phone: member.phone ?? "",
        })),
      },
    });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "members" });

  const rootError = form.formState.errors.root?.message;
  const membersError = form.formState.errors.members?.message;
  const totalSize = fields.length + 1;
  const canAddMore = totalSize < maxSize;

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {rootError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>We couldn&rsquo;t save your team</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <FormRow
          control={form.control}
          name="name"
          label="Team name"
          required
          description="Must be unique across the challenge. Choose something you are happy to see in the programme."
        >
          {({ field, id, describedBy, invalid }) => (
            <Input
              {...field}
              value={field.value ?? ""}
              id={id}
              autoComplete="off"
              placeholder="Highlands Digital"
              disabled={readOnly}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </FormRow>
      </FieldGroup>

      <FieldSet>
        <FieldLegend>Team leader</FieldLegend>
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormRow control={form.control} name="leaderName" label="Leader's full name" required>
              {({ field, id, describedBy, invalid }) => (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id={id}
                  autoComplete="name"
                  disabled={readOnly}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                />
              )}
            </FormRow>

            <FormRow
              control={form.control}
              name="leaderStudentId"
              label="Leader's student ID"
              required
            >
              {({ field, id, describedBy, invalid }) => (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id={id}
                  inputMode="numeric"
                  disabled={readOnly}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                />
              )}
            </FormRow>

            <FormRow
              control={form.control}
              name="leaderEmail"
              label="Contact email"
              required
              description="All correspondence about this application goes here."
            >
              {({ field, id, describedBy, invalid }) => (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id={id}
                  type="email"
                  inputMode="email"
                  spellCheck={false}
                  disabled={readOnly}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                />
              )}
            </FormRow>

            <FormRow control={form.control} name="leaderPhone" label="Leader's phone" required>
              {({ field, id, describedBy, invalid }) => (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id={id}
                  type="tel"
                  inputMode="tel"
                  placeholder="+675 7123 4567"
                  disabled={readOnly}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                />
              )}
            </FormRow>
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Supervisor (optional)</FieldLegend>
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormRow control={form.control} name="supervisorName" label="Supervisor's name">
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
              name="supervisorEmail"
              label="Supervisor's email"
              description="A PNGUoT staff address."
            >
              {({ field, id, describedBy, invalid }) => (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id={id}
                  type="email"
                  inputMode="email"
                  spellCheck={false}
                  disabled={readOnly}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                />
              )}
            </FormRow>
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <FieldLegend>Team members</FieldLegend>
          <p className="text-sm tabular-nums text-muted-foreground">
            {totalSize} of {maxSize} places used
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          The leader counts as a member. Teams need {minSize}–{maxSize} people in total, so add{" "}
          {Math.max(0, minSize - 1)}–{maxSize - 1} others here.
        </p>

        {membersError && (
          <p role="alert" className="text-sm text-destructive">
            {membersError}
          </p>
        )}

        {fields.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members added yet"
            description="Add each member's student ID, name, section and role in the team."
            action={
              !readOnly && (
                // Gated like "Add another member" below. With `team.maxSize`
                // set to 1 the leader already fills the team, and only this
                // button was still offering to add someone the server would
                // then refuse.
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append(emptyMember())}
                  disabled={!canAddMore}
                >
                  <Plus className="size-4" aria-hidden />
                  Add first member
                </Button>
              )
            }
          />
        ) : (
          <ol className="space-y-4">
            {fields.map((fieldItem, index) => (
              <li key={fieldItem.id} className="rounded-lg border p-4">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Member {index + 2}</h3>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only sm:not-sr-only">Remove</span>
                    </Button>
                  )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <FormRow
                    control={form.control}
                    name={`members.${index}.studentId`}
                    label="Student ID"
                    required
                  >
                    {({ field, id, describedBy, invalid }) => (
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        id={id}
                        inputMode="numeric"
                        disabled={readOnly}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                      />
                    )}
                  </FormRow>

                  <FormRow
                    control={form.control}
                    name={`members.${index}.firstName`}
                    label="First name"
                    required
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
                    name={`members.${index}.surname`}
                    label="Surname"
                    required
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
                    name={`members.${index}.sectionId`}
                    label="Section"
                  >
                    {({ field, id, describedBy, invalid }) => (
                      <Select
                        value={(field.value as string) ?? ""}
                        onValueChange={field.onChange}
                        disabled={readOnly}
                      >
                        <SelectTrigger
                          id={id}
                          aria-describedby={describedBy}
                          aria-invalid={invalid || undefined}
                          className="w-full"
                        >
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const current = (field.value as string) ?? "";
                            if (!current || activeSectionIds.has(current)) return null;
                            return (
                              <SelectGroup>
                                <SelectLabel>No longer offered</SelectLabel>
                                <SelectItem value={current}>
                                  {sectionNameById[current] ?? "Previously selected section"}
                                </SelectItem>
                              </SelectGroup>
                            );
                          })()}
                          {schools.map((school) => (
                            <SelectGroup key={school.id}>
                              <SelectLabel>{school.name}</SelectLabel>
                              {school.sections.map((section) => (
                                <SelectItem key={section.id} value={section.id}>
                                  {section.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormRow>

                  <FormRow
                    control={form.control}
                    name={`members.${index}.role`}
                    label="Role in the team"
                    required
                  >
                    {({ field, id, describedBy, invalid }) => (
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        id={id}
                        placeholder="Backend developer"
                        disabled={readOnly}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                      />
                    )}
                  </FormRow>

                  <FormRow
                    control={form.control}
                    name={`members.${index}.email`}
                    label="University email"
                    description="Optional."
                  >
                    {({ field, id, describedBy, invalid }) => (
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        id={id}
                        type="email"
                        inputMode="email"
                        spellCheck={false}
                        disabled={readOnly}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                      />
                    )}
                  </FormRow>
                </div>
              </li>
            ))}
          </ol>
        )}

        {!readOnly && fields.length > 0 && (
          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => append(emptyMember())}
              disabled={!canAddMore}
            >
              <Plus className="size-4" aria-hidden />
              Add another member
            </Button>
            {!canAddMore && (
              <p className="mt-2 text-xs text-muted-foreground">
                A team may have at most {maxSize} members, including the leader.
              </p>
            )}
          </div>
        )}
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

function emptyMember() {
  return {
    studentId: "",
    firstName: "",
    surname: "",
    sectionId: "",
    sectionLabel: "",
    role: "",
    email: "",
    phone: "",
  };
}
