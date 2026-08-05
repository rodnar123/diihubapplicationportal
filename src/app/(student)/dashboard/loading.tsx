import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/layout/page-skeleton";

export default function DashboardLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-6" aria-busy="true">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-2 w-full" />
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
            <Skeleton className="h-10 w-52" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4" aria-busy="true">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
