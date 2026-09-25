import { Skeleton } from "@/components/ui/skeleton";

/** Finance-shaped loading state: header, chart card, then stat/row cards. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" data-slot="loading-finance">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-6 w-32" />
      </div>
      <Skeleton className="h-48 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
