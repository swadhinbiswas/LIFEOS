import { Skeleton } from "@/components/ui/skeleton";

/** Board-shaped loading state: a header and a few columns of card tiles (spec §6.1). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" data-slot="loading-board">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-6 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((column) => (
          <div key={column} className="flex flex-col gap-2">
            <Skeleton className="h-5 w-28" />
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-16 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
