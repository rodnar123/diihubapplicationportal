"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CompletenessReport } from "@/domain/application/completeness";
import { APPLICATION_STEPS, type ApplicationStepSlug } from "@/domain/application/steps";
import { callAction } from "@/lib/client-action";
import { ROUTES } from "@/lib/routes";
import { submitApplicationAction } from "@/app/(student)/application/actions";

/**
 * The gate between a draft and a submission.
 *
 * The blocking list is generated from the same completeness rules the server
 * enforces on submit, so the student is never told they are ready and then
 * refused — or the reverse.
 */
export function ReviewSubmitPanel({
  applicationId,
  report,
  isResubmission,
  submissionClosedReason,
}: {
  applicationId: string;
  report: CompletenessReport;
  isResubmission: boolean;
  submissionClosedReason: string | null;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const stepTitles = new Map<ApplicationStepSlug, string>(
    APPLICATION_STEPS.map((step) => [step.slug, step.title]),
  );

  const incompleteSteps = report.steps.filter((step) => step.required && !step.complete);
  const blocked = !report.canSubmit || submissionClosedReason !== null;

  const submit = () => {
    startTransition(async () => {
      const result = await callAction(() => submitApplicationAction(applicationId));

      if (!result.ok) {
        toast.error(result.message);
        setConfirmOpen(false);
        router.refresh();
        return;
      }

      setConfirmOpen(false);
      toast.success(
        result.data.isResubmission
          ? `Re-submitted. Your reference remains ${result.data.referenceNumber}.`
          : `Submitted. Your reference number is ${result.data.referenceNumber}.`,
      );
      router.push(ROUTES.dashboard);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {submissionClosedReason ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Submissions are closed</AlertTitle>
          <AlertDescription>{submissionClosedReason}</AlertDescription>
        </Alert>
      ) : report.canSubmit ? (
        <Alert>
          <CheckCircle2 className="size-4 text-success" aria-hidden />
          <AlertTitle>Your application is complete</AlertTitle>
          <AlertDescription>
            Read through the summary below. Once you submit,{" "}
            {isResubmission
              ? "it goes back to the review panel and you will not be able to edit it again."
              : "you will not be able to edit it unless the panel asks for a revision."}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>
            {incompleteSteps.length} section{incompleteSteps.length === 1 ? "" : "s"} still need
            attention
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-2">
              {incompleteSteps.map((step) => (
                <li key={step.slug}>
                  <Link
                    href={ROUTES.applicationStep(step.slug)}
                    className="font-medium underline underline-offset-4"
                  >
                    {stepTitles.get(step.slug)}
                  </Link>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">
                    {step.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <Button asChild variant="outline">
          <Link href={ROUTES.applicationStep("declaration")}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
        </Button>

        <Button type="button" size="lg" disabled={blocked} onClick={() => setConfirmOpen(true)}>
          <Send className="size-4" aria-hidden />
          {isResubmission ? "Re-submit application" : "Submit application"}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isResubmission ? "Re-submit your application?" : "Submit your application?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your entry will be sent to the challenge office and locked for editing. You will be
              given a reference number, and you can download a PDF copy at any time. If the panel
              asks for changes, the form re-opens for you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                submit();
              }}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="size-4" aria-hidden />
                  Yes, submit
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
