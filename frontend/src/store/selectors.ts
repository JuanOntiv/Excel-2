import type { RecurringTransaction, Transaction, TransactionType } from "../types";
import type { PeriodRange } from "../utils/date";

export function byType(transactions: Transaction[], type: TransactionType): Transaction[] {
  return transactions.filter((t) => t.type === type);
}

// wallet_ids trae TODAS las asignaciones (manual + por regla), igual que el
// filtro ?wallet_id= del backend (ver TransactionRead.wallet_ids).
export function byWallet(transactions: Transaction[], walletId?: string | null): Transaction[] {
  if (!walletId) return transactions;
  return transactions.filter((t) => t.wallet_ids.includes(walletId));
}

export function byPeriod(transactions: Transaction[], range: PeriodRange): Transaction[] {
  return transactions.filter((t) => {
    const d = t.date.slice(0, 10); // YYYY-MM-DD, ver TransactionFilters.applyFilters
    return d >= range.start_date && d <= range.end_date;
  });
}

// Fecha local en YYYY-MM-DD. NO se usa toISOString() (como formatDate en
// utils/date) porque eso convierte a UTC: a las 19:00 en México ya devolvería
// el día siguiente.
function todayLocal(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/**
 * Equivalente en cliente de GET /recurring-transactions/pending-confirmation/list:
 * recurrencias activas con auto_execute=false cuya next_execution ya venció, es
 * decir las que esperan confirmación manual del usuario.
 *
 * Mismo predicado que el backend, con una diferencia deliberada: "hoy" es la
 * fecha del navegador, no `date.today()` del servidor. Si ambos están en husos
 * distintos el banner puede adelantarse o atrasarse unas horas en el límite del
 * día; se aceptó a cambio de no gastar una petición por visita. La ejecución
 * real la sigue decidiendo el servidor, esto solo decide qué se muestra.
 */
export function pendingConfirmation(items: RecurringTransaction[]): RecurringTransaction[] {
  const today = todayLocal();
  return items.filter(
    (r) =>
      r.is_active &&
      r.status === "active" &&
      !r.auto_execute &&
      r.next_execution.slice(0, 10) <= today
  );
}

/** Redondeo a centavos: sumar floats en JS da 1234.5600000000002, y sin esto
 *  un balance que debería ser exactamente 0 puede formatearse como "-$0.00". */
function toCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export interface Summary {
  total_income: number;
  total_expenses: number;
  balance: number;
  count: number;
}

/**
 * Equivalente en cliente de GET /transactions/summary.
 *
 * Es exacto, no una aproximación: ese endpoint filtra por user_id + is_active
 * (sin acotar por tipo ni cartera), que es justamente el conjunto que carga en
 * memoria transactionsStore. Solo vale cuando el store terminó de cargar
 * (status "ready"); con una carga parcial daría totales incompletos.
 */
export function summarize(transactions: Transaction[]): Summary {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (t.type === "income") income += t.amount;
    else expenses += t.amount;
  }
  return {
    total_income: toCents(income),
    total_expenses: toCents(expenses),
    balance: toCents(income - expenses),
    count: transactions.length,
  };
}
