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
              {schools.map((school) => (
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
          selectedSchool
            ? `Sections offered by the ${selectedSchool.name}.`
            : "Choose a school first."
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
                placeholder={sections.length === 0 ? "Select a school first" : "Select your section"}
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
