import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

/**
 * The audit trail.
 *
 * Read-only by design: entries are never edited or deleted from the UI, which
 * is what makes the log worth having. Paging is by offset because an
 * administrator reads it chronologically rather than searching it.
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every state-changing action taken in the portal, newest first."
        breadcrumbs={[{ label: "Admin", href: ROUTES.admin }, { label: "Audit log" }]}
      />

      <Card>
        <CardContent className="space-y-4">
          {entries.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Nothing recorded yet"
              description="Actions will appear here as people use the portal."
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">When</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Detail</TableHead>
                      <TableHead className="whitespace-nowrap">IP address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="align-top text-xs tabular-nums whitespace-nowrap text-muted-foreground">
                          {entry.createdAt.toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className="font-mono text-xs">
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          <span className="block max-w-40 truncate">
                            {entry.actor?.name ?? "—"}
                          </span>
                          <span className="block max-w-40 truncate text-xs text-muted-foreground">
                            {entry.actorEmail ?? entry.actor?.email ?? ""}
                          </span>
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          <span className="block">{entry.entityType}</span>
                          {entry.entityId && (
                            <span className="block max-w-32 truncate font-mono text-xs text-muted-foreground">
                              {entry.entityId}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-64 align-top">
                          {entry.metadata ? (
                            <code className="block truncate text-xs text-muted-foreground">
                              {JSON.stringify(entry.metadata)}
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top font-mono text-xs whitespace-nowrap text-muted-foreground">
                          {entry.ipAddress ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm tabular-nums text-muted-foreground">
                  Page {page} of {pageCount} · {total} entries
                </p>
                <nav aria-label="Pagination" className="flex gap-2">
                  <Button asChild variant="outline" size="sm" disabled={page <= 1}>
                    <Link href={`${ROUTES.adminAudit}?page=${Math.max(1, page - 1)}`}>
                      Previous
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" disabled={page >= pageCount}>
                    <Link href={`${ROUTES.adminAudit}?page=${Math.min(pageCount, page + 1)}`}>
                      Next
                    </Link>
                  </Button>
                </nav>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
