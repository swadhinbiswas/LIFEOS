import Link from "next/link";
import * as React from "react";

import { cn } from "cn";
import { AsciiMeter } from "@/components/tui/ascii-meter";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The stat card (spec §3.3 anatomy, reference "Total companies / 60"), built on the shadcn `Card`
 * and `Badge` primitives re-skinned by our tokens — not a hand-rolled box. A small muted label, a
 * large value, an optional delta badge, an optional meter, and a link to the list behind the number.
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
  /** A signed change; `null` means there is no baseline and no badge is shown. */
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
    <Card
      data-slot={slot ?? "stat-card"}
      className={cn("gap-2 p-3 transition-colors hover:border-ring", className)}
      {...props}
    >
      <CardHeader className="grid-cols-[1fr_auto] p-0">
        <CardTitle
          className="min-w-0 truncate font-mono text-[10px] font-normal tracking-wider text-muted-foreground uppercase"
          title={label}
        >
          {label}
        </CardTitle>
        {badge === null ? null : (
          <CardAction>
            <Badge
              data-slot="stat-delta"
              variant="outline"
              className={cn(
                "font-mono text-[10px] tabular-nums",
                delta! > 0
                  ? "border-success text-success"
                  : delta! < 0
                    ? "border-destructive text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {badge}
            </Badge>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-2 p-0">
        <span className="font-mono text-2xl leading-none font-semibold tabular-nums">{value}</span>
        {meter !== undefined ? (
          <AsciiMeter value={meter} label={label} cells={14} showValue={false} />
        ) : null}
        {href ? (
          <Link href={href} className="mt-auto font-mono text-[10px] text-primary hover:underline">
            {linkLabel ?? "open list"}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
