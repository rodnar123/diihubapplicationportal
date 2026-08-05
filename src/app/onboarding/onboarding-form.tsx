"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";

import { FormRow } from "@/components/forms/form-row";
import { SchoolSectionFields } from "@/components/forms/school-section-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  studentProfileSchema,
  type StudentProfileInput,
} from "@/domain/application/schemas";
import { YEAR_LEVEL_OPTIONS } from "@/domain/challenge/constants";
import { applyFieldErrors } from "@/lib/form-errors";
import type { SchoolOption } from "@/services/reference/reference-data";
import { saveStudentProfile } from "./actions";

export function OnboardingForm({
  schools,
  defaultValues,
  email,
  isEditing,
}: {
  schools: SchoolOption[];
  defaultValues: Partial<StudentProfileInput>;
  email: string;
  isEditing: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<StudentProfileInput>({
    resolver: zodResolver(studentProfileSchema),
    mode: "onBlur",
    defaultValues: {
      studentId: defaultValues.studentId ?? "",
      firstName: defaultValues.firstName ?? "",
      surname: defaultValues.surname ?? "",
      phone: defaultValues.phone ?? "",
      schoolId: defaultValues.schoolId ?? "",
      sectionId: defaultValues.sectionId ?? "",
      program: defaultValues.program ?? "",
      yearLevel: defaultValues.yearLevel,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveStudentProfile(values);

      if (!result.ok) {
        applyFieldErrors(form, result.fieldErrors);
        toast.error(result.message);
        return;
      }

      toast.success(isEditing ? "Your details have been updated." : "Your profile is set up.");
      router.push(result.data.redirectTo);
      router.refresh();
    });
  });

  const formError = form.formState.errors.root?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>We couldn&rsquo;t save your details</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <FormRow
          control={form.control}
          name="studentId"
          label="Student ID"
          required
          description={`Your university student number — the digits at the start of ${email}.`}
        >
          {({ field, id, describedBy, invalid }) => (
            <Input
              {...field}
              id={id}
              inputMode="numeric"
              autoComplete="off"
              placeholder="25530061"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </FormRow>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow control={form.control} name="firstName" label="First name" required>
            {({ field, id, describedBy, invalid }) => (
              <Input
                {...field}
                id={id}
                autoComplete="given-name"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
              />
            )}
          </FormRow>

          <FormRow control={form.control} name="surname" label="Surname" required>
            {({ field, id, describedBy, invalid }) => (
              <Input
                {...field}
                id={id}
                autoComplete="family-name"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
              />
            )}
          </FormRow>
        </div>

        <FormRow
          control={form.control}
          name="phone"
          label="Phone number"
          required
          description="Used by the challenge office if they need to reach you about your entry."
        >
          {({ field, id, describedBy, invalid }) => (
            <Input
              {...field}
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+675 7123 4567"
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
          disabled={isPending}
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
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </FormRow>

        <FormRow control={form.control} name="yearLevel" label="Year level" required>
          {({ field, id, describedBy, invalid }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isPending}>
              <SelectTrigger
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className="w-full"
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

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : (
          <>
            {isEditing ? "Save changes" : "Continue to my dashboard"}
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </Button>
    </form>
  );
}
