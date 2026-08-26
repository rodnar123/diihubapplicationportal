import type { Metadata } from "next";
import { Suspense } from "react";

import { UserFilters } from "@/components/admin/user-filters";
import { UsersTable } from "@/components/admin/users-table";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { parseUserQuery } from "@/domain/admin/user-query";
import { requireAdmin } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { findUsers } from "@/services/admin/user-admin";

export const metadata: Metadata = { title: "Users" };

/**
 * The user directory.
 *
 * Administrators only — this page decides who may sign in and what they may do
 * once they have, which is a strictly larger authority than reviewing entries.
 * `requireAdmin` redirects a reviewer who reaches the URL directly; the layout
 * above has already established that they are at least a reviewer.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();

  const raw = await searchParams;
  const query = parseUserQuery(raw);
  const result = await findUsers(query);

  return (
    <>
      <PageHeader
        title="Users"
        description="Who can sign in, and what they can do once they have."
        breadcrumbs={[{ label: "Admin", href: ROUTES.admin }, { label: "Users" }]}
      />

      {result.activeAdminCount <= 1 && (
        <Alert>
          <AlertTitle>There is only one administrator</AlertTitle>
          <AlertDescription>
            Nobody can change their own role, so if this account is lost the portal has no
            way back to its settings, audit log or this page. Promote a second
            administrator while you can.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-6">
          <Suspense fallback={<Skeleton className="h-20 w-full" />}>
            <UserFilters totalResults={result.total} />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <UsersTable
              rows={result.rows}
              currentUserId={admin.id}
              activeAdminCount={result.activeAdminCount}
              page={result.page}
              pageCount={result.pageCount}
              pageSize={result.pageSize}
              total={result.total}
            />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}
