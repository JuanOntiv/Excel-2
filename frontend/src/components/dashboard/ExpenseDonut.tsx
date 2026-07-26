import { PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer } from "recharts";
import type { PieSectorShapeProps } from "recharts";
import { Star } from "lucide-react";
import { formatCurrency } from "../../utils/date";
import { ChartTooltip } from "../charts/ChartTooltip";
import type { Transaction, Category } from "../../types";

interface Props {
  transactions: Transaction[]; // ya filtradas a egresos
  categories: Category[];
  title?: string;
}

// Mismo fallback que las otras gráficas: una categoría sin color propio se ve
// igual en toda la app.
const FALLBACK_COLORS = ["#2563eb", "#2dd4bf", "#dc2626", "#a855f7", "#f59e0b", "#059669", "#ec4899", "#78716c"];

// La categoría con mayor monto (índice 0, ya que `data` viene ordenado desc) se
// resalta afinando muy ligeramente el resto de las porciones, no ella misma.
const OTHER_SLICES_TRIM = 3;

function renderSlice({ index, outerRadius, ...rest }: PieSectorShapeProps) {
  return <Sector {...rest} outerRadius={index === 0 ? outerRadius : Number(outerRadius) - OTHER_SLICES_TRIM} />;
}

export function ExpenseDonut({ transactions, categories, title = "Distribución de gastos" }: Props) {
  const totals = new Map<string, number>();
  transactions.forEach((t) => {
    totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount);
  });

  const data = Array.from(totals, ([categoryId, value], i) => {
    const category = categories.find((c) => c.id === categoryId);
    return {
      name: category?.name ?? "Sin categoría",
      value,
      color: category?.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    };
  }).sort((a, b) => b.value - a.value);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5 flex items-center justify-center h-[240px] text-ink-muted-light dark:text-ink-muted-dark text-sm">
        Sin datos para mostrar
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <h3 className="text-base font-semibold text-ink-light dark:text-ink-dark mb-4">{title}</h3>

      <div className="flex items-center gap-5">
        {/* Dona con el total al centro */}
        <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={72} outerRadius={105} paddingAngle={2} shape={renderSlice}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke={i === 0 ? entry.color : "none"} strokeWidth={i === 0 ? 3 : 0} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm text-ink-muted-light dark:text-ink-muted-dark">Total</span>
            <span className="text-lg font-bold text-ink-light dark:text-ink-dark">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Leyenda a la derecha: nombre + monto por categoría */}
        <ul className="flex-1 min-w-0 flex flex-col gap-3 max-h-[220px] overflow-y-auto">
          {data.map((d, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 text-[15px] rounded-lg px-2 py-1"
              style={{ backgroundColor: i === 0 ? `color-mix(in srgb, ${d.color} 16%, transparent)` : undefined }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className={`truncate text-ink-light dark:text-ink-dark ${i === 0 ? "font-semibold" : "font-medium"}`}>
                  {d.name}
                </span>
                {i === 0 && <Star size={13} className="shrink-0" style={{ color: d.color, fill: d.color }} />}
              </span>
              <span className={`shrink-0 ${i === 0 ? "font-semibold text-ink-light dark:text-ink-dark" : "font-medium text-ink-muted-light dark:text-ink-muted-dark"}`}>
                {formatCurrency(d.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
