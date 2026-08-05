import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholders.
 *
 * Shaped like the content they replace so the page does not jump when data
 * arrives, and marked `aria-busy` so a screen reader announces the wait rather
 * than reading a wall of empty boxes.
 */

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <Card aria-busy="true">
      <CardHeader className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </CardHeader>
      <CardContent className="space-y-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex justify-between border-t pt-6">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="rounded-md border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b p-3 last:border-b-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
