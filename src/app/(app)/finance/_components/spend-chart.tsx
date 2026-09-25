"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * Income vs spend for the month, per currency (spec §7.1: Recharts via shadcn's chart wrapper).
 * Amounts are major units here — the minor-unit arithmetic stays in the service.
 */
export function SpendChart({
  data,
  title,
  incomeLabel,
  spendLabel,
}: {
  data: Array<{ currency: string; income: number; spend: number }>;
  title: string;
  incomeLabel: string;
  spendLabel: string;
}) {
  const config = {
    income: { label: incomeLabel, color: "var(--primary)" },
    spend: { label: spendLabel, color: "var(--destructive)" },
  } satisfies ChartConfig;

  return (
    <Card data-slot="spend-chart" className="gap-2">
      <CardHeader>
        <CardTitle className="font-mono text-xs tracking-wider uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-40 w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="currency"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="font-mono"
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="income" fill="var(--color-income)" radius={2} />
            <Bar dataKey="spend" fill="var(--color-spend)" radius={2} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
