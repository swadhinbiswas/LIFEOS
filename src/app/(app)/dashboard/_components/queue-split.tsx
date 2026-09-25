import { cn } from "cn";

export interface QueueSlice {
  id: "overdue" | "dueToday" | "inbox" | "open";
  count: number;
}

export interface QueuePartition {
  slices: QueueSlice[];
  /** Sum of every slice — the open-card total the bar is a share of. */
  total: number;
}

interface BriefCounts {
  overdue: readonly { id: string }[];
  dueToday: readonly { id: string }[];
  inbox: readonly { id: string }[];
  openCards: number;
}

/**
 * The open-card queue as one honest partition (ADR-101).
 *
 * A stacked bar is only truthful when its parts are disjoint and add up, and the daily brief's
 * three lists overlap (an inbox card can also be due today). So: overdue and due-today keep their
 * brief order, the inbox slice keeps only cards those two do not already claim — matched on card
 * `id`, not object identity, so freshly-read rows dedupe just as well as shared ones — and
 * everything else open lands in `open`. Pure, so the split is unit-tested against a fixture rather
 * than trusted (spec §1 — the bar may not quietly double-count).
 */
export function partitionQueue(brief: BriefCounts): QueuePartition {
  const claimed = new Set([...brief.overdue, ...brief.dueToday].map((card) => card.id));
  const inboxOnly = brief.inbox.filter((card) => !claimed.has(card.id));
  const named = brief.overdue.length + brief.dueToday.length + inboxOnly.length;
  const open = Math.max(0, brief.openCards - named);

  return {
    slices: [
      { id: "overdue", count: brief.overdue.length },
      { id: "dueToday", count: brief.dueToday.length },
      { id: "inbox", count: inboxOnly.length },
      { id: "open", count: open },
    ],
    total: Math.max(brief.openCards, named),
  };
}

/**
 * The proportion bar plus its legend (ADR-101). Pure CSS, so it is server-rendered and themeable:
 * each slice takes a `--chart-*`/status token, the count is real text, and the widths are
 * percentages of a known total — never a hardcoded width.
 */
export function QueueSplit({
  partition,
  labels,
  emptyLabel,
  className,
}: {
  partition: QueuePartition;
  /** `overdue` / `dueToday` / `inbox` / `open` → their display labels. */
  labels: Record<QueueSlice["id"], string>;
  emptyLabel: string;
  className?: string;
}) {
  if (partition.total === 0) {
    return <p className={cn("font-mono text-xs text-muted-foreground", className)}>{emptyLabel}</p>;
  }

  // Categorical slices, so the bar stays on the chart palette (ADR-098/ADR-101) — the urgency of
  // "overdue" is carried by the tiles' status pips, not by a status token in a series.
  const tones: Record<QueueSlice["id"], string> = {
    overdue: "bg-chart-4",
    dueToday: "bg-chart-1",
    inbox: "bg-chart-2",
    open: "bg-chart-3",
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)} data-slot="queue-split">
      <div
        aria-hidden="true"
        className="flex h-2 w-full overflow-hidden rounded-full border border-border"
      >
        {partition.slices.map((slice) =>
          slice.count === 0 ? null : (
            <span
              key={slice.id}
              className={cn("h-full", tones[slice.id])}
              style={{ width: `${(slice.count / partition.total) * 100}%` }}
            />
          ),
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px]">
        {partition.slices.map((slice) => (
          <li key={slice.id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", tones[slice.id])} />
            <span className="text-muted-foreground">{labels[slice.id]}</span>
            <span className="tabular-nums">{slice.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
