import { BoardSkeleton, PageHeaderSkeleton } from "@/components/tui/skeleton";

/** Every board is a kanban; reusing the tasks skeleton keeps the two identical. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-board-detail">
      <PageHeaderSkeleton title="w-28" control="w-40" />
      <BoardSkeleton columns={4} cards={3} />
    </div>
  );
}
