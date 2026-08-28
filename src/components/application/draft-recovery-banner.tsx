"use client";

import { CloudOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

/**
 * Offers back work that never reached the server.
 *
 * Two buttons and no default action, deliberately. The cache cannot tell newer
 * work that failed to send from older work the student has since replaced from
 * another device — only they know which, so restoring automatically would
 * sometimes overwrite the good copy with the stale one. A prompt is slower and
 * correct; silence is faster and occasionally destroys an answer.
 *
 * The wording avoids "unsaved changes", which reads as a warning about
 * something the student did wrong. This is the portal reporting its own
 * failure to deliver.
 */
export function DraftRecoveryBanner({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: Date;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <Alert>
      <CloudOff className="size-4" aria-hidden="true" />
      <AlertTitle>There is newer text saved on this device</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>
          Some of what you typed at{" "}
          {formatDateTime(savedAt, { hour: "2-digit", minute: "2-digit" })} never reached the
          server — most likely the connection dropped. It is still here. Restore it, or
          continue with the version the server has.
        </span>

        <span className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onRestore}>
            Restore what I typed
          </Button>
          <Button size="sm" variant="outline" onClick={onDiscard}>
            Keep the saved version
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}
