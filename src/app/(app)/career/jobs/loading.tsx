import { BoardSkeleton, FormSkeleton, PageHeaderSkeleton } from "@/components/tui/skeleton";

/** The pipeline's own shape: a new-job form, then the stages. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-jobs">
      <PageHeaderSkeleton title="w-20" control="w-40" />
      <FormSkeleton fields={2} />
      <BoardSkeleton columns={4} cards={2} />
    </div>
  );
}
