export function getCurrentMonthRange(): { start_date: string; end_date: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start_date: formatDate(start),
    end_date: formatDate(end),
  };
}

export function getPreviousMonthRange(): { start_date: string; end_date: string } {
  const now = new Date();
  // Día 0 del mes actual = último día del mes anterior.
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    start_date: formatDate(start),
    end_date: formatDate(end),
  };
}

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

// Rango de fechas del periodo actual.
export function getPeriodRange(period: Period): PeriodRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = now.getDate();
  let start: Date;
  let end: Date;

  switch (period) {
    case "week": {
      const dow = (now.getDay() + 6) % 7; // 0 = lunes
      start = new Date(y, m, day - dow);
      end = new Date(y, m, day - dow + 6);
      break;
    }
    case "month":
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0);
      break;
    case "quarter":
      start = new Date(y, m - 2, 1);
      end = new Date(y, m + 1, 0);
      break;
    case "half":
      start = new Date(y, m - 5, 1);
      end = new Date(y, m + 1, 0);
      break;
    case "year":
      start = new Date(y, m - 11, 1);
      end = new Date(y, m + 1, 0);
      break;
    case "all":
    default:
      start = new Date(2000, 0, 1);
      end = new Date(y, m + 1, 0);
      break;
  }

  return { start_date: formatDate(start), end_date: formatDate(end) };
}

// Rango del periodo INMEDIATAMENTE anterior (para comparar). null = "todo",
// que no tiene periodo previo.
export function getPreviousPeriodRange(period: Period): PeriodRange | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = now.getDate();
  let start: Date;
  let end: Date;

  switch (period) {
    case "week": {
      const dow = (now.getDay() + 6) % 7;
      end = new Date(y, m, day - dow - 1);
      start = new Date(y, m, day - dow - 7);
      break;
    }
    case "month":
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0);
      break;
    case "quarter":
      start = new Date(y, m - 5, 1);
      end = new Date(y, m - 2, 0);
      break;
    case "half":
      start = new Date(y, m - 11, 1);
      end = new Date(y, m - 5, 0);
      break;
    case "year":
      start = new Date(y, m - 23, 1);
      end = new Date(y, m - 11, 0);
      break;
    case "all":
    default:
      return null;
  }

  return { start_date: formatDate(start), end_date: formatDate(end) };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN", // ajusta si tu moneda es otra
  }).format(amount);
}
