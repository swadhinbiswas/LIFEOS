import { FieldGridSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** A CV is a document: a wide page of text under a header. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-cv">
      <PageHeaderSkeleton title="w-32" control="w-32" />
      <PanelSkeleton label="w-20" rows={10} />
      <PanelSkeleton label="w-16" rows={3}>
        <FieldGridSkeleton fields={3} />
      </PanelSkeleton>
    </div>
  );
}
