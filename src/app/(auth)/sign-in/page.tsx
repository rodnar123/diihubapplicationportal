import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to the PNGUoT Student Challenge Application Portal with your official university email account.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <Card className="print-surface">
      <CardContent className="pt-2">
        <SignInForm nextPath={safeNext} />
      </CardContent>
    </Card>
  );
}
