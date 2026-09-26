import { PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** One document is one long column of prose, so the skeleton is deep and narrow-ish. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-doc">
      <PageHeaderSkeleton title="w-40" control="w-20" />
      <PanelSkeleton label="w-20" rows={10} />
    </div>
  );
}
