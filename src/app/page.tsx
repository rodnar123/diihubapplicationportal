import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileCheck2,
  FileText,
  Lightbulb,
  ShieldCheck,
  Users,
} from "lucide-react";

import { BrandLockup } from "@/components/brand/university-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CHALLENGE_HOST, CHALLENGE_NAME, UNIVERSITY_NAME } from "@/domain/challenge/constants";
import { DEFAULT_APP_SETTINGS } from "@/domain/settings/app-settings";
import { Role } from "@/generated/prisma/enums";
import { getSessionUser } from "@/lib/auth/session";
import { clientEnv } from "@/lib/env";
import { ROUTES } from "@/lib/routes";

const STEPS = [
  {
    icon: ShieldCheck,
    title: "Sign in with your university email",
    body: `Only ${clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN} accounts can apply. We email you a secure link — there is no password to manage.`,
  },
  {
    icon: Users,
    title: "Register your team",
    body: `Name your team, nominate a leader, and add up to ${DEFAULT_APP_SETTINGS["team.maxSize"]} members with their student IDs, sections and roles.`,
  },
  {
    icon: Lightbulb,
    title: "Describe your venture",
    body: "Set out the problem, your tech-driven solution, the prototype you have built, and how it compares to what already exists.",
  },
  {
    icon: FileCheck2,
    title: "Declare and submit",
    body: "Sign the declaration online or upload a signed copy, then submit. You can download a PDF of everything you sent.",
  },
] as const;

const FORM_SECTIONS = [
  {
    title: "Team Information",
    body: "Team name, leader, contact email, and every member's ID, section and role.",
  },
  {
    title: "Venture (Project)",
    body: "Project title, problem statement, tech-driven solution and target beneficiaries.",
  },
  {
    title: "Prototype Details",
    body: "Prototype type, the features it demonstrates, and the tools used to build it.",
  },
  {
    title: "Alternatives vs This Solution",
    body: "Three existing solutions, and why yours is preferred.",
  },
  {
    title: "Impact & Feasibility",
    body: "Value proposition, implementation plan and expected impact.",
  },
  {
    title: "Declaration",
    body: "A signed statement that the proposal and prototype are your team's original work.",
  },
] as const;

export default async function LandingPage() {
  const user = await getSessionUser();
  const primaryHref = user
    ? user.role === Role.STUDENT
      ? ROUTES.dashboard
      : ROUTES.admin
    : ROUTES.signIn;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <BrandLockup />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link href={primaryHref}>
                {user ? "Go to portal" : "Sign in"}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <section className="border-b bg-gradient-to-b from-primary/5 to-transparent">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-3xl space-y-6">
              <Badge variant="secondary" className="gap-1.5">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                {CHALLENGE_HOST}
              </Badge>

              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                {CHALLENGE_NAME} {DEFAULT_APP_SETTINGS["challenge.year"]}
              </h1>

              <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
                Turn a real Papua New Guinean problem into a working prototype. Register your team,
                set out your venture, and submit your application to the {CHALLENGE_HOST} — entirely
                online.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button asChild size="lg">
                  <Link href={primaryHref}>
                    {user ? "Continue my application" : "Start your application"}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Open to enrolled students of {UNIVERSITY_NAME}.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
              <p className="text-pretty text-muted-foreground">
                Four steps from sign-in to submission. Your work is saved as you go, so you can stop
                and come back at any point before you submit.
              </p>
            </div>

            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <Card className="h-full">
                    <CardContent className="space-y-3 pt-2">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <step.icon className="size-4" aria-hidden />
                        </span>
                        <span className="text-xs font-medium tabular-nums text-muted-foreground">
                          Step {index + 1}
                        </span>
                      </div>
                      <h3 className="text-balance font-semibold">{step.title}</h3>
                      <p className="text-pretty text-sm text-muted-foreground">{step.body}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  What the application asks for
                </h2>
                <p className="text-pretty text-muted-foreground">
                  The online form follows the official {CHALLENGE_NAME}{" "}
                  {DEFAULT_APP_SETTINGS["challenge.year"]} application form section by section, so
                  nothing is lost between the paper version and this one.
                </p>
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    You can download a PDF of your completed application at any time after
                    submitting.
                  </span>
                </p>
              </div>

              <ul className="grid gap-4 sm:grid-cols-2">
                {FORM_SECTIONS.map((section) => (
                  <li key={section.title} className="rounded-lg border bg-background p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <ClipboardList className="size-4 text-primary" aria-hidden />
                      {section.title}
                    </h3>
                    <p className="mt-1.5 text-pretty text-sm text-muted-foreground">
                      {section.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <Card className="overflow-hidden">
              <CardContent className="flex flex-col items-start gap-6 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight">Ready to apply?</h2>
                  <p className="text-pretty text-sm text-muted-foreground">
                    Sign in with your{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      @{clientEnv.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN}
                    </code>{" "}
                    account. Personal email accounts are not accepted.
                  </p>
                </div>
                <Button asChild size="lg" className="shrink-0">
                  <Link href={primaryHref}>
                    {user ? "Open the portal" : "Sign in to apply"}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            {CHALLENGE_NAME} · {CHALLENGE_HOST}
          </p>
          <p>{UNIVERSITY_NAME}</p>
        </div>
      </footer>
    </div>
  );
}
