import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChartTooltip } from "../charts/ChartTooltip";
import type { Transaction } from "../../types";

interface Props {
  transactions: Transaction[];
  color: string;
  title?: string;
}

function getLast12MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(d.toLocaleDateString("es-MX", { month: "short", year: "2-digit" }));
  }
  return keys;
}

export function MonthlyChart({ transactions, color, title = "Por mes" }: Props) {
  const monthKeys = getLast12MonthKeys();
  const totals = new Map<string, number>();

  transactions.forEach((t) => {
    const key = new Date(t.date).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  });

  const data = monthKeys.map((month) => ({ month, total: totals.get(month) ?? 0 }));

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <h3 className="text-base font-semibold text-ink-light dark:text-ink-dark mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-line-light dark:text-line-dark" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-ink-muted-light dark:text-ink-muted-dark"
          />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-ink-muted-light dark:text-ink-muted-dark"
            tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
          />
          <Tooltip cursor={{ fill: "currentColor", opacity: 0.06 }} content={<ChartTooltip />} />
          <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
