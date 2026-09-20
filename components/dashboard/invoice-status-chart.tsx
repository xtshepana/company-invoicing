"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  Draft: "#9ca3af",
  Sent: "#3b82f6",
  Paid: "#22c55e",
  Overdue: "#ef4444",
};

export function InvoiceStatusChart({
  draft,
  sent,
  paid,
  overdue,
}: {
  draft: number;
  sent: number;
  paid: number;
  overdue: number;
}) {
  const data = [
    { name: "Draft", value: draft },
    { name: "Sent", value: sent },
    { name: "Paid", value: paid },
    { name: "Overdue", value: overdue },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No invoices yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
