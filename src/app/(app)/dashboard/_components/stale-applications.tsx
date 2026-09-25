import Link from "next/link";

import { AsciiMeter } from "@/components/tui/ascii-meter";
import { cn } from "cn";

export interface StaleApplication {
  cardId: string;
  title: string;
  stage: string;
  /** Whole days since the application last changed stage. */
  days: number;
}

/**
 * Applications that have gone quiet (ADR-104). This is the career module's own staleness rule —
 * the same window `getFollowUpsDue` uses to raise a notification — rendered as a work list rather
 * than a count, because a number you cannot act on is decoration.
 *
 * Days in stage are a real, comparable signal, so each row carries an `AsciiMeter` (a real
 * `progressbar`, glyphs decorative) against the ghost threshold plus a link into the application.
 * Server-rendered: no client JS for a list of five rows.
 */
export function StaleApplications({
  rows,
  thresholdDays,
  daysLabel,
  meterLabel,
  emptyLabel,
  className,
}: {
  rows: StaleApplication[];
  /** Days without movement that make an application "stale". */
  thresholdDays: number;
  /** `daysLabel` receives the row's day count, e.g. `23 days`. */
  daysLabel: (count: number) => string;
  /** `meterLabel` receives `{title, days}` for the meter's accessible name. */
  meterLabel: (values: { title: string; days: number }) => string;
  emptyLabel: string;
  className?: string;
}) {
  if (rows.length === 0) {
    return <p className={cn("font-mono text-xs text-muted-foreground", className)}>{emptyLabel}</p>;
  }

  return (
    <ul className={cn("flex min-w-0 flex-col gap-1.5", className)} data-slot="stale-list">
      {rows.map((row) => (
        <li
          key={row.cardId}
          data-slot="stale-row"
          className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
        >
          <Link
            href={`/career/jobs/${row.cardId}`}
            className="min-w-0 flex-1 truncate font-mono text-xs hover:text-primary"
          >
            {row.title}
          </Link>
          <span className="font-mono text-[10px] text-muted-foreground">{row.stage}</span>
          <AsciiMeter
            value={Math.min(1, row.days / Math.max(1, thresholdDays))}
            label={meterLabel({ title: row.title, days: row.days })}
            cells={5}
            showValue={false}
            className="text-[10px]"
          />
          <span className="font-mono text-[10px] text-warning tabular-nums">
            {daysLabel(row.days)}
          </span>
        </li>
      ))}
    </ul>
  );
}
