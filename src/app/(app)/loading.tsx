import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading state (spec §13 reliability): the shell stays, the page shows its shape, so a
 * slow query never looks like a dead screen.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" data-slot="loading">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="ml-auto h-6 w-48" />
      </div>
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
