import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

import { BrandLockup } from "@/components/brand/university-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="px-4 py-4 sm:px-6">
        <Link
          href={ROUTES.home}
          className="inline-block rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <BrandLockup />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-6 pt-2">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileQuestion className="size-6" aria-hidden />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
              <p className="text-sm text-muted-foreground">
                That page doesn&rsquo;t exist, or you don&rsquo;t have access to it.
              </p>
            </div>

            <Button asChild className="w-full">
              <Link href={ROUTES.home}>
                <Home className="size-4" aria-hidden />
                Back to the portal
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
