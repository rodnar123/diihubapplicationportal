import type { Metadata } from "next";
import { Suspense } from "react";
import { Download, FileText } from "lucide-react";

import { ApplicationFilters } from "@/components/admin/application-filters";
import { ApplicationsTable } from "@/components/admin/applications-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildApplicationQueryString,
  parseApplicationQuery,
} from "@/domain/admin/application-query";
import { isAdmin, requireReviewer } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { findApplications } from "@/services/admin/application-query";
import { getSchoolsWithSections } from "@/services/reference/reference-data";

export const metadata: Metadata = { title: "Applications" };

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireReviewer();
  const canManage = isAdmin(viewer.role);

  const raw = await searchParams;
  const parsed = parseApplicationQuery(raw);

  /*
   * The recycle bin is an administrator's view. `?deleted=1` is just a URL, so
   * the flag is reset here rather than trusted — a reviewer who tries it gets
   * the normal list, not an error, because there is nothing to accuse them of.
   */
  const query = canManage ? parsed : { ...parsed, deleted: false };

  const [result, schools] = await Promise.all([
    findApplications(query),
    getSchoolsWithSections(),
  ]);

  // Exports honour whatever the reviewer is currently looking at.
  const exportQuery = buildApplicationQueryString(query, { page: 1 });

  return (
    <>
      <PageHeader
        title={query.deleted ? "Deleted applications" : "Applications"}
        description={
          query.deleted
            ? "Entries an administrator has removed. Nothing here is erased — restore any of them to put it back in the console."
            : "Search, filter and review every entry submitted to the challenge."
        }
        breadcrumbs={[{ label: "Admin", href: ROUTES.admin }, { label: "Applications" }]}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`${ROUTES.adminExportCsv}${exportQuery}`} download>
                <Download className="size-4" aria-hidden />
                Export CSV
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`${ROUTES.adminExportPdf}${exportQuery}`} download>
                <FileText className="size-4" aria-hidden />
                Export PDFs
              </a>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-6">
          <Suspense fallback={<Skeleton className="h-20 w-full" />}>
            <ApplicationFilters
              schools={schools}
              totalResults={result.total}
              canViewDeleted={canManage}
            />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <ApplicationsTable
              rows={result.rows}
              page={result.page}
              pageCount={result.pageCount}
              pageSize={result.pageSize}
              total={result.total}
              sort={query.sort}
              direction={query.dir}
              canDelete={canManage}
              showingDeleted={query.deleted}
            />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}
