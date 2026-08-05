import { Card, CardContent } from "@/components/ui/card";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/layout/page-skeleton";

export default function AdminApplicationsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <Card>
        <CardContent>
          <TableSkeleton />
        </CardContent>
      </Card>
    </>
  );
}
