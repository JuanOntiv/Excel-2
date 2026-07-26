import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { getPeriodRange } from "../../utils/date";
import type { Transaction } from "../../types";
import type { Period } from "../../utils/date";

interface Props {
  transactions: Transaction[];
  color: string;
  period: Period;
  // Prefijo opcional para distinguir gráficos del mismo periodo mostrados
  // lado a lado (ej. Ingresos/Egresos), ya que el título por defecto solo
  // describe la granularidad ("Por semana"), no el tipo de dato.
  title?: string;
}

interface Bucket {
  label: string;
  total: number;
}

type Granularity = "day" | "week" | "month";

const PX_PER_BAR = 28;

// Umbrales dinámicos según el rango real de días (no según el periodo elegido):
// < 3 meses -> día, 3 meses a 1 año -> semana, >= 1 año -> mes.
const WEEK_THRESHOLD_DAYS = 90;
const MONTH_THRESHOLD_DAYS = 365;

// Red de seguridad: si agrupando por mes aún hay más buckets que esto (ej.
// "Todo" con muchos años de historial), se permite scroll en vez de barras
// ilegibles.
const MAX_BUCKETS_BEFORE_SCROLL = 60;

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function monthShort(d: Date) {
  return d.toLocaleDateString("es-MX", { month: "short" });
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
}

function weekLabel(weekStart: Date, weekEnd: Date): string {
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth() && weekStart.getFullYear() === weekEnd.getFullYear();
  const year = weekEnd.getFullYear();
  if (sameMonth) {
    return `${weekStart.getDate()}–${weekEnd.getDate()} ${monthShort(weekEnd)} ${year}`;
  }
  return `${weekStart.getDate()} ${monthShort(weekStart)} – ${weekEnd.getDate()} ${monthShort(weekEnd)} ${year}`;
}

function granularityFor(start: Date, end: Date): Granularity {
  const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (spanDays >= MONTH_THRESHOLD_DAYS) return "month";
  if (spanDays >= WEEK_THRESHOLD_DAYS) return "week";
  return "day";
}

function buildBuckets(transactions: Transaction[], period: Period): { buckets: Bucket[]; granularity: Granularity } {
  const totals = new Map<string, number>();
  transactions.forEach((t) => {
    const key = t.date.slice(0, 10); // YYYY-MM-DD
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  });

  let start: Date;
  let end: Date;
  if (period === "all") {
    // Desde el día de la transacción más antigua (evita décadas de barras vacías).
    const keys = [...totals.keys()].sort();
    end = new Date();
    start = keys.length ? new Date(keys[0] + "T00:00:00") : end;
  } else {
    const r = getPeriodRange(period);
    start = new Date(r.start_date + "T00:00:00");
    end = new Date(r.end_date + "T00:00:00");
  }

  const granularity = granularityFor(start, end);

  if (granularity === "day") {
    const buckets: Bucket[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      buckets.push({
        label: d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
        total: totals.get(fmtDate(d)) ?? 0,
      });
    }
    return { buckets, granularity };
  }

  if (granularity === "week") {
    const buckets: Bucket[] = [];
    for (const weekStart = new Date(start); weekStart <= end; weekStart.setDate(weekStart.getDate() + 7)) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > end) weekEnd.setTime(end.getTime());

      let total = 0;
      for (const d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        total += totals.get(fmtDate(d)) ?? 0;
      }
      buckets.push({ label: weekLabel(weekStart, weekEnd), total });
    }
    return { buckets, granularity };
  }

  // month
  const monthTotals = new Map<string, number>();
  totals.forEach((amount, dateKey) => {
    const monthKey = dateKey.slice(0, 7); // YYYY-MM
    monthTotals.set(monthKey, (monthTotals.get(monthKey) ?? 0) + amount);
  });

  const buckets: Bucket[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ label: monthLabel(cursor), total: monthTotals.get(monthKey) ?? 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return { buckets, granularity };
}

const GRANULARITY_TITLE: Record<Granularity, string> = {
  day: "Por día",
  week: "Por semana",
  month: "Por mes",
};

export function TimeBarChart({ transactions, color, period, title }: Props) {
  const { buckets: data, granularity } = buildBuckets(transactions, period);
  // Semana/mes siempre caben sin scroll salvo un historial extremadamente
  // largo; día conserva el comportamiento con scroll de siempre.
  const needsScroll = granularity === "day" || data.length > MAX_BUCKETS_BEFORE_SCROLL;
  const chartWidth = needsScroll ? data.length * PX_PER_BAR : undefined;
  const heading = title ? `${title} · ${GRANULARITY_TITLE[granularity]}` : GRANULARITY_TITLE[granularity];

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <h3 className="text-base font-semibold text-ink-light dark:text-ink-dark mb-4">{heading}</h3>
      <div className={needsScroll ? "overflow-x-auto" : ""}>
        <div style={needsScroll ? { width: chartWidth, minWidth: "100%" } : undefined}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-line-light dark:text-line-dark" />
              <XAxis
                dataKey="label"
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
      </div>
    </div>
  );
}
