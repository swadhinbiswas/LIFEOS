import { PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

/** The thread column; the composer is always present, so the wait is above it. */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-copilot">
      <PageHeaderSkeleton title="w-24" control="w-20" />
      <PanelSkeleton label="w-16" rows={6} />
    </div>
  );
}
