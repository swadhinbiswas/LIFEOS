import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** Plan cards above the current-subscription facts. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-billing">
      <PageHeaderSkeleton title="w-20" control="w-16" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <PanelSkeleton key={index} label="w-14" rows={3} />
        ))}
      </div>
      <PanelSkeleton label="w-24" hint>
        <ListSkeleton rows={3} leading={false} />
      </PanelSkeleton>
    </div>
  );
}
