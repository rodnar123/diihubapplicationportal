import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";

import { BrandLockup } from "@/components/brand/university-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

export default async function AccessDeniedPage() {
  const user = await getSessionUser();

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
            <div className="flex size-12 items-center justify-center rounded-full bg-warning/15 text-warning">
              <Lock className="size-6" aria-hidden />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">You don&rsquo;t have access to this area</h1>
              <p className="text-sm text-muted-foreground">
                {user
                  ? `You are signed in as ${user.email}, which does not have permission to view this page.`
                  : "You need to sign in with an account that has permission to view this page."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href={user ? ROUTES.dashboard : ROUTES.signIn}>
                  {user ? "Go to my dashboard" : "Sign in"}
                </Link>
              </Button>
              {user && <SignOutButton variant="outline" className="w-full" />}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
