import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/tui/skeleton";

/** A month is a grid of days, so the skeleton is a grid of cells. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-calendar">
      <PageHeaderSkeleton title="w-32" control="w-48" />
      {/* A real month is a 7-column grid, and 35 cells covers a 5-week span — so the skeleton has
          the same footprint the page will and the axis does not jump when the data lands. */}
      <div className="grid grid-cols-7 gap-1" role="presentation">
        {Array.from({ length: 35 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
