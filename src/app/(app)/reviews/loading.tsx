import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** One panel per period, newest first. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-reviews">
      <PageHeaderSkeleton title="w-24" control="w-24" />
      <PanelSkeleton label="w-28" hint>
        <ListSkeleton rows={3} leading={false} />
      </PanelSkeleton>
    </div>
  );
}
