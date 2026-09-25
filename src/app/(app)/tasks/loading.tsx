import { Skeleton } from "@/components/ui/skeleton";

/** Board-shaped loading state: header, toolbar, columns (spec §13 reliability). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" data-slot="loading-board">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-6 w-40" />
      </div>
      <Skeleton className="h-8 w-full max-w-md" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex w-64 shrink-0 flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
