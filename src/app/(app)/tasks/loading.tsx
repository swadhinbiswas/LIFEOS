import { BoardSkeleton, PageHeaderSkeleton } from "@/components/tui/skeleton";

/** Board-shaped loading state: header, toolbar, columns (spec §13 reliability). */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-board">
      <PageHeaderSkeleton title="w-24" control="w-40" />
      <BoardSkeleton columns={4} cards={2} />
    </div>
  );
}
