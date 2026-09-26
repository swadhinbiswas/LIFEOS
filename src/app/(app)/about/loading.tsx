import { ListSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** The signed-in about page is prose plus a link list (it also carries the language switch). */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-about">
      <PageHeaderSkeleton title="w-28" control="w-20" />
      <PanelSkeleton label="w-20" rows={8} />
      <PanelSkeleton label="w-16" hint>
        <ListSkeleton rows={3} leading={false} />
      </PanelSkeleton>
    </div>
  );
}
