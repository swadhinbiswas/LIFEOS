import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** The docs index is a list of documents with their kind. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-docs">
      <PageHeaderSkeleton title="w-24" control="w-16" />
      <PanelSkeleton label="w-20" hint>
        <ListSkeleton rows={6} leading={false} />
      </PanelSkeleton>
    </div>
  );
}
