"use client";

import { useEffect, useRef } from "react";
import {
  useWatch,
  type Control,
  type FieldPath,
  type FieldValues,
  type PathValue,
  type UseFormSetValue,
} from "react-hook-form";

import { FormRow } from "@/components/forms/form-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SchoolOption } from "@/services/reference/reference-data";

/**
 * Dependent school → section selects.
 *
 * Sections belong to a school, so choosing a different school has to clear a
 * now-invalid section. Doing that here keeps the two forms that use this pair
 * (onboarding and Section A) from having to remember it — and the server
 * re-checks the pairing regardless.
 */
export function SchoolSectionFields<TFieldValues extends FieldValues>({
  control,
  setValue,
  schools,
  schoolFieldName,
  sectionFieldName,
  disabled,
}: {
  control: Control<TFieldValues>;
  setValue: UseFormSetValue<TFieldValues>;
  schools: SchoolOption[];
  schoolFieldName: FieldPath<TFieldValues>;
  sectionFieldName: FieldPath<TFieldValues>;
  disabled?: boolean;
}) {
  const selectedSchoolId = useWatch({ control, name: schoolFieldName }) as string | undefined;
  const selectedSchool = schools.find((school) => school.id === selectedSchoolId);
  const sections = selectedSchool?.sections ?? [];

  /*
   * "No school chosen yet" and "this school lists no sections" both leave the
   * select empty and disabled, but they are not the same problem and must not
   * share a message. A school whose sections have all been deactivated used to
   * tell the student to "Select a school first" — while its own description
   * read "Sections offered by the <school>" — on a field marked required and
   * disabled. That is an unsubmittable form telling the student to do the one
   * thing they had already done.
   */
  const schoolHasNoSections = Boolean(selectedSchool) && sections.length === 0;

  /*
   * A school with no sections cannot produce a submittable form, so it is not
   * offered — except when it is the one already saved on this profile.
   *
   * Dropping it unconditionally would be the worse bug: a student who chose a
   * school before its last section was deactivated would open the form to find
   * their School select silently blank, their recorded answer gone, and no way
   * to put it back. Keeping the saved value visible leaves their data intact
   * and lets the section field below explain what needs fixing.
   *
   * Filtered here rather than in `getSchoolsWithSections` because the admin's
   * application filter reads the same list, and applications keep their
   * `schoolId` after a school loses its sections — pruning at the source would
   * make those entries unfilterable by school in the review console.
   */
  const selectableSchools = schools.filter(
    (school) => school.sections.length > 0 || school.id === selectedSchoolId,
  );

  const previousSchoolId = useRef(selectedSchoolId);

  useEffect(() => {
    // Only clear on a genuine change, not on the first render of a saved value.
    if (previousSchoolId.current !== undefined && previousSchoolId.current !== selectedSchoolId) {
      setValue(sectionFieldName, "" as PathValue<TFieldValues, FieldPath<TFieldValues>>, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
    previousSchoolId.current = selectedSchoolId;
  }, [selectedSchoolId, sectionFieldName, setValue]);

  return (
    <>
      <FormRow
        control={control}
        name={schoolFieldName}
        label="School"
        required
        description="The school you are enrolled in."
      >
        {({ field, id, describedBy, invalid }) => (
          <Select
            value={(field.value as string) ?? ""}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <SelectTrigger
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className="w-full"
            >
              <SelectValue placeholder="Select your school" />
            </SelectTrigger>
            <SelectContent>
              {selectableSchools.map((school) => (
                <SelectItem key={school.id} value={school.id}>
                  {school.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormRow>

      <FormRow
        control={control}
        name={sectionFieldName}
        label="Section"
        required
        description={
          !selectedSchool
            ? "Choose a school first."
            : schoolHasNoSections
              ? `The ${selectedSchool.name} has no sections listed. Contact the challenge office so it can be added.`
              : `Sections offered by the ${selectedSchool.name}.`
        }
      >
        {({ field, id, describedBy, invalid }) => (
          <Select
            value={(field.value as string) ?? ""}
            onValueChange={field.onChange}
            disabled={disabled || sections.length === 0}
          >
            <SelectTrigger
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className="w-full"
            >
              <SelectValue
                placeholder={
                  !selectedSchool
                    ? "Select a school first"
                    : schoolHasNoSections
                      ? "No sections listed for this school"
                      : "Select your section"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormRow>
    </>
  );
}
