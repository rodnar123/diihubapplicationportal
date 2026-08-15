"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import type { ApplicationDto } from "@/domain/application/types";
import { callAction } from "@/lib/client-action";
import { applyFieldErrors } from "@/lib/form-errors";
import type { ActionResult } from "@/lib/errors";

/**
 * Every step action has this shape. `values` is `unknown` on purpose: the
 * server re-parses whatever arrives, so the client's type is a convenience
 * rather than a guarantee.
 */
export type SaveStepAction = (input: {
  applicationId: string;
  values: unknown;
  complete: boolean;
}) => Promise<ActionResult<ApplicationDto>>;

export type AutosaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 1500;

/**
 * Ceiling on how long unsaved work may sit while the student keeps typing.
 *
 * A plain debounce is reset by every keystroke, so someone composing a long
 * answer without a 1.5s pause never triggers a save at all. These fields ask
 * for up to 3000 characters; that is a lot of work to be holding in the tab
 * alone.
 */
const AUTOSAVE_MAX_WAIT_MS = 8000;

/**
 * Wiring shared by every step of the wizard.
 *
 * Two save paths run against the same action:
 *   * autosave — debounced, `complete: false`, silent, so a half-filled field
 *     does not provoke a validation error while the student is still typing.
 *   * save and continue — `complete: true`, which applies the full rule set
 *     and only navigates once the server has accepted the step.
 *
 * Autosave is suppressed while a real submit is in flight so the two cannot
 * race and write out of order, is bounded by {@link AUTOSAVE_MAX_WAIT_MS}, and
 * is flushed when the step unmounts — the wizard's "Back" is an ordinary link,
 * so without that flush every edit since the last pause was dropped on the way
 * out.
 */
export function useStepForm<TValues extends FieldValues>({
  schema,
  defaultValues,
  applicationId,
  action,
  nextHref,
  readOnly = false,
}: {
  schema: z.ZodType<FieldValues, FieldValues>;
  defaultValues: DefaultValues<TValues>;
  applicationId: string;
  action: SaveStepAction;
  nextHref: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [isSubmitting, startSubmit] = useTransition();
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  type Values = TValues;

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const submittingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValuesRef = useRef<Values>(defaultValues as Values);
  /** When the oldest currently-unsaved change was made. */
  const pendingSinceRef = useRef<number | null>(null);

  const runAutosave = useCallback(async () => {
    if (readOnly || submittingRef.current) return;

    timerRef.current = null;
    pendingSinceRef.current = null;
    setAutosaveState("saving");
    const result = await callAction(() =>
      action({
        applicationId,
        values: latestValuesRef.current,
        complete: false,
      }),
    );

    if (submittingRef.current) return;

    if (result.ok) {
      setAutosaveState("saved");
      setLastSavedAt(new Date());
    } else {
      // A draft save that fails is worth surfacing quietly — it usually means
      // the session expired or the application is no longer editable.
      setAutosaveState("error");
      if (result.code === "UNAUTHENTICATED" || result.code === "INVALID_STATE") {
        toast.error(result.message);
        router.refresh();
      }
    }
  }, [action, applicationId, readOnly, router]);

  // Debounced autosave on every change the student makes.
  useEffect(() => {
    if (readOnly) return;

    const subscription = form.watch((values, { type }) => {
      // `type` is undefined for programmatic resets, which must not autosave.
      if (!type) return;

      latestValuesRef.current = values as Values;
      pendingSinceRef.current ??= Date.now();

      if (timerRef.current) clearTimeout(timerRef.current);

      // Normally 1.5s after the last keystroke, but never more than
      // AUTOSAVE_MAX_WAIT_MS after the first unsaved one, so that continuous
      // typing cannot hold the whole answer in the tab indefinitely.
      const waited = Date.now() - pendingSinceRef.current;
      const delay = Math.max(0, Math.min(AUTOSAVE_DELAY_MS, AUTOSAVE_MAX_WAIT_MS - waited));

      timerRef.current = setTimeout(() => {
        void runAutosave();
      }, delay);
    });

    return () => {
      subscription.unsubscribe();

      // Flush rather than discard. This cleanup runs when the student leaves
      // the step, and "Back" is a plain link — clearing the timer here is what
      // silently threw away everything typed since the last pause.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void runAutosave();
      }
    };
  }, [form, readOnly, runAutosave]);

  /**
   * Cancels any queued autosave outright.
   *
   * The ref has to be nulled, not just cleared: the unmount flush keys off it,
   * and a submit that navigates would otherwise unmount with a stale handle
   * still set and fire a draft save *after* the real one — writing the client's
   * values back over whatever the server normalised.
   */
  const cancelPendingAutosave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingSinceRef.current = null;
  }, []);

  const submit = form.handleSubmit((values) => {
    submittingRef.current = true;
    cancelPendingAutosave();
    setAutosaveState("idle");

    startSubmit(async () => {
      try {
        const result = await callAction(() =>
          action({ applicationId, values: values as Values, complete: true }),
        );

        if (!result.ok) {
          applyFieldErrors(form, result.fieldErrors, result.message);
          toast.error(result.message);
          return;
        }

        setLastSavedAt(new Date());
        setAutosaveState("saved");
        form.reset(values, { keepValues: true, keepDirty: false });

        if (nextHref) {
          router.push(nextHref);
        } else {
          router.refresh();
        }
      } finally {
        submittingRef.current = false;
      }
    });
  });

  /** "Save and come back later" — persists without demanding completeness. */
  const saveAndExit = useCallback(
    (exitHref: string) => {
      submittingRef.current = true;
      cancelPendingAutosave();

      startSubmit(async () => {
        try {
          const result = await callAction(() =>
            action({
              applicationId,
              values: form.getValues(),
              complete: false,
            }),
          );

          if (!result.ok) {
            applyFieldErrors(form, result.fieldErrors, result.message);
            toast.error(result.message);
            return;
          }

          toast.success("Your progress has been saved.");
          router.push(exitHref);
        } finally {
          submittingRef.current = false;
        }
      });
    },
    [action, applicationId, cancelPendingAutosave, form, router],
  );

  return { form, submit, saveAndExit, isSubmitting, autosaveState, lastSavedAt };
}
