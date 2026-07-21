import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { getPeriodRange } from "../../utils/date";
import type { Transaction } from "../../types";
import type { Period } from "../../utils/date";

interface Props {
  transactions: Transaction[];
  color: string;
  period: Period;
}

interface Bucket {
  label: string;
  total: number;
}

const PX_PER_BAR = 28;

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function buildBuckets(transactions: Transaction[], period: Period): Bucket[] {
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

  const buckets: Bucket[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    buckets.push({
      label: d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
      total: totals.get(fmtDate(d)) ?? 0,
    });
  }
  return buckets;
}

export function TimeBarChart({ transactions, color, period }: Props) {
  const data = buildBuckets(transactions, period);
  const chartWidth = Math.max(data.length * PX_PER_BAR, 0);

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <h3 className="text-base font-semibold text-ink-light dark:text-ink-dark mb-4">Por día</h3>
      <div className="overflow-x-auto">
        <div style={{ width: chartWidth, minWidth: "100%" }}>
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
