import type { Metadata } from "next";

import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getAppSettings } from "@/services/settings/settings-service";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getAppSettings();

  return (
    <>
      <PageHeader
        title="Portal settings"
        description="These take effect immediately for every student using the form."
        breadcrumbs={[{ label: "Admin", href: ROUTES.admin }, { label: "Settings" }]}
      />

      <Card>
        <CardContent>
          <SettingsForm settings={settings} />
        </CardContent>
      </Card>
    </>
  );
}
