import {
  ListSkeleton,
  PageHeaderSkeleton,
  PanelSkeleton,
  TileSkeleton,
} from "@/components/tui/skeleton";

/** Habit rows carry streak meters, so each row is taller than a plain list row. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-habits">
      <PageHeaderSkeleton title="w-20" control="w-24" />
      <TileSkeleton count={3} />
      <PanelSkeleton label="w-20" hint>
        <ListSkeleton rows={5} />
      </PanelSkeleton>
    </div>
  );
}
