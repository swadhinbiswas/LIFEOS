"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/** Focus minutes per day for the last two weeks (spec §7.1: Recharts via shadcn's chart wrapper). */
export function FocusChart({
  data,
  title,
}: {
  data: Array<{ day: string; minutes: number }>;
  title: string;
}) {
  const config = { minutes: { label: title, color: "var(--chart-1)" } } satisfies ChartConfig;

  return (
    <Card data-slot="focus-chart" className="gap-2">
      <CardHeader>
        <CardTitle className="font-mono text-xs tracking-wider uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-40 w-full">
          <BarChart accessibilityLayer data={data} barCategoryGap={1}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              className="font-mono"
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="minutes" fill="var(--color-minutes)" radius={2} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
