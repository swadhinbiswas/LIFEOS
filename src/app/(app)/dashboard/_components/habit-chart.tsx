"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * A real chart (spec §7.1: Recharts, themed to tokens) via the shadcn `chart` wrapper — the
 * reference is full of these and the dashboard had none. Data is derived server-side from the habit
 * log that already backs the streaks, so nothing here is invented.
 */
export function HabitChart({
  data,
  habitCount,
  title,
  description,
}: {
  data: Array<{ day: string; value: number }>;
  habitCount: number;
  title: string;
  description: string;
}) {
  const config = {
    value: { label: title, color: "var(--primary)" },
  } satisfies ChartConfig;

  return (
    <Card data-slot="habit-chart" className="gap-2">
      <CardHeader>
        <CardTitle className="font-mono text-xs tracking-wider uppercase">{title}</CardTitle>
        <CardDescription className="font-mono text-[10px]">{description}</CardDescription>
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
            <Bar dataKey="value" fill="var(--color-value)" radius={2} />
          </BarChart>
        </ChartContainer>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {habitCount} habits · {data.length} days
        </p>
      </CardContent>
    </Card>
  );
}
