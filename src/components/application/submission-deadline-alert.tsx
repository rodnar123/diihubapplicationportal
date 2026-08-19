import { CalendarClock, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  describeTimeRemaining,
  submissionDeadline,
  submissionWindow,
  type AppSettings,
} from "@/domain/settings/app-settings";
import { formatDateTime } from "@/lib/format";

/**
 * The closing date, told to the student while they can still do something
 * about it.
 *
 * `submission.closesAt` used to be visible to admins only: the student side
 * consulted it to *refuse* a late submission and to explain a window that had
 * already shut, but never to warn that one was about to. A team's first sight
 * of the deadline was the message saying they had missed it.
 *
 * Two tones, because a deadline three months out and a deadline tomorrow are
 * not the same message. Outside the last `submission.closingSoonDays` days
 * this is a quiet line of fact; inside them it turns amber.
 *
 * Renders nothing when there is no closing date, when the window is shut (the
 * callers already say so, and saying it twice helps nobody), or when the
 * student can no longer edit — a submitted entry is not waiting on a deadline.
 */
export function SubmissionDeadlineAlert({
  settings,
  editable = true,
}: {
  settings: AppSettings;
  /** Off once the entry has left the student's hands. */
  editable?: boolean;
}) {
  if (!editable) return null;

  const window = submissionWindow(settings);
  if (!window.open) return null;

  const deadline = submissionDeadline(settings);
  if (!deadline) return null;

  const closesAtLabel = formatDateTime(deadline.closesAt);

  if (!deadline.closingSoon) {
    return (
      <Alert>
        <CalendarClock className="size-4" aria-hidden />
        <AlertTitle>Submissions close on {closesAtLabel}</AlertTitle>
        <AlertDescription>
          Your entry has to be submitted by then — saving it is not the same as submitting it.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="warning">
      <TriangleAlert className="size-4" aria-hidden />
      <AlertTitle>Submissions close {describeTimeRemaining(deadline)}</AlertTitle>
      <AlertDescription>
        The deadline is {closesAtLabel}. Saving your work is not the same as submitting it — an
        entry still in progress when the window closes cannot be entered.
      </AlertDescription>
    </Alert>
  );
}
