import { formatCurrency } from "../../utils/date";

// Tooltip común para todas las gráficas. Recharts trae uno con fondo blanco fijo
// que se ve mal en modo oscuro; este usa los tokens (surface/ink/line) y respeta
// la clase .dark. Recharts inyecta active/payload/label al clonar el elemento.
interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { color?: string; fill?: string };
}

interface Props {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelPrefix?: string;
}

export function ChartTooltip({ active, payload, label, labelPrefix }: Props) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark px-3 py-2 shadow-md text-sm">
      {label != null && label !== "" && (
        <p className="mb-1 font-medium text-ink-light dark:text-ink-dark">
          {labelPrefix}
          {label}
        </p>
      )}
      {payload.map((entry, i) => {
        const color = entry.color ?? entry.payload?.color ?? entry.payload?.fill;
        return (
          <p key={i} className="flex items-center gap-2">
            {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
            {entry.name && <span className="text-ink-muted-light dark:text-ink-muted-dark">{entry.name}:</span>}
            <span className="font-medium text-ink-light dark:text-ink-dark">{formatCurrency(Number(entry.value))}</span>
          </p>
        );
      })}
    </div>
  );
}
