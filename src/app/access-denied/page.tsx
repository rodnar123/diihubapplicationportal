import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";

import { AuthCard, AuthCardHeading } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

export default async function AccessDeniedPage() {
  const user = await getSessionUser();

  return (
    <AuthShell>
      <AuthCard>
        <div className="space-y-6">
          <AuthCardHeading icon={Lock} title="You don't have access to this area" tone="warning">
            {user
              ? `You are signed in as ${user.email}, which does not have permission to view this page.`
              : "You need to sign in with an account that has permission to view this page."}
          </AuthCardHeading>

          <div className="flex flex-col gap-2">
            <Button
              asChild
              className="btn-brand h-11 w-full rounded-xl text-[0.9375rem] font-semibold"
            >
              <Link href={user ? ROUTES.dashboard : ROUTES.signIn}>
                {user ? "Go to my dashboard" : "Sign in"}
              </Link>
            </Button>
            {user && (
              <SignOutButton variant="outline" className="h-11 w-full rounded-xl text-sm" />
            )}
          </div>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
