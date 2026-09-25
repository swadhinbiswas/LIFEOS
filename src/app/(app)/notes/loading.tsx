import { Skeleton } from "@/components/ui/skeleton";

/** List-shaped loading state: header, a composer block, then rows. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" data-slot="loading-list">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="ml-auto h-6 w-40" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex flex-col gap-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
