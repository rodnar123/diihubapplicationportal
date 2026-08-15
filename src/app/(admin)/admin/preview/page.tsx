import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StudentDashboardView } from "@/components/dashboard/student-dashboard-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { buildPreviewApplication } from "@/domain/application/preview";
import { APPLICATION_STEPS } from "@/domain/application/steps";
import { requireReviewer } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getAppSettings } from "@/services/settings/settings-service";

import { PreviewBanner } from "./preview-banner";

export const metadata: Metadata = { title: "Student portal preview" };

/**
 * The student portal as staff see it.
 *
 * `requireReviewer` rather than `requireAdmin`: a reviewer who has to judge an
 * entry benefits from knowing what was asked of the applicant, and nothing here
 * exposes anything a reviewer cannot already read.
 */
export default async function PreviewDashboardPage() {
  await requireReviewer();
  const settings = await getAppSettings();
  const application = buildPreviewApplication(settings["challenge.year"]);

  return (
    <>
      <PageHeader
        title="Student portal preview"
        description="What an applicant sees, from their dashboard through every section of the form. Read-only, and backed by a blank entry rather than anyone's real one."
        breadcrumbs={[{ label: "Admin", href: ROUTES.admin }, { label: "Student portal" }]}
      />

      <PreviewBanner />

      <Card>
        <CardHeader>
          <CardTitle>The form, section by section</CardTitle>
          <CardDescription>
            The same wizard students fill in. Every question, in the order it is asked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="grid gap-2 sm:grid-cols-2">
            {APPLICATION_STEPS.map((step, index) => (
              <li key={step.slug}>
                <Link
                  href={ROUTES.adminPreviewStep(step.slug)}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{step.title}</span>
                    {step.formSection && (
                      <span className="block text-xs text-muted-foreground">
                        {step.formSection}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <Button asChild>
            <Link href={ROUTES.adminPreviewStep(APPLICATION_STEPS[0].slug)}>
              Open the form
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/*
        Below this line is the student dashboard itself, rendered by the same
        component the student route uses. `interactive` is off because its
        controls act on an application id, and the preview's stands for no row.
      */}
      <div>
        <p className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          The student dashboard
        </p>
        <StudentDashboardView
          greetingName="Student"
          application={application}
          settings={settings}
          statusHistory={[]}
          sharedComments={[]}
          interactive={false}
          applicationHref={ROUTES.adminPreviewStep(APPLICATION_STEPS[0].slug)}
        />
      </div>
    </>
  );
}
