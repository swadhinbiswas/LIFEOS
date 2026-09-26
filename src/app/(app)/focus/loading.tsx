import { ChartSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** The running timer is the first thing on the page, so its box comes first. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-focus">
      <PageHeaderSkeleton title="w-20" control="w-24" />
      <PanelSkeleton label="w-16" rows={2} />
      <PanelSkeleton label="w-24" hint>
        <ChartSkeleton />
      </PanelSkeleton>
    </div>
  );
}
