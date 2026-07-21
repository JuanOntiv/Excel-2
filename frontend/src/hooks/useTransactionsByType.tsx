import { useState, useEffect, useCallback } from "react";
import { listTransactions } from "../api/transactions";
import { getPeriodRange, getPreviousPeriodRange } from "../utils/date";
import type { Transaction, TransactionType } from "../types";
import type { Period } from "../utils/date";

export function useTransactionsByType(type: TransactionType, period: Period) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Suma del periodo INMEDIATAMENTE anterior (para la comparación). null = el
  // periodo no tiene uno previo ("todo").
  const [previousTotal, setPreviousTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const range = getPeriodRange(period);
      const prevRange = getPreviousPeriodRange(period);

      const [current, previous] = await Promise.all([
        listTransactions({ ...range, limit: 5000 }),
        prevRange ? listTransactions({ ...prevRange, limit: 5000 }) : Promise.resolve([]),
      ]);

      setTransactions(current.filter((t) => t.type === type));

      if (prevRange) {
        const prevSum = previous
          .filter((t) => t.type === type)
          .reduce((s, t) => s + t.amount, 0);
        setPreviousTotal(prevSum);
      } else {
        setPreviousTotal(null);
      }
    } catch {
      setError("No se pudieron cargar las transacciones.");
    } finally {
      setIsLoading(false);
    }
  }, [type, period]);

  useEffect(() => {
    load();
  }, [load]);

  return { transactions, previousTotal, isLoading, error, reload: load };
}
