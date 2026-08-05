"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FormRow } from "@/components/forms/form-row";
import { RichTextEditor } from "@/components/forms/rich-text-editor";

/**
 * A labelled rich-text answer — the shape most of this form takes.
 */
export function RichTextRow<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  min,
  max,
  disabled,
  placeholder,
}: {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description?: React.ReactNode;
  required?: boolean;
  min?: number;
  max: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <FormRow
      control={control}
      name={name}
      label={label}
      description={description}
      required={required}
    >
      {({ field, id, describedBy, invalid }) => (
        <RichTextEditor
          id={id}
          value={(field.value as string) ?? ""}
          onChange={field.onChange}
          onBlur={field.onBlur}
          describedBy={describedBy}
          invalid={invalid}
          minLength={min}
          maxLength={max}
          disabled={disabled}
          placeholder={placeholder ?? label}
        />
      )}
    </FormRow>
  );
}
