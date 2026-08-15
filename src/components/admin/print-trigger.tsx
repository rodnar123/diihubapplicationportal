"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Toolbar for the print view — hidden in the printed output itself.
 *
 * The print dialog is not opened automatically: an unexpected modal on page
 * load is disorienting, and a reviewer often wants to read the page first.
 */
export function PrintTrigger({ backHref }: { backHref: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3 print:hidden">
      <p className="text-sm text-muted-foreground">
        This is a print-ready copy of the application form.
      </p>

      <div className="flex items-center gap-2">
        {/*
          A link, not `router.back()`.

          This view is only ever reached through a `target="_blank"` link, so
          the tab it lives in has no history entry before it — `back()` had
          nothing to go back to and did nothing at all, which is why the
          button looked dead.

          `window.close()` is not the answer either: the tab was opened by a
          link rather than by script, so the browser refuses to close it and
          logs a warning. Navigating to the application always works, and the
          label now says what actually happens rather than promising to close
          a tab we cannot close.
        */}
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>
            <ArrowLeft className="size-4" aria-hidden />
            Back to application
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Print
        </Button>
      </div>
    </div>
  );
}

/** Linkable variant used from the detail page's action bar. */
export function PrintLink({ href }: { href: string }) {
  return (
    <Button asChild variant="outline">
      <Link href={href} target="_blank" rel="noopener">
        <Printer className="size-4" aria-hidden />
        Print
      </Link>
    </Button>
  );
}
