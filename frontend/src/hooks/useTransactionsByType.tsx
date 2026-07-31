import { useMemo } from "react";
import { useTransactionsStore } from "../store/transactionsStore";
import { byType, byWallet, byPeriod } from "../store/selectors";
import { getPeriodRange, getPreviousPeriodRange } from "../utils/date";
import type { Transaction, TransactionType } from "../types";
import type { Period } from "../utils/date";

// walletId acota a una cartera concreta (server-side, via Transaction_Wallets).
// null/undefined = todas, que es el comportamiento de la cartera default.
//
// Lee directo de la cache en memoria (ver store/transactionsStore): cambiar
// de periodo/tipo/cartera solo recalcula filtros, no dispara requests.
export function useTransactionsByType(type: TransactionType, period: Period, walletId?: string | null) {
  const items = useTransactionsStore((s) => s.items);
  const status = useTransactionsStore((s) => s.status);
  const error = useTransactionsStore((s) => s.error);

  const scoped = useMemo(() => byWallet(byType(items, type), walletId), [items, type, walletId]);

  const range = useMemo(() => getPeriodRange(period), [period]);
  const prevRange = useMemo(() => getPreviousPeriodRange(period), [period]);

  const transactions = useMemo(() => byPeriod(scoped, range), [scoped, range]);

  // Movimientos del periodo anterior (para calcular su propio promedio
  // mensual, no solo la suma). null = el periodo no tiene uno previo ("todo").
  const previousTransactions: Transaction[] = useMemo(
    () => (prevRange ? byPeriod(scoped, prevRange) : []),
    [scoped, prevRange]
  );

  const previousTotal = prevRange
    ? previousTransactions.reduce((s, t) => s + t.amount, 0)
    : null;

  return {
    transactions,
    previousTotal,
    previousTransactions,
    isLoading: status === "idle" || status === "loading",
    error,
    reload: () => useTransactionsStore.getState().refresh(),
  };
}
