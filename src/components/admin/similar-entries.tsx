import Link from "next/link";
import { Copy } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/routes";
import type { SimilarPair } from "@/services/admin/similarity-service";

/**
 * Entries whose narrative closely resembles this one.
 *
 * The copy matters as much as the list. This is a prompt to read two entries
 * side by side, not a finding — trigram similarity cannot tell a shared theme
 * from a shared author, and a panel that reads a percentage as a verdict will
 * reach the wrong one. Hence "worth comparing" rather than any word implying
 * the system has concluded something.
 *
 * Renders nothing when there is nothing to say, rather than an empty card: a
 * permanent "no matches" panel trains reviewers to stop looking at this corner
 * of the page, which is exactly where the flag needs to be seen.
 */
export function SimilarEntries({ pairs }: { pairs: SimilarPair[] }) {
  if (pairs.length === 0) return null;

  return (
    <Card className="border-warning/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Copy className="size-4" aria-hidden="true" />
          Worth comparing
        </CardTitle>
        <CardDescription>
          {pairs.length === 1 ? "Another entry" : `${pairs.length} other entries`} in this cycle
          use closely similar wording. Teams given the same themes often converge on the same
          idea — read them side by side before drawing any conclusion.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="flex flex-col gap-2">
          {pairs.map((pair) => (
            <li
              key={pair.applicationId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
            >
              <div className="min-w-0">
                <Link
                  href={ROUTES.adminApplication(pair.applicationId)}
                  className="font-medium hover:underline"
                >
                  {pair.projectTitle ?? "Untitled venture"}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {pair.referenceNumber && (
                    <span className="font-mono text-xs">{pair.referenceNumber}</span>
                  )}
                  {pair.referenceNumber && pair.teamName && " · "}
                  {pair.teamName && `Team ${pair.teamName}`}
                </p>
              </div>

              <div className="text-right">
                <div className="font-mono text-sm tabular-nums">
                  {Math.round(pair.similarity * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">{pair.field}</div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
