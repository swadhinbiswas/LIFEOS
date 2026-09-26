import { FormSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** The profile section: a heading over the personal fields. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-settings-profile">
      <PageHeaderSkeleton title="w-24" control="w-16" />
      <PanelSkeleton label="w-20" rows={2}>
        <FormSkeleton fields={3} />
      </PanelSkeleton>
    </div>
  );
}
