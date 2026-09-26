import { PanelSkeleton, PageHeaderSkeleton, TileSkeleton } from "@/components/tui/skeleton";

/**
 * The `(app)` group's fallback, for the handful of routes with no `loading.tsx` of their own.
 *
 * Most routes now have one that matches their layout, because a skeleton shaped like nothing on the
 * page makes a slow query look broken rather than pending. This one is deliberately generic: it is
 * what a *new* route gets for free, and it must not pretend to know a layout it has not been told
 * about.
 */
export default function Loading() {
  return (
    <div className="grid gap-4" data-slot="loading">
      <PageHeaderSkeleton title="w-32" control="w-48" />
      <TileSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton label="w-24" hint rows={3} />
        <PanelSkeleton label="w-28" hint rows={3} />
      </div>
      <PanelSkeleton label="w-20" rows={4} />
    </div>
  );
}
