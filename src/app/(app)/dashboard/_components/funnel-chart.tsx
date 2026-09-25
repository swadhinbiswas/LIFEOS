"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "cn";

export interface FunnelBar {
  stage: string;
  count: number;
  /** Mean whole days in this stage, or null when no application has ever left it. */
  meanDays: number | null;
}

/**
 * The pipeline as a chart, not a list (ADR-104): horizontal bars, widest first, each labelled with
 * its real count, and a dashed line at the mean application count so a reader can see which stages
 * are ahead of or behind the pipeline's own average.
 *
 * Every rule the repo's charts follow applies: `accessibilityLayer`, series colour from a
 * `--chart-*` token, `tabular-nums` figures, and a real `<table>` alternative for the same numbers.
 * A pipeline with nothing in it is an empty state with a link, never a row of zero-length bars.
 */
export function FunnelChart({
  data,
  title,
  description,
  stageLabel,
  countLabel,
  meanLabel,
  tableToggle,
  emptyLabel,
  emptyAction,
  caption,
  className,
}: {
  data: FunnelBar[];
  title: string;
  description: string;
  stageLabel: string;
  countLabel: string;
  meanLabel: string;
  tableToggle: string;
  emptyLabel: string;
  emptyAction?: { href: string; label: string };
  /** Rendered under the chart; must describe what the number actually counts. */
  caption?: string;
  className?: string;
}) {
  const config = {
    count: { label: countLabel, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  const total = data.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return (
      <div
        data-slot="funnel-chart"
        data-empty="true"
        className={cn(
          "flex min-h-24 flex-col items-start gap-1 rounded-[var(--radius)] border border-dashed border-border px-3 py-4",
          className,
        )}
      >
        <p className="font-mono text-xs">{emptyLabel}</p>
        {emptyAction ? (
          <a href={emptyAction.href} className="font-mono text-[10px] text-primary hover:underline">
            {emptyAction.label}
          </a>
        ) : null}
      </div>
    );
  }

  const mean = Math.round((total / data.length) * 10) / 10;
  // A pipeline is ten rows deep; a fixed 224 px chart made Recharts drop every other tick, so the
  // labels drifted off their bars. One row per stage, and every tick kept.
  const height = Math.max(160, data.length * 26);

  return (
    <div data-slot="funnel-chart" className={cn("flex min-w-0 flex-col gap-2", className)}>
      <p className="font-mono text-[10px] text-muted-foreground">{description}</p>

      <ChartContainer config={config} className="w-full" style={{ height }}>
        <BarChart
          accessibilityLayer
          data={data}
          layout="vertical"
          margin={{ left: 4, right: 24 }}
          barCategoryGap={6}
        >
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide domain={[0, "auto"]} />
          <YAxis
            type="category"
            dataKey="stage"
            width={92}
            interval={0}
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            className="font-mono text-[10px]"
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="stage" />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={2}>
            <LabelList
              dataKey="count"
              position="right"
              className="fill-muted-foreground font-mono text-[10px] tabular-nums"
            />
          </Bar>
        </BarChart>
      </ChartContainer>

      <p className="font-mono text-[10px] text-muted-foreground">{`${mean} ${countLabel} per stage`}</p>

      {caption ? <p className="font-mono text-[10px] text-muted-foreground">{caption}</p> : null}

      <details className="group" data-slot="funnel-chart-table">
        <summary className="w-fit cursor-pointer rounded-[var(--radius)] border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground select-none hover:bg-accent hover:text-accent-foreground">
          {tableToggle}
        </summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-left font-mono text-[10px] tabular-nums">
            <caption className="sr-only">{`${title} — ${description}`}</caption>
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 pr-2 font-normal">
                  {stageLabel}
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-normal">
                  {countLabel}
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  {meanLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.stage} className="border-t border-border">
                  <th scope="row" className="py-1 pr-2 font-normal">
                    {row.stage}
                  </th>
                  <td className="py-1 pr-2 text-right">{row.count}</td>
                  <td className="py-1 text-right">
                    {row.meanDays === null ? "—" : `${row.meanDays}d`}
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
