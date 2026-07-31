import { useMemo } from "react";
import { useTransactionsStore } from "../store/transactionsStore";
import { byWallet } from "../store/selectors";

// La cartera default es implicita: las transacciones nunca se vinculan a ella
// via Transaction_Wallets (ver services/wallet_assignment.py), asi que filtrar
// por su wallet_id devolveria vacio. Para la default se piden TODAS las
// transacciones del usuario, igual que hace el dashboard.
//
// Lee directo de la cache en memoria (ver store/transactionsStore).
export function useWalletTransactions(walletId: string, isDefault: boolean) {
  const items = useTransactionsStore((s) => s.items);
  const status = useTransactionsStore((s) => s.status);
  const error = useTransactionsStore((s) => s.error);

  const transactions = useMemo(
    () => (isDefault ? items : byWallet(items, walletId)),
    [items, isDefault, walletId]
  );

  return {
    transactions,
    isLoading: status === "idle" || status === "loading",
    error,
    reload: () => useTransactionsStore.getState().refresh(),
  };
}
