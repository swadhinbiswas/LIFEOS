"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * Income vs spend over the last months (spec §7.1: Recharts via shadcn's chart wrapper). Amounts are
 * major units; the minor-unit arithmetic and the currency choice stay in `monthlyFlows`.
 */
export function SpendHistory({
  data,
  title,
  incomeLabel,
  spendLabel,
  currency,
}: {
  data: Array<{ month: string; income: number; spend: number }>;
  title: string;
  incomeLabel: string;
  spendLabel: string;
  currency: string;
}) {
  const config = {
    income: { label: incomeLabel, color: "var(--chart-1)" },
    spend: { label: spendLabel, color: "var(--chart-4)" },
  } satisfies ChartConfig;

  return (
    <Card data-slot="spend-history" className="gap-2">
      <CardHeader>
        <CardTitle className="font-mono text-xs tracking-wider uppercase">
          {title} · {currency}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-40 w-full">
          <LineChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="font-mono"
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey="income"
              type="monotone"
              stroke="var(--color-income)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="spend"
              type="monotone"
              stroke="var(--color-spend)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
