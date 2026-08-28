"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CloudOff, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AutosaveState } from "./use-step-form";
import { formatDateTime } from "@/lib/format";
import { useExitHref } from "./use-exit-href";

function AutosaveIndicator({ state, savedAt }: { state: AutosaveState; savedAt: Date | null }) {
  const time = savedAt
    ? formatDateTime(savedAt, { hour: "2-digit", minute: "2-digit" })
    : undefined;

  const content = {
    idle: null,
    saving: (
      <>
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Saving…
      </>
    ),
    saved: (
      <>
        <Check className="size-3.5" aria-hidden />
        {time ? `Draft saved at ${time}` : "Draft saved"}
      </>
    ),
    error: (
      <>
        <CloudOff className="size-3.5" aria-hidden />
        Not saved — check your connection
      </>
    ),
    /*
     * Offline is not an error, and saying so matters. The work is safe in this
     * browser and will go up when the connection returns, so the message
     * reassures rather than alarms — telling a student on an intermittent link
     * that their answer "failed" invites them to retype it.
     */
    offline: (
      <>
        <CloudOff className="size-3.5" aria-hidden />
        Saved on this device — will sync when you are back online
      </>
    ),
  }[state];

  if (!content) return <span aria-hidden />;

  return (
    <p
      className={`flex items-center gap-1.5 text-xs ${
        state === "error" ? "text-destructive" : "text-muted-foreground"
      }`}
      // Announce only the states that matter to a screen-reader user.
      aria-live={state === "error" ? "assertive" : "polite"}
    >
      {content}
    </p>
  );
}

/**
 * The bar at the bottom of every wizard step: autosave status on the left,
 * navigation on the right.
 */
export function StepFooter({
  previousHref,
  isSubmitting,
  autosaveState,
  lastSavedAt,
  onSaveAndExit,
  isLastEditableStep = false,
  readOnly = false,
}: {
  previousHref: string | null;
  isSubmitting: boolean;
  autosaveState: AutosaveState;
  lastSavedAt: Date | null;
  onSaveAndExit?: () => void;
  isLastEditableStep?: boolean;
  readOnly?: boolean;
}) {
  const exit = useExitHref();

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        {previousHref ? (
          <Button asChild variant="outline">
            <Link href={previousHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </Link>
          </Button>
        ) : (
          <span />
        )}
        <Button asChild variant="outline">
          <Link href={exit.href}>{exit.label}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t pt-6">
      <AutosaveIndicator state={autosaveState} savedAt={lastSavedAt} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {previousHref ? (
          <Button asChild variant="outline" type="button">
            <Link href={previousHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </Link>
          </Button>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {onSaveAndExit && (
            <Button
              type="button"
              variant="ghost"
              onClick={onSaveAndExit}
              disabled={isSubmitting}
            >
              <Save className="size-4" aria-hidden />
              Save &amp; finish later
            </Button>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              <>
                {isLastEditableStep ? "Save & review" : "Save & continue"}
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
