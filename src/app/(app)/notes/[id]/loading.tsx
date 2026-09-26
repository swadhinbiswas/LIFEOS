import { PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** A note is one long column, so the body is deep rather than wide. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-note">
      <PageHeaderSkeleton title="w-40" control="w-20" />
      <PanelSkeleton label="w-16" rows={8} />
      <PanelSkeleton label="w-24" rows={2} />
    </div>
  );
}
