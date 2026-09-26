import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** The API reference is a list of operations, each with a method badge. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-api">
      <PageHeaderSkeleton title="w-32" control="w-24" />
      <PanelSkeleton label="w-16" hint>
        <ListSkeleton rows={8} />
      </PanelSkeleton>
    </div>
  );
}
