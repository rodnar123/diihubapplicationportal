import { formatDistanceToNow } from "date-fns";

import { StatusBadge } from "@/components/application/status-badge";
import { formatDateTime } from "@/lib/format";
import type { ApplicationStatus } from "@/generated/prisma/enums";

export interface TimelineEvent {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

/**
 * The application's history, newest first. Each entry says what changed, who
 * changed it and why — which is what a student asks when a status moves.
 */
export function StatusTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>;
  }

  return (
    <ol className="space-y-5">
      {events.map((event, index) => {
        const timestamp = new Date(event.createdAt);

        return (
          <li key={event.id} className="relative flex gap-4 pb-1">
            {/* Connector line between entries. */}
            {index < events.length - 1 && (
              <span
                className="absolute top-6 left-[7px] h-full w-px bg-border"
                aria-hidden
              />
            )}

            <span
              className="mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-background bg-muted-foreground/40 ring-1 ring-border"
              aria-hidden
            />

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={event.toStatus} />
                <time
                  dateTime={event.createdAt}
                  title={formatDateTime(timestamp)}
                  className="text-xs text-muted-foreground"
                >
                  {formatDistanceToNow(timestamp, { addSuffix: true })}
                </time>
              </div>

              {event.note && <p className="text-pretty text-sm">{event.note}</p>}

              {event.actorName && (
                <p className="text-xs text-muted-foreground">by {event.actorName}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
