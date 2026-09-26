import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** Notifications are read/unread, so every row carries a leading marker. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-notifications">
      <PageHeaderSkeleton title="w-28" control="w-20" />
      <PanelSkeleton label="w-20" hint>
        <ListSkeleton rows={6} />
      </PanelSkeleton>
    </div>
  );
}
