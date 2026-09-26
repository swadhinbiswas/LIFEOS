import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartSkeleton,
  PageHeaderSkeleton,
  PanelSkeleton,
  TileSkeleton,
} from "@/components/tui/skeleton";

/**
 * The dashboard's own shape while it loads (spec §13 reliability).
 *
 * The fallback this replaces was a flat six-card grid, which meant the page visibly re-laid-out
 * when the data landed. The widget mix below is the default `today` layout, so the transition is a
 * fill-in rather than a jump — and the panel order matches the registry order for the same reason.
 */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-dashboard">
      <PageHeaderSkeleton title="w-28" control="w-64" />

      {/* The greeting header, which sits above the widgets on this variant. */}
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-2.5 w-40" />
      </div>

      <PanelSkeleton label="w-24" hint rows={3} />
      <TileSkeleton count={4} />
      <PanelSkeleton label="w-20" hint>
        <ChartSkeleton />
      </PanelSkeleton>
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton label="w-28" hint rows={4} />
        <PanelSkeleton label="w-24" hint rows={4} />
      </div>
    </div>
  );
}
