import Link from "next/link";
import * as React from "react";

import { cn } from "cn";

import { AsciiMeter } from "./ascii-meter";

/**
 * The stat card (spec §3.3 anatomy, reference "Total companies / 60"): a small muted label, a large
 * value, an optional delta pill, an optional meter, and a link to the list behind the number.
 * Colour is only ever used for state (positive/negative), never decoration.
 */
export function StatCard({
  label,
  value,
  delta,
  /** 0…1 for a meter under the value. */
  meter,
  href,
  linkLabel,
  className,
  slot,
  ...props
}: {
  label: string;
  value: React.ReactNode;
  /** A signed change; `null` means there is no baseline and no pill is shown. */
  delta?: number | null;
  meter?: number;
  href?: string;
  linkLabel?: string;
  className?: string;
  /** A `data-*` slot name for tests. */
  slot?: string;
} & Omit<React.ComponentProps<"div">, "children">) {
  const badge = delta === undefined || delta === null ? null : `${delta > 0 ? "+" : ""}${delta}`;

  return (
    <div
      data-slot={slot ?? "stat-card"}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-3",
        "transition-colors hover:border-ring",
        className,
      )}
      {...props}
    >
      <span
        className="min-w-0 truncate font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
        title={label}
      >
        {label}
      </span>

      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-2xl leading-none font-semibold tabular-nums">{value}</span>
        {badge === null ? null : (
          <span
            data-slot="stat-delta"
            className={cn(
              "shrink-0 rounded-[var(--radius)] border px-1 font-mono text-[10px] tabular-nums",
              delta! > 0
                ? "border-success text-success"
                : delta! < 0
                  ? "border-destructive text-destructive"
                  : "border-border text-muted-foreground",
            )}
          >
            {badge}
          </span>
        )}
      </div>

      {meter !== undefined ? (
        <AsciiMeter value={meter} label={label} cells={14} showValue={false} />
      ) : null}

      {href ? (
        <Link href={href} className="mt-auto font-mono text-[10px] text-primary hover:underline">
          {linkLabel ?? "open list"}
        </Link>
      ) : null}
    </div>
  );
}
