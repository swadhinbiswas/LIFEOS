import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** A header, then one panel of people — the order the page renders them in. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-contacts">
      <PageHeaderSkeleton title="w-28" control="w-24" />
      <PanelSkeleton label="w-32" hint>
        <ListSkeleton rows={5} />
      </PanelSkeleton>
    </div>
  );
}
