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

/**
 * An optional second bar beside the first, for a two-part comparison such as AI-authored lines
 * against human-authored ones (ADR-110). Absent, the chart is exactly what it was before.
 */
export interface TrendSecondary {
  /** The key on each data point. */
  dataKey: string;
  label: string;
  /** A `--chart-*` token. */
  color: string;
}

export function TrendChart({
  data,
  series,
  secondary,
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
  /**
   * A second bar in the same plot. Only meaningful for `bar`: a comparison of two parts is a
   * grouping, and overlaying an area over an area would read as a trend, which it is not.
   */
  secondary?: TrendSecondary;
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
  const config = {
    value: { label: title, color },
    ...(secondary && series === "bar"
      ? { [secondary.dataKey]: { label: secondary.label, color: secondary.color } }
      : {}),
  } satisfies ChartConfig;
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
  const secondaryValues = secondary
    ? data.map((point) =>
        Number((point as unknown as Record<string, unknown>)[secondary.dataKey] ?? 0),
      )
    : [];
  /**
   * The top of the scale.
   *
   * A percentage series tops out at 100, and saying so is the whole point of showing the axis: with
   * the old `Math.max(1, …)` floor, a week where nothing was checked off drew an axis reading
   * `0% … 1%`, which is a *scale*, not a measurement — the top of it implied 1% was the best the
   * chart could show. The `1` floor exists so an all-zero series does not get a zero-height domain,
   * and 100 serves that job just as well for a percentage. Every other unit here is a count or a
   * duration, where the data's own maximum is the honest ceiling.
   */
  const values = data.map((point) => point.value);
  const ceiling = unit === "%" ? 100 : Math.max(1, ...values, ...secondaryValues);
  // A net-change series can go below zero (more deleted than added), so the floor follows the data
  // rather than being pinned at 0 — a clipped bar would misstate the value.
  const floor = Math.min(0, ...values, ...secondaryValues);
  const domain: [number, number] = [floor, ceiling];
  const withSecondary = secondary !== undefined && series === "bar";

  /**
   * The value axis, in the unit the series already declares (ADR-130).
   *
   * Showing the axis at all is only worth it if the numbers on it are the numbers in the caption: a
   * habit chart whose left axis read `0.25` while its table read `25 %` would be two scales for one
   * quantity. Integers stay integers (`100`, not `100.0`); a fractional value keeps one decimal,
   * because rounding a real 0.5 tick to `1` would be a different number.
   */
  const axisTick = (value: number): string => {
    const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return unit ? `${text}${unit}` : text;
  };

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
            {/* Dates run left to right but the *newest* one anchors to the right edge (ADR-130), so
                the axis reads as a timeline ending at today rather than starting at a month-old
                date. `align="right"` on the ticks, with a right margin, is what puts the label
                there; the plot itself is untouched. */}
            {/* Dates: only the two ends. Twenty-eight labels in a 128px-tall plot is a picket fence,
                and `preserveStartEnd` leaves the two that actually orient a reader — where the
                window starts and where it ends. */}
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              interval="preserveStartEnd"
              minTickGap={28}
              className="font-mono"
              tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
              height={18}
            />
            {/* The value axis, which used to be `hide width={0}`. The plot had no left-hand scale
                at all, so every bar's height had to be judged against the average line alone. */}
            <YAxis
              orientation="left"
              domain={domain}
              width={38}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickFormatter={axisTick}
              className="font-mono"
              tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {/* One series has a meaningful average line; two grouped bars do not — a line at the
                first series' mean would be read as a threshold for the pair. */}
            {secondary && series === "bar" ? null : (
              <ReferenceLine y={average} stroke="var(--muted-foreground)" strokeDasharray="2 4" />
            )}
            <Bar dataKey="value" fill={fill} radius={2} />
            {secondary && series === "bar" ? (
              <Bar
                dataKey={secondary.dataKey}
                fill={`var(--color-${secondary.dataKey})`}
                radius={2}
              />
            ) : null}
          </BarChart>
        ) : (
          <AreaChart accessibilityLayer data={data} margin={{ top: 4 }}>
            <CartesianGrid vertical={false} />
            {/* Dates: only the two ends. Twenty-eight labels in a 128px-tall plot is a picket fence,
                and `preserveStartEnd` leaves the two that actually orient a reader — where the
                window starts and where it ends. */}
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              interval="preserveStartEnd"
              minTickGap={28}
              className="font-mono"
              tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
              height={18}
            />
            <YAxis
              orientation="left"
              domain={domain}
              width={38}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickFormatter={axisTick}
              className="font-mono"
              tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
            />
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

      {secondary && series === "bar" ? (
        // Named, not just coloured: two theme-token hues alone would fail anyone who cannot tell
        // them apart, and the table below is not visible until it is opened.
        <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {[title, secondary.label].map((label) => (
            <li key={label} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-[1px]"
                style={{
                  backgroundColor:
                    label === title ? `var(--color-value)` : `var(--color-${secondary.dataKey})`,
                }}
              />
              {label}
            </li>
          ))}
        </ul>
      ) : null}

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
                {withSecondary ? (
                  <th scope="col" className="py-1 pl-2 text-right font-normal">
                    {secondary.label}
                  </th>
                ) : null}
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
                  {withSecondary ? (
                    <td className="py-1 pl-2 text-right">
                      {Number(
                        (point as unknown as Record<string, unknown>)[secondary.dataKey] ?? 0,
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
