import { useState, useEffect, useCallback } from "react";
import { listTransactions } from "../api/transactions";
import type { Transaction, TransactionType } from "../types";

// Carga TODAS las transacciones del tipo, sin acotar por periodo, para que el
// historial (tabla) no dependa del selector de tiempo de las gráficas/tarjetas.
// walletId sí lo acota: es contexto, no filtro de periodo.
export function useAllTransactionsByType(type: TransactionType, walletId?: string | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listTransactions({
        type,
        limit: 5000,
        ...(walletId ? { wallet_id: walletId } : {}),
      });
      setTransactions(data);
    } catch {
      setError("No se pudieron cargar las transacciones.");
    } finally {
      setIsLoading(false);
    }
  }, [type, walletId]);

  useEffect(() => {
    load();
  }, [load]);

  return { transactions, isLoading, error, reload: load };
}
