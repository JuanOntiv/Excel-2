import { useMemo } from "react";
import { useTransactionsStore } from "../store/transactionsStore";
import { byType, byWallet } from "../store/selectors";
import type { TransactionType } from "../types";

// Carga TODAS las transacciones del tipo, sin acotar por periodo, para que el
// historial (tabla) no dependa del selector de tiempo de las gráficas/tarjetas.
// walletId sí lo acota: es contexto, no filtro de periodo.
//
// Lee directo de la cache en memoria (ver store/transactionsStore): no hace
// fetch propio, así que cambiar de tipo/cartera es instantáneo.
export function useAllTransactionsByType(type: TransactionType, walletId?: string | null) {
  const items = useTransactionsStore((s) => s.items);
  const status = useTransactionsStore((s) => s.status);
  const error = useTransactionsStore((s) => s.error);

  const transactions = useMemo(
    () => byWallet(byType(items, type), walletId),
    [items, type, walletId]
  );

  return {
    transactions,
    isLoading: status === "idle" || status === "loading",
    error,
    reload: () => useTransactionsStore.getState().refresh(),
  };
}
