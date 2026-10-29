import { FormSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** Email settings: a heading over a labelled form. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-settings-email">
      <PageHeaderSkeleton title="w-24" control="w-16" />
      <PanelSkeleton label="w-20" rows={2}>
        <FormSkeleton fields={6} />
      </PanelSkeleton>
    </div>
  );
}
