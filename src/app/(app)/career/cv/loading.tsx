import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** A list of CV variants with their scores. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-cvs">
      <PageHeaderSkeleton title="w-16" control="w-24" />
      <PanelSkeleton label="w-20" hint>
        <ListSkeleton rows={3} />
      </PanelSkeleton>
    </div>
  );
}
