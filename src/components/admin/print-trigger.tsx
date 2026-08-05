"use client";

import { Printer, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Toolbar for the print view — hidden in the printed output itself.
 *
 * The print dialog is not opened automatically: an unexpected modal on page
 * load is disorienting, and a reviewer often wants to read the page first.
 */
export function PrintTrigger() {
  const router = useRouter();

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3 print:hidden">
      <p className="text-sm text-muted-foreground">
        This is a print-ready copy of the application form.
      </p>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <X className="size-4" aria-hidden />
          Close
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
