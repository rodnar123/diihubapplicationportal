import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLockup } from "@/components/brand/university-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { givenNameFromEmail, studentIdFromEmail } from "@/domain/identity/email";
import { Role } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getSchoolsWithSections } from "@/services/reference/reference-data";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Complete your profile",
};

export default async function OnboardingPage() {
  const user = await requireUser();

  // Staff have no student profile to complete.
  if (user.role !== Role.STUDENT) redirect(ROUTES.admin);

  const schools = await getSchoolsWithSections();
  const profile = user.profile;
  const isEditing = Boolean(profile?.isComplete);

  // `provisionUser` seeds a placeholder ID when the address does not follow the
  // `<studentId><name>@…` convention; never show that to the student.
  const seededStudentId = profile?.studentId.startsWith("PENDING-")
    ? (studentIdFromEmail(user.email) ?? "")
    : (profile?.studentId ?? "");

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link
          href={ROUTES.home}
          className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <BrandLockup />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton variant="ghost" size="sm" />
        </div>
      </header>

      <main id="main-content" className="flex flex-1 justify-center px-5 py-6 sm:px-8 sm:py-10">
        <div className="w-full max-w-2xl">
          {/*
            Same surface as the auth cards, at the wider gutter the form's
            two-column rows need. The shared `Card` default (16px) puts the
            inputs almost against the card edge.
          */}
          <Card className="[--card-spacing:--spacing(6)] rounded-2xl shadow-lg shadow-black/5 ring-foreground/10 sm:[--card-spacing:--spacing(8)] dark:shadow-black/40 dark:ring-white/10">
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
                {isEditing ? "Your details" : "Complete your profile"}
              </CardTitle>
              <CardDescription className="text-pretty leading-relaxed">
                {isEditing
                  ? "These details appear on every application you file."
                  : "We need a few details before you can start an application. They will pre-fill Section A of your entry, and you can change them later."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <OnboardingForm
                schools={schools}
                email={user.email}
                isEditing={isEditing}
                defaultValues={{
                  studentId: seededStudentId,
                  firstName: profile?.firstName || (givenNameFromEmail(user.email) ?? ""),
                  surname: profile?.surname ?? "",
                  phone: profile?.phone ?? "",
                  schoolId: profile?.schoolId ?? "",
                  sectionId: profile?.sectionId ?? "",
                  program: profile?.program ?? "",
                  yearLevel: profile?.yearLevel ?? undefined,
                }}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
