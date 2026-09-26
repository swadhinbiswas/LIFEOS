import { FieldGridSkeleton, PanelSkeleton, PageHeaderSkeleton } from "@/components/tui/skeleton";

/** An application in waiting: the same panel stack the real page renders (ADR-114). */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-job-detail">
      <PageHeaderSkeleton title="w-40" control="w-24" />
      <PanelSkeleton label="w-28" hint rows={2}>
        <FieldGridSkeleton fields={6} />
      </PanelSkeleton>
      <PanelSkeleton label="w-24" rows={2} />
      <PanelSkeleton label="w-24" hint rows={3} />
    </div>
  );
}
