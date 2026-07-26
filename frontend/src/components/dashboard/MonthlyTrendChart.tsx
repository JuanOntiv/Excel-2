import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartTooltip } from "../charts/ChartTooltip";
import { getPeriodRange, PERIOD_NOUN } from "../../utils/date";
import type { Period } from "../../utils/date";
import type { Transaction } from "../../types";

// Ingresos = verde, Egresos = rojo. Paleta validada para separación CVD (ver skill dataviz).
const COLORS = { income: "#047857", expense: "#dc2626" };

type Granularity = "day" | "week" | "month";

// Bucket por día para semana/mes (no se amontonan), por semana para 3-6 meses,
// y por mes para año/todo — evita cientos de barras/puntos diarios en rangos largos.
function granularityFor(period: Period): Granularity {
  if (period === "week" || period === "month") return "day";
  if (period === "quarter" || period === "half") return "week";
  return "month";
}

function mondayOf(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  const m = new Date(d);
  m.setDate(d.getDate() - day);
  return m;
}

function bucketKey(d: Date, g: Granularity): string {
  if (g === "day") return d.toISOString().slice(0, 10);
  if (g === "week") return mondayOf(d).toISOString().slice(0, 10);
  return d.toISOString().slice(0, 7);
}

function bucketLabel(d: Date, g: Granularity): string {
  if (g === "month") return d.toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

interface Bucket {
  label: string;
  income: number;
  expense: number;
}

function buildTrendData(transactions: Transaction[], period: Period): Bucket[] {
  const g = granularityFor(period);

  let start: Date;
  let end: Date;
  if (period === "all") {
    // Desde la transacción más antigua (evita décadas de buckets vacíos).
    const dates = transactions.map((t) => t.date.slice(0, 10)).sort();
    end = new Date();
    start = dates.length ? new Date(dates[0] + "T00:00:00") : end;
  } else {
    const r = getPeriodRange(period);
    start = new Date(r.start_date + "T00:00:00");
    end = new Date(r.end_date + "T00:00:00");
  }

  const totals = new Map<string, { income: number; expense: number }>();
  transactions.forEach((t) => {
    const d = new Date(t.date.slice(0, 10) + "T00:00:00");
    const key = bucketKey(d, g);
    const entry = totals.get(key) ?? { income: 0, expense: 0 };
    if (t.type === "income") entry.income += t.amount;
    else entry.expense += t.amount;
    totals.set(key, entry);
  });

  let cursor: Date;
  if (g === "week") cursor = mondayOf(start);
  else if (g === "month") cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  else cursor = new Date(start);

  const buckets: Bucket[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (cursor <= end && guard < 1000) {
    guard++;
    const key = bucketKey(cursor, g);
    if (!seen.has(key)) {
      seen.add(key);
      const e = totals.get(key) ?? { income: 0, expense: 0 };
      buckets.push({ label: bucketLabel(cursor, g), income: e.income, expense: e.expense });
    }
    if (g === "day") cursor.setDate(cursor.getDate() + 1);
    else if (g === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function compactTick(v: number): string {
  if (Math.abs(v) >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

export function MonthlyTrendChart({ transactions, period }: { transactions: Transaction[]; period: Period }) {
  const data = buildTrendData(transactions, period);
  const xInterval = data.length > 10 ? Math.floor(data.length / 10) : 0;

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <h3 className="text-base font-semibold text-ink-light dark:text-ink-dark mb-4">
        Tendencia {PERIOD_NOUN[period]}
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="currentColor"
            className="text-line-light dark:text-line-dark"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={xInterval}
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-ink-muted-light dark:text-ink-muted-dark"
          />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "currentColor" }}
            className="text-ink-muted-light dark:text-ink-muted-dark"
            tickFormatter={compactTick}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Area
            type="monotone"
            dataKey="income"
            name="Ingresos"
            stackId="1"
            stroke={COLORS.income}
            fill={COLORS.income}
            fillOpacity={0.35}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Egresos"
            stackId="1"
            stroke={COLORS.expense}
            fill={COLORS.expense}
            fillOpacity={0.35}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
