import { cn } from "cn";

import { AsciiMeter } from "@/components/tui/ascii-meter";
import { Spark } from "@/components/tui/spark";

export interface ConstellationRow {
  id: string;
  name: string;
  streak: number;
  /** The last 7 day keys, oldest first — the dot strip. */
  week: Array<{ key: string; done: boolean }>;
  /** Daily values over the same 7 days, oldest first — the sparkline's shape. */
  values: number[];
  /** 0…1 share of the 28-day window completed, for the ASCII meter. */
  ratio: number;
}

/**
 * Per-habit "constellation" (ADR-101): a 7-day dot strip, a braille sparkline and the existing
 * ASCII meter on one row. Server-rendered, so the whole widget costs **zero** client JS — `Spark`
 * and `AsciiMeter` are already the spec's glyph vocabulary (spec §4.1).
 *
 * Accessibility: the dots are decorative and the sparkline is a labelled `img`, so the facts that
 * matter are spelled out in text — the dot strip carries an `sr-only` "n of 7 days" and the streak
 * is real text. Colour is never the only signal (spec §4.4).
 */
export function HabitConstellation({
  rows,
  doneOf,
  streak,
  freshStart,
  className,
}: {
  rows: ConstellationRow[];
  /** `doneOf` receives `{done}` and `{total}`. */
  doneOf: (values: { done: number; total: number }) => string;
  streak: (count: number) => string;
  freshStart: string;
  className?: string;
}) {
  return (
    <ul className={cn("flex min-w-0 flex-col gap-1.5", className)} data-slot="constellation">
      {rows.map((row) => {
        const done = row.week.filter((day) => day.done).length;
        return (
          <li
            key={row.id}
            data-slot="constellation-row"
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
          >
            <span className="min-w-32 max-w-48 flex-1 truncate font-mono text-xs">{row.name}</span>

            {/* 7-day strip: one pip per day, oldest → newest. */}
            <span aria-hidden="true" className="flex items-center gap-1">
              {row.week.map((day) => (
                <span
                  key={day.key}
                  className={cn(
                    "size-1.5 rounded-full",
                    day.done ? "bg-primary" : "border border-muted-foreground/40",
                  )}
                />
              ))}
            </span>
            <span className="sr-only">{doneOf({ done, total: row.week.length })}</span>

            <Spark
              values={row.values}
              variant="blocks"
              label={`${row.name} — ${doneOf({ done, total: row.week.length })}`}
              className="text-[10px]"
            />

            <AsciiMeter value={row.ratio} label={row.name} cells={10} showValue={false} />

            <span className="w-20 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
              {row.streak > 0 ? streak(row.streak) : freshStart}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
