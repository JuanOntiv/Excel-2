import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartTooltip } from "../charts/ChartTooltip";
import type { Transaction, Category } from "../../types";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  title?: string;
}

// Fallback para categorías sin color asignado (ver boton de color en /categories).
const FALLBACK_COLORS = ["#2563eb", "#2dd4bf", "#dc2626", "#a855f7", "#f59e0b", "#059669", "#ec4899", "#78716c"];

export function CategoryPieChart({ transactions, categories, title = "Por categoría" }: Props) {
  const totals = new Map<string, number>();
  transactions.forEach((t) => {
    totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount);
  });

  const data = Array.from(totals, ([categoryId, total], i) => {
    const category = categories.find((c) => c.id === categoryId);
    return {
      name: category?.name ?? "Sin categoría",
      value: total,
      color: category?.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    };
  });

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5 flex items-center justify-center h-[240px] text-ink-muted-light dark:text-ink-muted-dark text-sm">
        Sin datos para mostrar
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <h3 className="text-sm font-medium text-ink-muted-light dark:text-ink-muted-dark mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
