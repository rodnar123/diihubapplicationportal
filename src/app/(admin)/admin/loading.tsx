import { Card, CardContent } from "@/components/ui/card";
import { CardsSkeleton, PageHeaderSkeleton } from "@/components/layout/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <CardsSkeleton count={5} />
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4" aria-busy="true">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
