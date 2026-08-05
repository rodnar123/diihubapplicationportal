import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

/**
 * Maps a Server Action's field errors back onto the form.
 *
 * The server owns the authoritative rules — uniqueness of a team name, a
 * student already registered elsewhere — so its errors have to land on the
 * exact control that caused them, including inside a field array
 * (`members.2.studentId`). Anything that does not correspond to a control
 * falls back to the form-level `root` error.
 */
export function applyFieldErrors<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  fieldErrors: Record<string, string[]> | undefined,
  fallbackMessage?: string,
): void {
  if (!fieldErrors || Object.keys(fieldErrors).length === 0) {
    if (fallbackMessage) {
      form.setError("root", { type: "server", message: fallbackMessage });
    }
    return;
  }

  const registered = new Set(Object.keys(form.getValues() as Record<string, unknown>));
  let focused = false;

  for (const [path, messages] of Object.entries(fieldErrors)) {
    const message = messages.join(" ");
    const rootKey = path.split(".")[0];

    if (path === "form" || path === "root" || !registered.has(rootKey)) {
      form.setError("root", { type: "server", message });
      continue;
    }

    form.setError(path as Path<TFieldValues>, { type: "server", message }, {
      shouldFocus: !focused,
    });
    focused = true;
  }
}
