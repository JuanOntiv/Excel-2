import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { Transaction } from "../../types";

interface Props {
  transactions: Transaction[];
  color: string;
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

export function MonthlyChart({ transactions, color }: Props) {
  const monthKeys = getLast12MonthKeys();
  const totals = new Map<string, number>();

  transactions.forEach((t) => {
    const key = new Date(t.date).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  });

  const data = monthKeys.map((month) => ({ month, total: totals.get(month) ?? 0 }));

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <h3 className="text-sm font-medium text-ink-muted-light dark:text-ink-muted-dark mb-4">Por mes</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-light)" />
          <XAxis dataKey="month" fontSize={12} stroke="var(--color-ink-muted-light)" />
          <YAxis fontSize={12} stroke="var(--color-ink-muted-light)" />
          <Tooltip />
          <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
