import { useState, useEffect, useCallback } from "react";
import { listTransactions } from "../api/transactions";
import type { Transaction } from "../types";

// La cartera default es implicita: las transacciones nunca se vinculan a ella
// via Transaction_Wallets (ver services/wallet_assignment.py), asi que filtrar
// por su wallet_id devolveria vacio. Para la default se piden TODAS las
// transacciones del usuario, igual que hace el dashboard.
export function useWalletTransactions(walletId: string, isDefault: boolean) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listTransactions(
        isDefault ? { limit: 1000 } : { wallet_id: walletId, limit: 1000 }
      );
      setTransactions(data);
    } catch {
      setError("No se pudieron cargar las transacciones de esta cartera.");
    } finally {
      setIsLoading(false);
    }
  }, [walletId, isDefault]);

  useEffect(() => {
    load();
  }, [load]);

  return { transactions, isLoading, error, reload: load };
}
