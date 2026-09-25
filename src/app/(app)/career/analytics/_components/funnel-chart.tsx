"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * The pipeline funnel as a chart (spec §7.1: Recharts via the shadcn chart wrapper), themed to
 * tokens. The table beside it stays the accessible alternative — the chart never replaces the data,
 * it makes it readable at a glance.
 */
export function FunnelChart({
  data,
  title,
}: {
  data: Array<{ stage: string; count: number }>;
  title: string;
}) {
  const config = { count: { label: title, color: "var(--chart-1)" } } satisfies ChartConfig;

  return (
    <Card data-slot="funnel-chart" className="gap-2">
      <CardHeader>
        <CardTitle className="font-mono text-xs tracking-wider uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-64 w-full">
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{ left: 4, right: 12 }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="stage"
              type="category"
              tickLine={false}
              axisLine={false}
              width={110}
              className="font-mono"
            />
            <XAxis type="number" hide />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={2} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
