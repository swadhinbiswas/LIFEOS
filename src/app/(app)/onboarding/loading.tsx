import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** Onboarding is a checklist; the wait is the checklist's shape. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-onboarding">
      <PageHeaderSkeleton title="w-40" control="w-16" />
      <PanelSkeleton label="w-28" hint>
        <ListSkeleton rows={4} />
      </PanelSkeleton>
    </div>
  );
}
