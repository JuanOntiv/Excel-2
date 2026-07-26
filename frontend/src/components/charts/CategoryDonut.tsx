import { useState } from "react";
import { PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer } from "recharts";
import type { PieSectorShapeProps } from "recharts";
import { X, Star } from "lucide-react";
import { formatCurrency } from "../../utils/date";
import { categoryColor } from "../../utils/categoryColor";
import { ChartTooltip } from "./ChartTooltip";
import type { Transaction, Category } from "../../types";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  title?: string;
}

// La categoría con mayor monto (índice 0, ya que `data` viene ordenado desc) se
// resalta afinando muy ligeramente el resto de las porciones, no ella misma.
const OTHER_SLICES_TRIM = 3;

function renderSlice({ index, outerRadius, ...rest }: PieSectorShapeProps) {
  return <Sector {...rest} outerRadius={index === 0 ? outerRadius : Number(outerRadius) - OTHER_SLICES_TRIM} />;
}

// Cuántas categorías se muestran en la leyenda lateral antes de ofrecer "Ver detalle".
const LEGEND_LIMIT = 6;

interface Slice {
  name: string;
  value: number;
  color: string;
}

function LegendRow({ slice, isTop }: { slice: Slice; isTop?: boolean }) {
  return (
    <li
      className="flex items-center justify-between gap-2 text-[15px] rounded-lg px-2 py-1"
      style={{ backgroundColor: isTop ? `color-mix(in srgb, ${slice.color} 16%, transparent)` : undefined }}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
        <span className={`truncate text-ink-light dark:text-ink-dark ${isTop ? "font-semibold" : "font-medium"}`}>
          {slice.name}
        </span>
        {isTop && <Star size={13} className="shrink-0" style={{ color: slice.color, fill: slice.color }} />}
      </span>
      <span className={`shrink-0 ${isTop ? "font-semibold text-ink-light dark:text-ink-dark" : "font-medium text-ink-muted-light dark:text-ink-muted-dark"}`}>
        {formatCurrency(slice.value)}
      </span>
    </li>
  );
}

export function CategoryDonut({ transactions, categories, title = "Por categoría" }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

  const totals = new Map<string, number>();
  transactions.forEach((t) => {
    totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount);
  });

  const data: Slice[] = Array.from(totals, ([categoryId, value]) => {
    const category = categories.find((c) => c.id === categoryId);
    return {
      name: category?.name ?? "Sin categoría",
      value,
      color: categoryColor(categoryId, category?.color),
    };
  }).sort((a, b) => b.value - a.value);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5 flex items-center justify-center h-[280px] text-ink-muted-light dark:text-ink-muted-dark text-sm">
        Sin datos para mostrar
      </div>
    );
  }

  const visible = data.slice(0, LEGEND_LIMIT);
  const hasMore = data.length > LEGEND_LIMIT;

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <h3 className="text-base font-semibold text-ink-light dark:text-ink-dark mb-4">{title}</h3>

      <div className="flex items-center gap-5">
        {/* Dona con el total al centro */}
        <div className="relative shrink-0" style={{ width: 230, height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={76} outerRadius={110} paddingAngle={2} shape={renderSlice}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke={i === 0 ? entry.color : "none"} strokeWidth={i === 0 ? 3 : 0} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm text-ink-muted-light dark:text-ink-muted-dark">Total</span>
            <span className="text-xl font-bold text-ink-light dark:text-ink-dark">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Leyenda a la derecha */}
        <div className="flex-1 min-w-0">
          <ul className="flex flex-col gap-3">
            {visible.map((d, i) => (
              <LegendRow key={i} slice={d} isTop={i === 0} />
            ))}
          </ul>
          {hasMore && (
            <button
              onClick={() => setDetailOpen(true)}
              className="mt-3 text-sm font-medium text-accent hover:underline"
            >
              Ver detalle ({data.length})
            </button>
          )}
        </div>
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-surface-elevated-light dark:bg-surface-elevated-dark border border-line-light dark:border-line-dark p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-ink-light dark:text-ink-dark">{title}</h2>
              <button onClick={() => setDetailOpen(false)} className="text-ink-muted-light dark:text-ink-muted-dark">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-4">
              Total: <span className="font-semibold text-ink-light dark:text-ink-dark">{formatCurrency(total)}</span>
            </p>
            <ul className="flex flex-col gap-3">
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
                  <span className="shrink-0 text-ink-muted-light dark:text-ink-muted-dark">
                    {formatCurrency(d.value)}{" "}
                    <span className="text-xs">({total ? Math.round((d.value / total) * 100) : 0}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
