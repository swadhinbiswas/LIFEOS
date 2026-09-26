import { FormSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** A settings section: a heading over a labelled form (spec §6.9 regional/personal). */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-settings-activity">
      <PageHeaderSkeleton title="w-24" control="w-16" />
      <PanelSkeleton label="w-20" rows={2}>
        <FormSkeleton fields={2} />
      </PanelSkeleton>
    </div>
  );
}
