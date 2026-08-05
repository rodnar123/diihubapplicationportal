import { cn } from "@/lib/utils";

/**
 * Renders a stored narrative answer.
 *
 * The HTML passed here has already been through `sanitizeRichText` on write,
 * so `dangerouslySetInnerHTML` is safe — but only because that is the *only*
 * way rich text enters the database. If a new write path is added, it has to
 * sanitise too.
 */
export function RichTextView({
  html,
  className,
  emptyLabel = "Not provided",
}: {
  html: string | null | undefined;
  className?: string;
  emptyLabel?: string;
}) {
  if (!html) {
    return <p className={cn("text-sm text-muted-foreground italic", className)}>{emptyLabel}</p>;
  }

  return (
    <div
      className={cn("rich-text-content", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
