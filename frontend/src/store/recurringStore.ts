import { create } from "zustand";
import {
  listRecurring,
  createRecurring as apiCreateRecurring,
  updateRecurring as apiUpdateRecurring,
  cancelRecurring as apiCancelRecurring,
  pauseRecurring as apiPauseRecurring,
  resumeRecurring as apiResumeRecurring,
  executeRecurringNow as apiExecuteRecurringNow,
} from "../api/recurring";
import { useTransactionsStore } from "./transactionsStore";
import { useGoalsStore } from "./goalsStore";
import type { RecurringTransaction } from "../types";

// El backend limita a 100 por pagina por defecto; pedimos lotes grandes porque
// el volumen real de recurrencias es de decenas, no de miles.
const PAGE_SIZE = 500;

type Status = "idle" | "loading" | "ready" | "error";

interface RecurringState {
  items: RecurringTransaction[];
  status: Status;
  error: string | null;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  create: (payload: Parameters<typeof apiCreateRecurring>[0]) => Promise<RecurringTransaction>;
  update: (
    id: string,
    payload: Parameters<typeof apiUpdateRecurring>[1]
  ) => Promise<RecurringTransaction>;
  cancel: (id: string) => Promise<void>;
  pause: (id: string) => Promise<RecurringTransaction>;
  resume: (id: string) => Promise<RecurringTransaction>;
  executeNow: (id: string) => Promise<RecurringTransaction>;
}

let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap(
  set: (partial: Partial<RecurringState> | ((s: RecurringState) => Partial<RecurringState>)) => void
) {
  set({ status: "loading", error: null });
  try {
    // Se acumula todo antes de publicar: a diferencia de transactionsStore no
    // hay estado "partial" porque la lista es corta y, sobre todo, porque el
    // banner de pendientes se deriva de ella (ver pendingConfirmation en
    // store/selectors.ts) y un subconjunto se veria igual que "no hay ninguna".
    const items: RecurringTransaction[] = [];
    let batchLength = PAGE_SIZE;
    while (batchLength === PAGE_SIZE) {
      const batch = await listRecurring({ skip: items.length, limit: PAGE_SIZE });
      batchLength = batch.length;
      items.push(...batch);
    }
    set({ items, status: "ready" });
  } catch {
    set({ status: "error", error: "No se pudieron cargar las recurrencias." });
  } finally {
    bootstrapPromise = null;
  }
}

// Ejecutar una recurrencia crea una Transaction real (ver _execute_one en
// routes/recurring_transactions.py), la pasa por la asignacion de carteras y
// cambia el progreso de las metas. Nada de eso toca la fila de la recurrencia,
// asi que hay que invalidar esos dos stores a mano o quedan stale en silencio.
function invalidateAfterExecution() {
  useTransactionsStore.getState().refresh().catch(() => {});
  useGoalsStore.getState().revalidate().catch(() => {});
}

export const useRecurringStore = create<RecurringState>((set, get) => ({
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
    const created = await apiCreateRecurring(payload);
    // La lista viene ordenada por created_at desc, asi que lo nuevo va delante.
    set((s) => ({ items: [created, ...s.items] }));
    return created;
  },

  update: async (id, payload) => {
    const updated = await apiUpdateRecurring(id, payload);
    set((s) => ({ items: s.items.map((r) => (r.id === id ? updated : r)) }));
    return updated;
  },

  cancel: async (id) => {
    // DELETE /recurring-transactions/{id} no devuelve la fila, pero su unico
    // efecto es status -> cancelled (no es un soft delete: is_active sigue
    // true y la recurrencia se mantiene en el historial).
    await apiCancelRecurring(id);
    set((s) => ({
      items: s.items.map((r) => (r.id === id ? { ...r, status: "cancelled" as const } : r)),
    }));
  },

  pause: async (id) => {
    const updated = await apiPauseRecurring(id);
    set((s) => ({ items: s.items.map((r) => (r.id === id ? updated : r)) }));
    return updated;
  },

  resume: async (id) => {
    const updated = await apiResumeRecurring(id);
    set((s) => ({ items: s.items.map((r) => (r.id === id ? updated : r)) }));
    return updated;
  },

  executeNow: async (id) => {
    const updated = await apiExecuteRecurringNow(id);
    set((s) => ({ items: s.items.map((r) => (r.id === id ? updated : r)) }));
    invalidateAfterExecution();
    return updated;
  },
}));
