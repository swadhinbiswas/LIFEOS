import {
  ChartSkeleton,
  PageHeaderSkeleton,
  PanelSkeleton,
  TileSkeleton,
} from "@/components/tui/skeleton";

/** KPIs first, then the funnel and velocity charts (spec §6.8). */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-analytics">
      <PageHeaderSkeleton title="w-32" control="w-24" />
      <TileSkeleton count={4} />
      <PanelSkeleton label="w-24" hint>
        <ChartSkeleton />
      </PanelSkeleton>
      <PanelSkeleton label="w-28" hint>
        <ChartSkeleton />
      </PanelSkeleton>
    </div>
  );
}
