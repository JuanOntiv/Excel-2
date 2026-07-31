import { useWalletsStore } from "../store/walletsStore";

// Lee directo de la cache en memoria (ver store/walletsStore).
export function useWallets() {
  const wallets = useWalletsStore((s) => s.items);
  const status = useWalletsStore((s) => s.status);
  const error = useWalletsStore((s) => s.error);

  return { wallets, isLoading: status === "idle" || status === "loading", error };
}
