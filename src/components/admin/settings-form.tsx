"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  APP_SETTING_DESCRIPTIONS,
  MIME_EXTENSIONS,
  type AppSettings,
} from "@/domain/settings/app-settings";
import { updateSettingsAction } from "@/app/(admin)/admin/actions";

/**
 * Runtime configuration.
 *
 * Everything here changes how the student-facing form behaves *right now*, so
 * each control states its consequence rather than just its name — an admin
 * lowering the team maximum should know it does not retroactively break teams
 * that are already larger.
 */

const DECLARATION_OPTIONS = [
  {
    value: "BOTH",
    label: "Let teams choose",
    hint: "Either the electronic declaration or a signed upload.",
  },
  {
    value: "ELECTRONIC",
    label: "Electronic only",
    hint: "Tick-box plus typed full name. Fastest for students.",
  },
  {
    value: "SIGNED_UPLOAD",
    label: "Signed document only",
    hint: "Teams must download, sign by hand, and upload the scan.",
  },
] as const;

/** Converts an ISO instant to the value a `datetime-local` input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<AppSettings>(settings);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [newTheme, setNewTheme] = useState("");

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const errorFor = (key: keyof AppSettings) => fieldErrors[key as string]?.[0];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateSettingsAction(values);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }

      setValues(result.data);
      toast.success("Settings saved.");
      router.refresh();
    });
  };

  const allMimeTypes = Object.keys(MIME_EXTENSIONS);

  return (
    <form onSubmit={submit} className="space-y-8">
      <FieldSet>
        <FieldLegend>Challenge cycle</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="challenge-year">Challenge year</FieldLabel>
            <Input
              id="challenge-year"
              type="number"
              min={2000}
              max={2100}
              className="sm:w-40"
              value={values["challenge.year"]}
              onChange={(event) => set("challenge.year", Number(event.target.value))}
              aria-invalid={Boolean(errorFor("challenge.year")) || undefined}
            />
            <FieldDescription>
              {APP_SETTING_DESCRIPTIONS["challenge.year"]} Changing this starts a new cycle —
              existing applications stay on their original year.
            </FieldDescription>
            {errorFor("challenge.year") && <FieldError>{errorFor("challenge.year")}</FieldError>}
          </Field>

          <Field>
            <FieldLabel>Themes</FieldLabel>
            <FieldDescription>{APP_SETTING_DESCRIPTIONS["challenge.themes"]}</FieldDescription>

            <ul className="space-y-2">
              {values["challenge.themes"].map((theme, index) => (
                <li key={`${theme}-${index}`} className="flex items-center gap-2">
                  <Input
                    value={theme}
                    aria-label={`Theme ${index + 1}`}
                    onChange={(event) => {
                      const next = [...values["challenge.themes"]];
                      next[index] = event.target.value;
                      set("challenge.themes", next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={values["challenge.themes"].length <= 1}
                    onClick={() =>
                      set(
                        "challenge.themes",
                        values["challenge.themes"].filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">Remove theme {index + 1}</span>
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 pt-1">
              <Input
                value={newTheme}
                onChange={(event) => setNewTheme(event.target.value)}
                placeholder="Add a theme…"
                aria-label="New theme"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (newTheme.trim()) {
                      set("challenge.themes", [...values["challenge.themes"], newTheme.trim()]);
                      setNewTheme("");
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={!newTheme.trim()}
                onClick={() => {
                  set("challenge.themes", [...values["challenge.themes"], newTheme.trim()]);
                  setNewTheme("");
                }}
              >
                <Plus className="size-4" aria-hidden />
                Add
              </Button>
            </div>
            {errorFor("challenge.themes") && (
              <FieldError>{errorFor("challenge.themes")}</FieldError>
            )}
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Teams</FieldLegend>
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="team-min">Minimum team size</FieldLabel>
              <Input
                id="team-min"
                type="number"
                min={1}
                max={50}
                value={values["team.minSize"]}
                onChange={(event) => set("team.minSize", Number(event.target.value))}
                aria-invalid={Boolean(errorFor("team.minSize")) || undefined}
              />
              <FieldDescription>{APP_SETTING_DESCRIPTIONS["team.minSize"]}</FieldDescription>
              {errorFor("team.minSize") && <FieldError>{errorFor("team.minSize")}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="team-max">Maximum team size</FieldLabel>
              <Input
                id="team-max"
                type="number"
                min={1}
                max={50}
                value={values["team.maxSize"]}
                onChange={(event) => set("team.maxSize", Number(event.target.value))}
                aria-invalid={Boolean(errorFor("team.maxSize")) || undefined}
              />
              <FieldDescription>
                {APP_SETTING_DESCRIPTIONS["team.maxSize"]} The printed form provides seven rows.
              </FieldDescription>
              {errorFor("team.maxSize") && <FieldError>{errorFor("team.maxSize")}</FieldError>}
            </Field>
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Uploads</FieldLegend>
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="upload-size">Maximum file size (MB)</FieldLabel>
              <Input
                id="upload-size"
                type="number"
                min={1}
                max={100}
                value={values["uploads.maxFileSizeMb"]}
                onChange={(event) => set("uploads.maxFileSizeMb", Number(event.target.value))}
              />
              <FieldDescription>
                {APP_SETTING_DESCRIPTIONS["uploads.maxFileSizeMb"]}
              </FieldDescription>
              {errorFor("uploads.maxFileSizeMb") && (
                <FieldError>{errorFor("uploads.maxFileSizeMb")}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="upload-count">Maximum files per application</FieldLabel>
              <Input
                id="upload-count"
                type="number"
                min={1}
                max={50}
                value={values["uploads.maxFilesPerApplication"]}
                onChange={(event) =>
                  set("uploads.maxFilesPerApplication", Number(event.target.value))
                }
              />
              <FieldDescription>
                {APP_SETTING_DESCRIPTIONS["uploads.maxFilesPerApplication"]}
              </FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel>Accepted file types</FieldLabel>
            <FieldDescription>
              {APP_SETTING_DESCRIPTIONS["uploads.allowedMimeTypes"]} Uploads are also checked
              against the file&rsquo;s actual signature, not just its extension.
            </FieldDescription>
            <div className="grid gap-2 sm:grid-cols-2">
              {allMimeTypes.map((mime) => {
                const checked = values["uploads.allowedMimeTypes"].includes(mime);
                return (
                  <FieldLabel
                    key={mime}
                    className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        set(
                          "uploads.allowedMimeTypes",
                          next === true
                            ? [...values["uploads.allowedMimeTypes"], mime]
                            : values["uploads.allowedMimeTypes"].filter((entry) => entry !== mime),
                        )
                      }
                    />
                    <span>
                      {MIME_EXTENSIONS[mime].join(", ")}
                      <span className="ml-1 text-xs text-muted-foreground">({mime})</span>
                    </span>
                  </FieldLabel>
                );
              })}
            </div>
            {errorFor("uploads.allowedMimeTypes") && (
              <FieldError>{errorFor("uploads.allowedMimeTypes")}</FieldError>
            )}
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Declaration</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldDescription>{APP_SETTING_DESCRIPTIONS["declaration.mode"]}</FieldDescription>
            <RadioGroup
              value={values["declaration.mode"]}
              onValueChange={(value) =>
                set("declaration.mode", value as AppSettings["declaration.mode"])
              }
              className="gap-3"
            >
              {DECLARATION_OPTIONS.map((option) => (
                <FieldLabel key={option.value} htmlFor={`declaration-${option.value}`}>
                  <Field orientation="horizontal">
                    <RadioGroupItem value={option.value} id={`declaration-${option.value}`} />
                    <FieldContent>
                      <span className="text-sm font-medium">{option.label}</span>
                      <FieldDescription>{option.hint}</FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Submission window</FieldLegend>
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="opens-at">Opens at</FieldLabel>
              <Input
                id="opens-at"
                type="datetime-local"
                value={toLocalInput(values["submission.opensAt"])}
                onChange={(event) =>
                  set("submission.opensAt", fromLocalInput(event.target.value))
                }
              />
              <FieldDescription>{APP_SETTING_DESCRIPTIONS["submission.opensAt"]}</FieldDescription>
              {errorFor("submission.opensAt") && (
                <FieldError>{errorFor("submission.opensAt")}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="closes-at">Closes at</FieldLabel>
              <Input
                id="closes-at"
                type="datetime-local"
                value={toLocalInput(values["submission.closesAt"])}
                onChange={(event) =>
                  set("submission.closesAt", fromLocalInput(event.target.value))
                }
              />
              <FieldDescription>{APP_SETTING_DESCRIPTIONS["submission.closesAt"]}</FieldDescription>
              {errorFor("submission.closesAt") && (
                <FieldError>{errorFor("submission.closesAt")}</FieldError>
              )}
            </Field>
          </div>

          <Field orientation="horizontal">
            <Checkbox
              id="allow-withdraw"
              checked={values["submission.allowWithdraw"]}
              onCheckedChange={(checked) => set("submission.allowWithdraw", checked === true)}
            />
            <FieldContent>
              <FieldLabel htmlFor="allow-withdraw">Allow teams to withdraw</FieldLabel>
              <FieldDescription>
                {APP_SETTING_DESCRIPTIONS["submission.allowWithdraw"]}
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
      </FieldSet>

      {fieldErrors.settings && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Some settings could not be saved</AlertTitle>
          <AlertDescription>{fieldErrors.settings.join(" ")}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3 border-t pt-6">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            <>
              <Save className="size-4" aria-hidden />
              Save settings
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            setValues(settings);
            setFieldErrors({});
          }}
        >
          Discard changes
        </Button>
      </div>
    </form>
  );
}
