import { PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** Portfolio is a grid of work samples, so the wait is a grid too. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-portfolio">
      <PageHeaderSkeleton title="w-28" control="w-24" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <PanelSkeleton key={index} label="w-16" rows={2} />
        ))}
      </div>
    </div>
  );
}
