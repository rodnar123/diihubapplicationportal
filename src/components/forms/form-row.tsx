"use client";

import { useId } from "react";
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Binds one React Hook Form field to the shadcn `Field` primitives.
 *
 * The point of the wrapper is accessibility: the label, description and error
 * are wired to the control through `id`/`aria-describedby`/`aria-invalid`
 * exactly once, here, instead of being re-derived (and occasionally forgotten)
 * at each of the ~40 fields on this form.
 */

export interface FormRowRenderProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  field: ControllerRenderProps<TFieldValues, TName>;
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

export function FormRow<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  required,
  orientation,
  className,
  hideLabel,
  children,
}: {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: React.ReactNode;
  required?: boolean;
  orientation?: React.ComponentProps<typeof Field>["orientation"];
  className?: string;
  hideLabel?: boolean;
  children: (props: FormRowRenderProps<TFieldValues, TName>) => React.ReactNode;
}) {
  const reactId = useId();
  const controlId = `${reactId}-control`;
  const descriptionId = `${reactId}-description`;
  const errorId = `${reactId}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const invalid = Boolean(fieldState.error);
        const describedBy =
          [description ? descriptionId : null, invalid ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined;

        return (
          <Field
            orientation={orientation}
            data-invalid={invalid || undefined}
            className={className}
          >
            <FieldLabel htmlFor={controlId} className={cn(hideLabel && "sr-only")}>
              {label}
              {required && (
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              )}
              {required && <span className="sr-only">(required)</span>}
            </FieldLabel>

            {children({ field, id: controlId, describedBy, invalid })}

            {description && (
              <FieldDescription id={descriptionId}>{description}</FieldDescription>
            )}

            {invalid && <FieldError id={errorId}>{fieldState.error?.message}</FieldError>}
          </Field>
        );
      }}
    />
  );
}

/**
 * Horizontal variant for a checkbox or switch, where the label sits beside the
 * control and carries its own descriptive text.
 */
export function FormToggleRow<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  className,
  children,
}: {
  control: Control<TFieldValues>;
  name: TName;
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: (props: FormRowRenderProps<TFieldValues, TName>) => React.ReactNode;
}) {
  const reactId = useId();
  const controlId = `${reactId}-control`;
  const descriptionId = `${reactId}-description`;
  const errorId = `${reactId}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const invalid = Boolean(fieldState.error);
        const describedBy =
          [description ? descriptionId : null, invalid ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined;

        return (
          <Field orientation="horizontal" data-invalid={invalid || undefined} className={className}>
            {children({ field, id: controlId, describedBy, invalid })}
            <FieldContent>
              <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
              {description && (
                <FieldDescription id={descriptionId}>{description}</FieldDescription>
              )}
              {invalid && <FieldError id={errorId}>{fieldState.error?.message}</FieldError>}
            </FieldContent>
          </Field>
        );
      }}
    />
  );
}
