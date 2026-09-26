import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** Two list-shaped panels: the question bank and the STAR stories. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-prep">
      <PageHeaderSkeleton title="w-32" control="w-20" />
      <PanelSkeleton label="w-28" hint>
        <ListSkeleton rows={5} leading={false} />
      </PanelSkeleton>
      <PanelSkeleton label="w-24" hint>
        <ListSkeleton rows={3} leading={false} />
      </PanelSkeleton>
    </div>
  );
}
