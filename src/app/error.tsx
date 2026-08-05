"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/lib/routes";

/**
 * Application-level error boundary.
 *
 * The user is shown a plain apology and a way forward, never the underlying
 * message — a database or storage error can leak schema details. The digest is
 * surfaced so a student can quote it when they contact the challenge office.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[boundary] unhandled error", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 pt-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              We hit an unexpected problem. Your saved work is safe — try again, and if it keeps
              happening, contact the challenge office.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground">
                Reference code: <code className="font-mono">{error.digest}</code>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={reset} className="flex-1">
              <RotateCw className="size-4" aria-hidden />
              Try again
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href={ROUTES.dashboard}>
                <Home className="size-4" aria-hidden />
                My dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
