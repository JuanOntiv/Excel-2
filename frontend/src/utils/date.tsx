function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Periodos seleccionables en las vistas de Ingresos/Egresos.
// ---------------------------------------------------------------------------

export type Period = "week" | "month" | "quarter" | "half" | "year" | "all";

export interface PeriodRange {
  start_date: string;
  end_date: string;
}

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "quarter", label: "3 meses" },
  { value: "half", label: "6 meses" },
  { value: "year", label: "1 año" },
  { value: "all", label: "Todo" },
];

// Texto para adjuntar a un sustantivo ("Ingresos ${...}") describiendo el
// periodo seleccionado.
export const PERIOD_NOUN: Record<Period, string> = {
  week: "de la semana",
  month: "del mes",
  quarter: "de 3 meses",
  half: "de 6 meses",
  year: "del año",
  all: "(todo el periodo)",
};

// Texto para la comparación ("vs. ${...}") en las tarjetas con delta.
export const PERIOD_COMPARISON_LABEL: Record<Period, string> = {
  week: "semana anterior",
  month: "mes anterior",
  quarter: "trimestre anterior",
  half: "semestre anterior",
  year: "año anterior",
  all: "periodo anterior",
};

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function addMonths(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}

// Punto de inicio de una ventana de `period` de duración que TERMINA en `from`
// (inclusive). Todos los periodos son ventanas móviles de duración fija, no
// rangos alineados al calendario: "Mes" = últimos 30 días a partir de hoy, no
// "del 1 al día actual del mes".
function periodStart(from: Date, period: Period): Date {
  switch (period) {
    case "week":
      return addDays(from, -6);
    case "month":
      return addMonths(from, -1);
    case "quarter":
      return addMonths(from, -3);
    case "half":
      return addMonths(from, -6);
    case "year":
      return addMonths(from, -12);
    case "all":
    default:
      return new Date(2000, 0, 1);
  }
}

// Rango de fechas del periodo actual: ventana móvil que siempre termina hoy.
export function getPeriodRange(period: Period): PeriodRange {
  const end = new Date();
  const start = periodStart(end, period);
  return { start_date: formatDate(start), end_date: formatDate(end) };
}

// Rango del periodo INMEDIATAMENTE anterior (para comparar): misma duración,
// terminando justo un día antes de que empiece el periodo actual. null =
// "todo", que no tiene periodo previo.
export function getPreviousPeriodRange(period: Period): PeriodRange | null {
  if (period === "all") return null;

  const currentStart = new Date(getPeriodRange(period).start_date + "T00:00:00");
  const end = addDays(currentStart, -1);
  const start = periodStart(end, period);

  return { start_date: formatDate(start), end_date: formatDate(end) };
}

export function formatCurrency(amount: number): string {
  // Formato numerico neutral (sin atar la app a una moneda especifica):
  // agrupacion/decimales de es-MX con un simbolo $ generico antepuesto.
  // El signo va antes del simbolo (-$1,234.00), no despues.
  const formatted = new Intl.NumberFormat("es-MX", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return (amount < 0 ? "-$" : "$") + formatted;
}
