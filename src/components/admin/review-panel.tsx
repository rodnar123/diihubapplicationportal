"use client";

import { useTransition } from "react";
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
import {
  allowedTransitions,
  APPLICATION_STATUS_META,
  STATUS_TONE_CLASSES,
} from "@/domain/application/status";
import { ApplicationStatus, type Role } from "@/generated/prisma/enums";
import { applyFieldErrors } from "@/lib/form-errors";
import { callAction } from "@/lib/client-action";
import { cn } from "@/lib/utils";
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
  { label: string; icon: typeof CheckCircle2; hint: string }
> = {
  UNDER_REVIEW: {
    label: "Start review",
    icon: ScanEye,
    hint: "Marks the entry as being assessed. The team is told, but no action is required from them.",
  },
  REVISION_REQUESTED: {
    label: "Request revision",
    icon: RotateCcw,
    hint: "Re-opens the form for the team. Your note is shared with them and is required.",
  },
  APPROVED: {
    label: "Approve",
    icon: CheckCircle2,
    hint: "Accepts the entry into the challenge.",
  },
  REJECTED: {
    label: "Reject",
    icon: XCircle,
    hint: "Declines the entry. A reason is required and is shared with the team.",
  },
};

/**
 * The selected decision wears the tone of the status it will produce, so the
 * chip you arm looks like the badge the application is about to carry.
 *
 * Previously the chip took the *button* variant for its decision, and two of
 * the four decisions were themselves `outline` — so arming "Start review" or
 * "Request revision" left all four chips pixel-identical, with `aria-pressed`
 * as the only signal that anything had been chosen. Weight and ring back the
 * colour up, so the selection does not rest on hue alone (WCAG 1.4.1).
 */
function selectedChipClasses(status: string): string {
  const tone = APPLICATION_STATUS_META[status as ApplicationStatus]?.tone;
  return cn(
    "font-semibold ring-1 ring-inset",
    tone ? STATUS_TONE_CLASSES[tone] : "border-primary bg-primary/10 text-primary",
  );
}

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
      const result = await callAction(() => recordDecisionAction({ applicationId, values }));

      if (!result.ok) {
        applyFieldErrors(form, result.fieldErrors, result.message);
        toast.error(result.message);
        return;
      }

      toast.success("Decision recorded.");
      form.reset({ status: values.status, note: "", notifyApplicant: true });
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
                variant="outline"
                aria-pressed={isActive}
                className={cn("h-9", isActive && selectedChipClasses(status))}
                onClick={() => {
                  form.setValue("status", status as DecisionInput["status"], {
                    shouldValidate: false,
                  });
                  form.clearErrors();
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
                : activeStatus === "REJECTED"
                  ? "Say why the entry was not accepted. The team reads this."
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

      {/*
        Always the solid primary, never the armed decision's own variant.
        Two of the four decisions are `outline`, which rendered the button
        that commits an irreversible change — re-opening a student's form and
        emailing them — as a secondary control indistinguishable from the
        chips above it. Reject keeps the destructive treatment, which is a
        deliberate brake rather than a demotion.
      */}
      <Button
        type="submit"
        disabled={isPending}
        variant={activeStatus === ApplicationStatus.REJECTED ? "destructive" : "default"}
        className={cn(
          "h-11 w-full",
          activeStatus !== ApplicationStatus.REJECTED && "btn-brand",
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Recording…
          </>
        ) : (
          <>
            {meta?.icon && <meta.icon className="size-4" aria-hidden />}
            Record: {meta?.label ?? "decision"}
          </>
        )}
      </Button>
    </form>
  );
}
