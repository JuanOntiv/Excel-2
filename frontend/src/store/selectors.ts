import type { Transaction, TransactionType } from "../types";
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
