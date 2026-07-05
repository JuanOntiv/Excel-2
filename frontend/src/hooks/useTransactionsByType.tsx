import { useState, useEffect, useCallback } from "react";
import { listTransactions } from "../api/transactions";
import type { Transaction, TransactionType } from "../types";

function getLast12MonthsRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  const format = (d: Date) => d.toISOString().split("T")[0];
  return { start_date: format(start), end_date: format(end) };
}

export function useTransactionsByType(type: TransactionType) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const range = getLast12MonthsRange();
      const data = await listTransactions({ ...range, limit: 1000 });
      setTransactions(data.filter((t) => t.type === type));
    } catch {
      setError("No se pudieron cargar las transacciones.");
    } finally {
      setIsLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  return { transactions, isLoading, error, reload: load };
}
