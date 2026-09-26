import { PageHeaderSkeleton, PanelSkeleton, TileSkeleton } from "@/components/tui/skeleton";

/** Goals carry key results, so each card is a small panel rather than a row. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-goals">
      <PageHeaderSkeleton title="w-20" control="w-24" />
      <TileSkeleton count={3} />
      <div className="grid gap-3 sm:grid-cols-2">
        <PanelSkeleton label="w-20" rows={3} />
        <PanelSkeleton label="w-24" rows={3} />
      </div>
    </div>
  );
}
