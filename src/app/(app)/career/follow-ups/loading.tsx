import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** Overdue above upcoming, which is the order the page renders them in. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-follow-ups">
      <PageHeaderSkeleton title="w-28" control="w-16" />
      <PanelSkeleton label="w-20" hint>
        <ListSkeleton rows={3} />
      </PanelSkeleton>
      <PanelSkeleton label="w-20" hint>
        <ListSkeleton rows={3} />
      </PanelSkeleton>
    </div>
  );
}
