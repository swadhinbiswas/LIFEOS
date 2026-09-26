import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** A list of boards, each with its column count. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-boards">
      <PageHeaderSkeleton title="w-20" control="w-32" />
      <PanelSkeleton label="w-20" hint>
        <ListSkeleton rows={4} />
      </PanelSkeleton>
    </div>
  );
}
