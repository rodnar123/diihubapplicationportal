"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/layout/empty-state";
import { BarChart3 } from "lucide-react";

/**
 * Dashboard charts.
 *
 * Every chart here answers "how many applications, broken down by X" — a
 * single series of magnitudes. So each uses **one** colour and lets the
 * category axis carry identity: colouring one bar per school would imply the
 * hue means something, and would repaint the survivors whenever a filter
 * changed the school count.
 *
 * Bars carry their value as a direct label, which is also what satisfies the
 * relief rule for the palette slots that sit below 3:1 on the light surface.
 */

const SINGLE_SERIES: ChartConfig = {
  count: { label: "Applications", color: "var(--chart-1)" },
};

function truncate(value: string, max = 22): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Horizontal bars: the right form when category names are long, because the
 * labels get a full line of reading width instead of being rotated.
 */
export function CategoryBarChart({
  data,
  emptyLabel,
  height,
}: {
  data: Array<{ label: string; count: number }>;
  emptyLabel: string;
  height?: number;
}) {
  if (data.length === 0) {
    return <EmptyState icon={BarChart3} title={emptyLabel} className="border-none" />;
  }

  const chartHeight = height ?? Math.max(140, data.length * 34 + 24);

  return (
    <ChartContainer config={SINGLE_SERIES} style={{ height: chartHeight }} className="w-full">
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 36, bottom: 4, left: 4 }}
        barCategoryGap={6}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={150}
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          tickFormatter={(value: string) => truncate(value)}
          className="text-xs"
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel={false} />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={22}>
          <LabelList
            dataKey="count"
            position="right"
            offset={8}
            className="fill-foreground text-xs tabular-nums"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/**
 * Vertical bars, for short ordinal categories such as year level.
 */
export function OrdinalBarChart({
  data,
  emptyLabel,
}: {
  data: Array<{ label: string; count: number }>;
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return <EmptyState icon={BarChart3} title={emptyLabel} className="border-none" />;
  }

  return (
    <ChartContainer config={SINGLE_SERIES} className="h-56 w-full">
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ top: 20, right: 8, bottom: 4, left: 4 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="text-xs"
        />
        <YAxis hide allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={48}>
          <LabelList
            dataKey="count"
            position="top"
            offset={6}
            className="fill-foreground text-xs tabular-nums"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/**
 * Submissions over time. A single filled line — no legend, because the card
 * title already names the one series.
 */
export function SubmissionTrendChart({
  data,
  emptyLabel,
}: {
  data: Array<{ date: string; count: number }>;
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return <EmptyState icon={BarChart3} title={emptyLabel} className="border-none" />;
  }

  const formatted = data.map((point) => ({
    ...point,
    label: new Date(point.date).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    }),
  }));

  return (
    <ChartContainer config={SINGLE_SERIES} className="h-56 w-full">
      <AreaChart accessibilityLayer data={formatted} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="submission-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          className="text-xs"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
          className="text-xs"
        />
        <ChartTooltip cursor content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--color-count)"
          strokeWidth={2}
          fill="url(#submission-fill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
