import { create } from "zustand";
import {
  listWallets,
  createWallet as apiCreateWallet,
  updateWallet as apiUpdateWallet,
  deleteWallet as apiDeleteWallet,
} from "../api/wallets";
import type { Wallet } from "../types";

type Status = "idle" | "loading" | "ready" | "error";

interface WalletsState {
  items: Wallet[];
  status: Status;
  error: string | null;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  create: (payload: { name: string; description?: string }) => Promise<Wallet>;
  update: (id: string, payload: Partial<{ name: string; description: string }>) => Promise<Wallet>;
  remove: (id: string) => Promise<void>;
}

let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap(
  set: (partial: Partial<WalletsState> | ((s: WalletsState) => Partial<WalletsState>)) => void
) {
  set({ status: "loading", error: null });
  try {
    const items = await listWallets();
    set({ items, status: "ready" });
  } catch {
    set({ status: "error", error: "No se pudieron cargar las carteras." });
  } finally {
    bootstrapPromise = null;
  }
}

export const useWalletsStore = create<WalletsState>((set, get) => ({
  items: [],
  status: "idle",
  error: null,

  bootstrap: () => {
    if (bootstrapPromise) return bootstrapPromise;
    const { status } = get();
    if (status === "ready" || status === "loading") return Promise.resolve();
    bootstrapPromise = runBootstrap(set);
    return bootstrapPromise;
  },

  refresh: () => {
    bootstrapPromise = runBootstrap(set);
    return bootstrapPromise;
  },

  reset: () => {
    bootstrapPromise = null;
    set({ items: [], status: "idle", error: null });
  },

  create: async (payload) => {
    const created = await apiCreateWallet(payload);
    set((s) => ({ items: [...s.items, created] }));
    return created;
  },

  update: async (id, payload) => {
    const updated = await apiUpdateWallet(id, payload);
    set((s) => ({ items: s.items.map((w) => (w.id === id ? updated : w)) }));
    return updated;
  },

  remove: async (id) => {
    await apiDeleteWallet(id);
    set((s) => ({ items: s.items.filter((w) => w.id !== id) }));
  },
}));
