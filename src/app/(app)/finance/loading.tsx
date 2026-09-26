import {
  ListSkeleton,
  PageHeaderSkeleton,
  PanelSkeleton,
  TileSkeleton,
} from "@/components/tui/skeleton";

/** Balances first, then the transaction list — the order the page renders them in. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-finance">
      <PageHeaderSkeleton title="w-24" control="w-24" />
      <TileSkeleton count={4} />
      <PanelSkeleton label="w-28" hint>
        <ListSkeleton rows={6} />
      </PanelSkeleton>
    </div>
  );
}
