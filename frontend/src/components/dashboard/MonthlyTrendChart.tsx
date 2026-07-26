import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltip } from "../charts/ChartTooltip";
import type { Transaction } from "../../types";

// Ingresos = verde, Egresos = rojo, Diferencia = azul. Paleta validada para
// separación CVD (ver skill dataviz); la leyenda evita depender solo del color.
const COLORS = { income: "#047857", expense: "#dc2626", diff: "#2563eb" };

interface DayPoint {
  day: number;
  income: number;
  expense: number;
  diff: number;
  hasMovement: boolean;
}

function buildDailyData(transactions: Transaction[]): DayPoint[] {
  const today = new Date().getDate();
  const byDay = new Map<number, { income: number; expense: number }>();
  for (let d = 1; d <= today; d++) byDay.set(d, { income: 0, expense: 0 });

  transactions.forEach((t) => {
    // El día se lee del string ISO (YYYY-MM-DD...) para evitar desfases de zona
    // horaria al construir un Date.
    const day = Number(t.date.slice(8, 10));
    const entry = byDay.get(day);
    if (!entry) return;
    if (t.type === "income") entry.income += t.amount;
    else entry.expense += t.amount;
  });

  return Array.from(byDay, ([day, e]) => ({
    day,
    income: e.income,
    expense: e.expense,
    diff: e.income - e.expense,
    hasMovement: e.income > 0 || e.expense > 0,
  }));
}

// Dibuja un punto SOLO en los días con movimiento; los demás quedan sin punto.
function makeDot(color: string) {
  return function Dot(props: { cx?: number; cy?: number; index?: number; payload?: DayPoint }) {
    const { cx, cy, index, payload } = props;
    if (!payload?.hasMovement || cx == null || cy == null) return <g key={index} />;
    return <circle key={index} cx={cx} cy={cy} r={3.5} fill={color} />;
  };
}

function compactTick(v: number): string {
  if (Math.abs(v) >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

export function MonthlyTrendChart({ transactions }: { transactions: Transaction[] }) {
  const data = buildDailyData(transactions);

  // Muestra ~8 etiquetas en el eje X como máximo, para que los días no se
  // amontonen. Solo afecta al TEXTO: los puntos y las líneas se mantienen.
  const xInterval = data.length > 8 ? Math.floor(data.length / 8) : 0;

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <h3 className="text-base font-semibold text-ink-light dark:text-ink-dark mb-4">
        Tendencia del mes
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="currentColor"
            className="text-line-light dark:text-line-dark"
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            interval={xInterval}
            minTickGap={8}
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
          <Tooltip content={<ChartTooltip labelPrefix="Día " />} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Line type="monotone" dataKey="income" name="Ingresos" stroke={COLORS.income} strokeWidth={2} dot={makeDot(COLORS.income)} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="expense" name="Egresos" stroke={COLORS.expense} strokeWidth={2} dot={makeDot(COLORS.expense)} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="diff" name="Diferencia" stroke={COLORS.diff} strokeWidth={2} dot={makeDot(COLORS.diff)} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
