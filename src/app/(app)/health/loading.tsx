import {
  ListSkeleton,
  PageHeaderSkeleton,
  PanelSkeleton,
  TileSkeleton,
} from "@/components/tui/skeleton";

/** Health is measurements first, history second. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-health">
      <PageHeaderSkeleton title="w-20" control="w-20" />
      <TileSkeleton count={4} />
      <PanelSkeleton label="w-24" hint>
        <ListSkeleton rows={5} />
      </PanelSkeleton>
    </div>
  );
}
