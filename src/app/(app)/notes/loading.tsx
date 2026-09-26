import { PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** The library is a card grid, so the wait is a card grid. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-notes">
      <PageHeaderSkeleton title="w-20" control="w-32" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <PanelSkeleton key={index} label="w-16" rows={2} />
        ))}
      </div>
    </div>
  );
}
