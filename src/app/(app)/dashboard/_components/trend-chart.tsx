"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";

import { EmptyState } from "@/components/tui/empty-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "cn";

/**
 * The dashboard's real chart (spec §7.1: Recharts, themed to tokens) via the shadcn `chart` wrapper —
 * a superset of the habit-only bar chart it replaces (ADR-101).
 *
 * Two shapes, one contract:
 * - Series colours come from the theme's `--chart-*` tokens, never a raw hex, so every preset
 *   (ADR-098) and the axe sweep stay green.
 * - `accessibilityLayer` exposes the data points, and the `<details>` below is a real `<table>` of
 *   the same numbers — the accessible alternative the career funnel already uses.
 * - A window with nothing in it renders the caller's empty state rather than an axis of zeroes: a
 *   chart must never invent data (spec §1).
 */
export type TrendSeries = "bar" | "area";

export interface TrendPoint {
  /** `YYYY-MM-DD`; the axis shows `MM-DD`, the table keeps the full key. */
  day: string;
  value: number;
}

export function TrendChart({
  data,
  series,
  color = "var(--chart-1)",
  title,
  description,
  showTitle = true,
  caption,
  dayLabel,
  valueLabel,
  unit,
  tableToggle,
  emptyLabel,
  emptyAction,
  isEmpty = false,
  className,
}: {
  data: TrendPoint[];
  series: TrendSeries;
  /** The series token, e.g. `var(--chart-2)`. */
  color?: string;
  title: string;
  description: string;
  /** Off inside a `Panel`, whose title chip already names the widget. */
  showTitle?: boolean;
  /** Rendered under the chart, e.g. "4 habits · 14 days". */
  caption?: string;
  dayLabel: string;
  valueLabel: string;
  /** Appended to each value in the table, e.g. "min" or "%". */
  unit?: string;
  /** The `<summary>` that opens the table. */
  tableToggle: string;
  emptyLabel: string;
  /** A next step for the empty state, so a quiet chart is never a dead box. */
  emptyAction?: { href: string; label: string };
  /**
   * The caller decides emptiness from the domain, not from the values: a habit chart is empty
   * because there are no habits, a focus chart is empty because no session was logged — a
   * sub-minute block still has a session and still belongs on the chart (spec §1).
   */
  isEmpty?: boolean;
  className?: string;
}) {
  // One data key, one config key, one series: a mismatch here is what silently draws an empty plot.
  const config = { value: { label: title, color } } satisfies ChartConfig;
  const fill = "var(--color-value)";

  if (isEmpty) {
    return (
      <EmptyState
        title={emptyLabel}
        hint={description}
        className={className}
        data-testid="trend-chart-empty"
      >
        {emptyAction ? (
          <Link
            href={emptyAction.href}
            className="font-mono text-[10px] text-primary hover:underline"
          >
            {emptyAction.label}
          </Link>
        ) : null}
      </EmptyState>
    );
  }

  const average = Math.round(data.reduce((sum, point) => sum + point.value, 0) / data.length);
  // A window whose values are all zero still needs a range, or Recharts draws an invisible plot and
  // the widget looks broken. The floor changes the axis, never a value.
  const ceiling = Math.max(1, ...data.map((point) => point.value));
  const domain: [number, number] = [0, ceiling];

  return (
    <div data-slot="trend-chart" className={cn("flex min-w-0 flex-col gap-2", className)}>
      {showTitle ? (
        <div>
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            {title}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">{description}</p>
        </div>
      ) : (
        <p className="font-mono text-[10px] text-muted-foreground">{description}</p>
      )}

      <ChartContainer config={config} className="h-32 w-full">
        {series === "bar" ? (
          <BarChart accessibilityLayer data={data} barCategoryGap={1} margin={{ top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              className="font-mono"
            />
            <YAxis hide domain={domain} width={0} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <ReferenceLine y={average} stroke="var(--muted-foreground)" strokeDasharray="2 4" />
            <Bar dataKey="value" fill={fill} radius={2} />
          </BarChart>
        ) : (
          <AreaChart accessibilityLayer data={data} margin={{ top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              className="font-mono"
            />
            <YAxis hide domain={domain} width={0} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <ReferenceLine y={average} stroke="var(--muted-foreground)" strokeDasharray="2 4" />
            <Area
              dataKey="value"
              type="monotone"
              fill={fill}
              fillOpacity={0.2}
              stroke={fill}
              strokeWidth={2}
            />
          </AreaChart>
        )}
      </ChartContainer>

      {caption ? <p className="font-mono text-[10px] text-muted-foreground">{caption}</p> : null}

      <details className="group" data-slot="trend-chart-table">
        <summary className="w-fit cursor-pointer rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground select-none hover:bg-accent hover:text-accent-foreground">
          {tableToggle}
        </summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-left font-mono text-[10px] tabular-nums">
            <caption className="sr-only">{`${title} — ${description}`}</caption>
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 pr-2 font-normal">
                  {dayLabel}
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  {valueLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((point) => (
                <tr key={point.day} className="border-t border-border">
                  <th scope="row" className="py-1 pr-2 font-normal">
                    <time dateTime={point.day}>{point.day}</time>
                  </th>
                  <td className="py-1 text-right">
                    {point.value}
                    {unit ? ` ${unit}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
