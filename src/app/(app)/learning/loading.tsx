import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** Two list panels: what is being studied, and what is being read. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-learning">
      <PageHeaderSkeleton title="w-24" control="w-20" />
      <PanelSkeleton label="w-20" hint>
        <ListSkeleton rows={3} />
      </PanelSkeleton>
      <PanelSkeleton label="w-16" hint>
        <ListSkeleton rows={3} leading={false} />
      </PanelSkeleton>
    </div>
  );
}
