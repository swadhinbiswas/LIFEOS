import { cn } from "cn";

import { AsciiMeter } from "@/components/tui/ascii-meter";

export interface SignalTile {
  id: string;
  label: string;
  value: number;
  /** Status token for the pip: `danger` / `warning` / `info` / `muted`. */
  tone: "danger" | "warning" | "info" | "muted";
  /** 0…1 share of the open-card total, for the micro-meter; omit for no meter. */
  share?: number;
}

/**
 * The Today signal tiles (ADR-101) — the counts widget as three small, glanceable cards.
 *
 * Server-rendered and theme-driven: the pip and the meter are the only coloured parts, and they are
 * decorative, so no chart colour sits behind text and the axe sweep stays clean (spec §4.4). The
 * number is real text in `tabular-nums`; the meter under it is a real `progressbar` via
 * `AsciiMeter`, so the proportion is never conveyed by colour alone.
 */
export function SignalTiles({
  items,
  meterLabel,
  className,
}: {
  items: SignalTile[];
  /** `meterLabel` receives the tile label, e.g. "overdue — share of open cards". */
  meterLabel: (label: string) => string;
  className?: string;
}) {
  return (
    <dl
      data-slot="signal-tiles"
      className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", className)}
    >
      {items.map((tile) => (
        <div
          key={tile.id}
          data-slot="signal-tile"
          data-tone={tile.tone}
          className="flex min-w-0 flex-col gap-1 rounded-[var(--radius)] border border-border bg-card p-2 transition-colors hover:border-ring"
        >
          <dt className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                tile.tone === "danger" && "bg-destructive",
                tile.tone === "warning" && "bg-warning",
                tile.tone === "info" && "bg-info",
                tile.tone === "muted" && "bg-muted-foreground",
              )}
            />
            <span className="truncate">{tile.label}</span>
          </dt>
          <dd className="font-mono text-2xl leading-none font-semibold tabular-nums">
            {tile.value}
          </dd>
          {tile.share === undefined ? null : (
            <AsciiMeter
              value={tile.share}
              label={meterLabel(tile.label)}
              cells={10}
              showValue={false}
              className="text-[10px]"
            />
          )}
        </div>
      ))}
    </dl>
  );
}
