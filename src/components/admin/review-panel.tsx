"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw, ScanEye, XCircle } from "lucide-react";

import { FormRow, FormToggleRow } from "@/components/forms/form-row";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { decisionSchema, type DecisionInput } from "@/domain/application/schemas";
import { allowedTransitions } from "@/domain/application/status";
import { ApplicationStatus, type Role } from "@/generated/prisma/enums";
import { applyFieldErrors } from "@/lib/form-errors";
import { recordDecisionAction } from "@/app/(admin)/admin/actions";

/**
 * The reviewer's decision form.
 *
 * Only transitions the workflow actually permits from the current status are
 * offered, so an impossible move cannot be attempted; the server re-checks the
 * same rule, since a stale tab could still post one.
 */

const DECISION_META: Record<
  string,
  { label: string; icon: typeof CheckCircle2; variant: "default" | "outline" | "destructive"; hint: string }
> = {
  UNDER_REVIEW: {
    label: "Start review",
    icon: ScanEye,
    variant: "outline",
    hint: "Marks the entry as being assessed. The team is told, but no action is required from them.",
  },
  REVISION_REQUESTED: {
    label: "Request revision",
    icon: RotateCcw,
    variant: "outline",
    hint: "Re-opens the form for the team. Your note is shared with them and is required.",
  },
  APPROVED: {
    label: "Approve",
    icon: CheckCircle2,
    variant: "default",
    hint: "Accepts the entry into the challenge.",
  },
  REJECTED: {
    label: "Reject",
    icon: XCircle,
    variant: "destructive",
    hint: "Declines the entry. A reason is required and is shared with the team.",
  },
};

export function ReviewPanel({
  applicationId,
  currentStatus,
  reviewerRole,
}: {
  applicationId: string;
  currentStatus: ApplicationStatus;
  reviewerRole: Role;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<DecisionInput["status"] | null>(null);

  const available = allowedTransitions(currentStatus, reviewerRole).filter(
    (status): status is Exclude<ApplicationStatus, "DRAFT" | "SUBMITTED" | "WITHDRAWN"> =>
      status in DECISION_META,
  );

  const form = useForm<DecisionInput>({
    resolver: zodResolver(decisionSchema),
    mode: "onSubmit",
    defaultValues: {
      status: (available[0] ?? "UNDER_REVIEW") as DecisionInput["status"],
      note: "",
      notifyApplicant: true,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await recordDecisionAction({ applicationId, values });

      if (!result.ok) {
        applyFieldErrors(form, result.fieldErrors, result.message);
        toast.error(result.message);
        return;
      }

      toast.success("Decision recorded.");
      form.reset({ status: values.status, note: "", notifyApplicant: true });
      setSelected(null);
      router.refresh();
    });
  });

  if (available.length === 0) {
    return (
      <Alert>
        <AlertTitle>No further action available</AlertTitle>
        <AlertDescription>
          This application is in a state you cannot change from here.
        </AlertDescription>
      </Alert>
    );
  }

  const activeStatus = form.watch("status");
  const meta = DECISION_META[activeStatus];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Decision</legend>

        <div className="flex flex-wrap gap-2">
          {available.map((status) => {
            const option = DECISION_META[status];
            const isActive = activeStatus === status;

            return (
              <Button
                key={status}
                type="button"
                variant={isActive ? option.variant : "outline"}
                size="sm"
                aria-pressed={isActive}
                onClick={() => {
                  form.setValue("status", status as DecisionInput["status"], {
                    shouldValidate: false,
                  });
                  form.clearErrors();
                  setSelected(status as DecisionInput["status"]);
                }}
              >
                <option.icon className="size-4" aria-hidden />
                {option.label}
              </Button>
            );
          })}
        </div>

        {meta && <p className="text-sm text-muted-foreground">{meta.hint}</p>}
      </fieldset>

      <FormRow
        control={form.control}
        name="note"
        label={
          activeStatus === "REVISION_REQUESTED"
            ? "What does the team need to change?"
            : activeStatus === "REJECTED"
              ? "Reason for rejection"
              : "Note (optional)"
        }
        required={activeStatus === "REVISION_REQUESTED" || activeStatus === "REJECTED"}
        description="Shared with the team when the box below is ticked, and recorded in the status history either way."
      >
        {({ field, id, describedBy, invalid }) => (
          <Textarea
            {...field}
            value={field.value ?? ""}
            id={id}
            rows={5}
            placeholder={
              activeStatus === "REVISION_REQUESTED"
                ? "Be specific — name the section and what is missing."
                : "Add any context for the record."
            }
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          />
        )}
      </FormRow>

      <FormToggleRow
        control={form.control}
        name="notifyApplicant"
        label="Notify the team"
        description="Sends an email and an in-app notification, and shares your note with them."
      >
        {({ field, id }) => (
          <Checkbox
            id={id}
            checked={field.value === true}
            onCheckedChange={(checked) => field.onChange(checked === true)}
          />
        )}
      </FormToggleRow>

      {form.formState.errors.root?.message && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>We couldn&rsquo;t record that decision</AlertTitle>
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending} variant={meta?.variant ?? "default"}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Recording…
          </>
        ) : (
          <>
            {meta?.icon && <meta.icon className="size-4" aria-hidden />}
            {selected ? meta?.label : `Record: ${meta?.label ?? "decision"}`}
          </>
        )}
      </Button>
    </form>
  );
}
