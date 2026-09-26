import {
  FormSkeleton,
  ListSkeleton,
  PageHeaderSkeleton,
  PanelSkeleton,
} from "@/components/tui/skeleton";

/** Capture above triage, which is the order the page renders them in (ADR-042). */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading-inbox">
      <PageHeaderSkeleton title="w-20" control="w-16" />
      <PanelSkeleton label="w-24" rows={1}>
        <FormSkeleton fields={1} />
      </PanelSkeleton>
      <PanelSkeleton label="w-20" hint>
        <ListSkeleton rows={4} />
      </PanelSkeleton>
    </div>
  );
}
