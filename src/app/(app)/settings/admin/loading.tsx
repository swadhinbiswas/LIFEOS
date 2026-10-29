/**
 * Loading skeleton for the admin settings page (spec §13 reliability).
 */
import { PageHeaderSkeleton, PanelSkeleton } from "@/components/tui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-settings-admin">
      <PageHeaderSkeleton title="w-24" control="w-16" />
      <PanelSkeleton label="w-20" rows={4} />
    </div>
  );
}
