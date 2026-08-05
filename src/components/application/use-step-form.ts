"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import type { ApplicationDto } from "@/domain/application/types";
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
 * Wiring shared by every step of the wizard.
 *
 * Two save paths run against the same action:
 *   * autosave — debounced, `complete: false`, silent. A student who closes
 *     the tab mid-sentence loses nothing, and a half-filled field does not
 *     provoke a validation error while they are still typing.
 *   * save and continue — `complete: true`, which applies the full rule set
 *     and only navigates once the server has accepted the step.
 *
 * Autosave is suppressed while a real submit is in flight so the two cannot
 * race and write out of order.
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

  const runAutosave = useCallback(async () => {
    if (readOnly || submittingRef.current) return;

    setAutosaveState("saving");
    const result = await action({
      applicationId,
      values: latestValuesRef.current,
      complete: false,
    });

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

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void runAutosave();
      }, AUTOSAVE_DELAY_MS);
    });

    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [form, readOnly, runAutosave]);

  const submit = form.handleSubmit((values) => {
    submittingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setAutosaveState("idle");

    startSubmit(async () => {
      try {
        const result = await action({ applicationId, values: values as Values, complete: true });

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
      if (timerRef.current) clearTimeout(timerRef.current);

      startSubmit(async () => {
        try {
          const result = await action({
            applicationId,
            values: form.getValues(),
            complete: false,
          });

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
    [action, applicationId, form, router],
  );

  return { form, submit, saveAndExit, isSubmitting, autosaveState, lastSavedAt };
}
