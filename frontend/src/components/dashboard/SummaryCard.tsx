import type { ReactNode } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

type Tone = "neutral" | "positive" | "negative";

interface SummaryCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: Tone;
  /** Variación porcentual vs. el mes anterior. null = sin base para comparar. */
  delta?: number | null;
  /** Si subir es "bueno" (ingresos, balance) o "malo" (egresos). undefined = neutral. */
  higherIsBetter?: boolean;
}

const valueTone: Record<Tone, string> = {
  neutral: "text-ink-light dark:text-ink-dark",
  positive: "text-positive",
  negative: "text-negative",
};

// Círculo del ícono: mismo tono que el ícono, pero tenue de fondo.
const iconTone: Record<Tone, string> = {
  neutral: "bg-accent/10 text-accent",
  positive: "bg-positive/10 text-positive",
  negative: "bg-negative/10 text-negative",
};

function DeltaRow({ delta, higherIsBetter }: { delta?: number | null; higherIsBetter?: boolean }) {
  // undefined = el llamador no pidió comparación (ej. tarjetas sin periodo
  // previo): no se muestra nada. null = pidió comparación pero no hay base.
  if (delta === undefined) return null;

  if (delta === null) {
    return (
      <p className="mt-3 text-xs text-ink-muted-light dark:text-ink-muted-dark">
        Sin datos del mes anterior
      </p>
    );
  }

  const rounded = Math.round(delta * 10) / 10;
  const flat = rounded === 0;
  const up = rounded > 0;

  // Coloreo solo si sabemos si subir es bueno o malo; si no, queda neutral.
  let color = "text-ink-muted-light dark:text-ink-muted-dark";
  if (!flat && higherIsBetter !== undefined) {
    const good = up === higherIsBetter;
    color = good ? "text-positive" : "text-negative";
  }

  const Arrow = flat ? Minus : up ? ArrowUp : ArrowDown;

  return (
    <p className={`mt-3 text-sm font-medium flex items-center gap-1 ${color}`}>
      <Arrow size={15} className="shrink-0" />
      <span>
        {Math.abs(rounded)}% <span className="text-ink-muted-light dark:text-ink-muted-dark font-normal">vs. mes anterior</span>
      </span>
    </p>
  );
}

export function SummaryCard({ label, value, icon, tone = "neutral", delta, higherIsBetter }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[15px] font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">{label}</p>
          <p className={`text-3xl font-bold font-mono tabular-nums ${valueTone[tone]}`}>{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${iconTone[tone]}`}>
          {icon}
        </div>
      </div>
      <DeltaRow delta={delta} higherIsBetter={higherIsBetter} />
    </div>
  );
}
