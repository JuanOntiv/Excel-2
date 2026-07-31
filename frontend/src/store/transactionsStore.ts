import { create } from "zustand";
import {
  listTransactions,
  createTransaction as apiCreateTransaction,
  updateTransaction as apiUpdateTransaction,
  deleteTransaction as apiDeleteTransaction,
} from "../api/transactions";
import { useGoalsStore } from "./goalsStore";
import type { Transaction, TransactionType } from "../types";

// Tamaño de cada lote: cubre de sobra el uso real de un usuario (cientos de
// movimientos), y sigue siendo barato si algún usuario acumula miles.
const PAGE_SIZE = 500;

type Status = "idle" | "loading" | "partial" | "ready" | "error";

interface TransactionsState {
  items: Transaction[];
  // "partial": el primer lote ya está disponible y la UI puede pintar,
  // pero siguen llegando lotes en segundo plano. "ready": todo cargado.
  status: Status;
  error: string | null;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  create: (payload: {
    name: string;
    description?: string;
    amount: number;
    date: string;
    type: TransactionType;
    category_id: string;
    wallet_id?: string | null;
  }) => Promise<Transaction>;
  update: (
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      amount: number;
      date: string;
      category_id: string;
      wallet_id: string | null;
    }>
  ) => Promise<Transaction>;
  remove: (id: string) => Promise<void>;
}

// Módulo-level, no en el store: evita que dos llamadas a bootstrap() en
// paralelo (AppShell se remonta en cada navegación entre rutas protegidas)
// disparen dos cargas completas a la vez.
let bootstrapPromise: Promise<void> | null = null;

// El backend devuelve las transacciones ordenadas por fecha desc; al insertar
// o editar una en memoria hay que reordenar para no romper esa invariante
// (una transacción con fecha vieja no debe quedarse al principio).
function sortByDateDesc(items: Transaction[]): Transaction[] {
  return [...items].sort((a, b) => b.date.localeCompare(a.date));
}

// Crear/editar/borrar una transacción cambia el progreso de las metas, y
// además el backend puede marcar una meta como ACHIEVED/FAILED en el acto
// (ver evaluate_goal_completions). Revalidamos en segundo plano: el progreso
// es información secundaria, no debe bloquear el toast de confirmación.
function invalidateGoals() {
  useGoalsStore.getState().revalidate().catch(() => {});
}

async function runBootstrap(
  set: (partial: Partial<TransactionsState> | ((s: TransactionsState) => Partial<TransactionsState>)) => void
) {
  set({ status: "loading", error: null });
  try {
    const first = await listTransactions({ skip: 0, limit: PAGE_SIZE });
    set({ items: first, status: first.length < PAGE_SIZE ? "ready" : "partial" });

    let skip = first.length;
    let batchLength = first.length;
    while (batchLength === PAGE_SIZE) {
      const batch = await listTransactions({ skip, limit: PAGE_SIZE });
      batchLength = batch.length;
      if (batchLength > 0) {
        set((s) => ({ items: [...s.items, ...batch] }));
        skip += batchLength;
      }
    }
    set({ status: "ready" });
  } catch {
    set({ status: "error", error: "No se pudieron cargar las transacciones." });
  } finally {
    bootstrapPromise = null;
  }
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  items: [],
  status: "idle",
  error: null,

  bootstrap: () => {
    if (bootstrapPromise) return bootstrapPromise;
    const { status } = get();
    if (status === "ready" || status === "partial" || status === "loading") {
      return Promise.resolve();
    }
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
    const created = await apiCreateTransaction(payload);
    set((s) => ({ items: sortByDateDesc([created, ...s.items]) }));
    invalidateGoals();
    return created;
  },

  update: async (id, payload) => {
    const updated = await apiUpdateTransaction(id, payload);
    set((s) => ({ items: sortByDateDesc(s.items.map((t) => (t.id === id ? updated : t))) }));
    invalidateGoals();
    return updated;
  },

  remove: async (id) => {
    await apiDeleteTransaction(id);
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    invalidateGoals();
  },
}));
