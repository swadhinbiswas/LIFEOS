import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** Trash is a list with a restore action per row. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-trash">
      <PageHeaderSkeleton title="w-16" control="w-16" />
      <PanelSkeleton label="w-20" hint>
        <ListSkeleton rows={5} />
      </PanelSkeleton>
    </div>
  );
}
