import { getTranslations } from "next-intl/server";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

/**
 * The loading vocabulary (spec §13 reliability).
 *
 * 43 of the app's routes had no `loading.tsx`, so they fell through to one generic six-card grid —
 * navigating to the dashboard showed grey boxes shaped like nothing that page contains. A skeleton
 * earns its place by matching the layout it stands in for: a board has columns, a chart has a plot
 * area, a form has labelled fields. Generic rectangles make a slow query look broken rather than
 * pending.
 *
 * Everything here is composed from the vendored shadcn `Skeleton` (spec §7.1 — run the CLI, do not
 * hand-write primitives). Only the *shape* is LifeOS's, and the sweep is CSS, so every theme preset
 * gets it for free (ADR-098).
 */

/**
 * The page frame: header rule, then a title and a trailing control.
 *
 * The title is a real `<h1>` carrying real words, because the real `PageHeader` is an `<h1>` and the
 * loading state is a genuine page state for as long as it lasts. Two axe rules caught this in turn:
 * `page-has-heading-one` first (a bar is not a heading), then `empty-heading` (a heading of
 * `&nbsp;` is a heading with nothing in it). Neither is visible to a source-level test.
 *
 * Async because the default label is translated. Every `loading.tsx` is a server component, so this
 * costs nothing and means the announcement is never an untranslated English word on a Bangla page —
 * which ADR-072 forbids just as firmly here as anywhere else. Callers that know their own page name
 * pass `label`; the rest get "Loading".
 */
export async function PageHeaderSkeleton({
  title = "w-32",
  control = "w-48",
  as: Heading = "h1",
  label,
}: {
  title?: string;
  control?: string;
  /** Match the page being stood in for: `h1` normally, `h2` when a parent already owns the `h1`. */
  as?: "h1" | "h2";
  /** The page's own name, when the caller knows it. Defaults to a translated "Loading". */
  label?: string;
}) {
  const t = await getTranslations("Common");
  return (
    <div
      className="flex items-center gap-3 border-b border-border pb-3"
      data-slot="skeleton-header"
    >
      <Heading
        className="font-mono text-sm font-semibold tracking-wider uppercase"
        // Announced as the state, not as the bar, which carries nothing to say.
        aria-busy="true"
      >
        <span className="sr-only">{label ?? t("loadingLabel")}</span>
        <Skeleton className={cn("h-4", title)} aria-hidden="true" />
      </Heading>
      <Skeleton className={cn("ml-auto h-6", control)} />
    </div>
  );
}

/**
 * A `Panel` in waiting: the same hairline frame and the same title-chip cut-out, so the skeleton
 * lands inside the real frame instead of jumping when the data arrives. The chip is a skeleton
 * rather than text because the label is not known yet.
 */
export function PanelSkeleton({
  label = "w-24",
  hint = false,
  rows = 3,
  className,
  children,
}: {
  label?: string;
  /** Draw the right-hand count chip too; the count is not known yet, so it is a bar. */
  hint?: boolean;
  rows?: number;
  className?: string;
  /** Replaces the default text rows — pass a `ChartSkeleton` for a panel that holds a chart. */
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="skeleton-panel"
      className={cn(
        "relative flex min-w-0 flex-col gap-2 rounded-[var(--radius)] border border-border bg-card px-2 pt-3 pb-2",
        className,
      )}
    >
      {/* The chip half-overlaps the frame exactly as `Panel` does (spec §4.1), which is what keeps
          the transition from looking like a re-layout rather than a fill-in. */}
      <span className="absolute top-0 left-3 z-10 -translate-y-1/2 rounded-[var(--radius)] bg-card px-2">
        <Skeleton className={cn("h-3", label)} />
      </span>
      {hint ? (
        <span className="absolute top-0 right-3 z-10 -translate-y-1/2 rounded-[var(--radius)] bg-card px-2">
          <Skeleton className="h-3 w-10" />
        </span>
      ) : null}
      {children ?? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton
              key={index}
              // Varying the trailing width reads as text of different lengths; a stack of
              // identical bars reads as a progress bar that is stuck.
              className={cn(
                "h-3",
                index % 3 === 2 ? "w-2/3" : index % 3 === 1 ? "w-5/6" : "w-full",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** A list of rows with a leading marker, for queues, inboxes and tables of records. */
export function ListSkeleton({
  rows = 4,
  leading = true,
  className,
}: {
  rows?: number;
  leading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="skeleton-list">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-2">
          {leading ? <Skeleton className="size-4 shrink-0" /> : null}
          <Skeleton className={cn("h-3", index % 2 === 1 ? "w-2/3" : "w-full")} />
          <Skeleton className="ml-auto h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * A chart's plot area. Recharts renders nothing until data arrives, so a skeleton here is what stops
 * the panel collapsing from full height to nothing and back — the layout shift a chart causes is
 * worse than the wait.
 */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="skeleton-chart"
      className={cn("flex h-32 w-full items-end gap-1", className)}
      role="presentation"
    >
      {/* Descending bars: a chart's silhouette is a skyline, and a flat row of equal bars reads as
          a table of nothing. */}
      {[45, 70, 30, 85, 55, 95, 40, 65].map((height, index) => (
        <Skeleton key={index} className="flex-1 rounded-[1px]" style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}

/** The `SignalTiles` / `StatCard` grid: a big figure over a caption. */
export function TileSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      data-slot="skeleton-tiles"
      className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-1.5 rounded-[var(--radius)] border border-border bg-card p-2"
        >
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Labelled form fields, each a caption over an input-sized box. */
export function FormSkeleton({ fields = 3, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="skeleton-form">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-1">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
      <Skeleton className="h-8 w-28" />
    </div>
  );
}

/** Board columns: a header over stacked cards, matching the kanban it stands in for. */
export function BoardSkeleton({ columns = 4, cards = 2 }: { columns?: number; cards?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2" data-slot="skeleton-board">
      {Array.from({ length: columns }, (_, column) => (
        <div key={column} className="flex w-64 shrink-0 flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: cards }, (_, card) => (
            <Skeleton key={card} className="h-20 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A `dl` of label/value pairs, the shape most detail pages use. */
export function FieldGridSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <dl data-slot="skeleton-fields" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-1">
          <dt>
            <Skeleton className="h-2.5 w-14" />
          </dt>
          <dd>
            <Skeleton className={cn("h-3", index % 3 === 2 ? "w-2/3" : "w-full")} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
