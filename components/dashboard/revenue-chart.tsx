"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/money";

export interface RevenueChartPoint {
  label: string;
  invoiced: number;
  paid: number;
}

export function RevenueChart({ data, currency }: { data: RevenueChartPoint[]; currency: string }) {
  if (data.every((point) => point.invoiced === 0 && point.paid === 0)) {
    return <p className="text-sm text-muted-foreground">Not enough data yet to chart revenue.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="invoicedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="var(--muted-foreground)"
          tickFormatter={(value: number) => formatCurrency(value, currency).replace(/\.00$/, "")}
          width={70}
        />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value) || 0, currency)}
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="invoiced"
          name="Invoiced"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#invoicedFill)"
        />
        <Area
          type="monotone"
          dataKey="paid"
          name="Paid"
          stroke="var(--muted-foreground)"
          strokeWidth={2}
          strokeDasharray="4 3"
          fill="none"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
