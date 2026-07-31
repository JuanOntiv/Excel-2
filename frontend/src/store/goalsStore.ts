import { create } from "zustand";
import {
  listGoals,
  createGoal as apiCreateGoal,
  updateGoal as apiUpdateGoal,
  cancelGoal as apiCancelGoal,
  deleteGoal as apiDeleteGoal,
} from "../api/goals";
import type { GoalPayload } from "../api/goals";
import type { GoalProgress } from "../types";

type Status = "idle" | "loading" | "ready" | "error";

interface GoalsState {
  // Incluye el progreso (current_amount/percentage/is_on_track) calculado en
  // el servidor. NO se recalcula en cliente a propósito: la semántica de las
  // metas (y las transiciones de status ACHIEVED/FAILED que dispara) vive en
  // services/goals.py, y duplicarla aquí se desincronizaría en silencio.
  items: GoalProgress[];
  status: Status;
  error: string | null;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  // Refetch sin pasar por "loading": para invalidaciones en segundo plano
  // (ej. tras mutar una transacción) que no deben provocar un parpadeo.
  revalidate: () => Promise<void>;
  reset: () => void;
  create: (payload: GoalPayload) => Promise<void>;
  update: (id: string, payload: Partial<GoalPayload>) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let bootstrapPromise: Promise<void> | null = null;

async function runLoad(
  set: (partial: Partial<GoalsState>) => void,
  { silent }: { silent: boolean } = { silent: false }
) {
  if (!silent) set({ status: "loading", error: null });
  try {
    const items = await listGoals();
    set({ items, status: "ready", error: null });
  } catch {
    // En un revalidate silencioso conservamos lo que ya había en pantalla:
    // es preferible un número de hace un momento a vaciar la vista.
    if (silent) return;
    set({ status: "error", error: "No se pudieron cargar las metas." });
  } finally {
    bootstrapPromise = null;
  }
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  items: [],
  status: "idle",
  error: null,

  bootstrap: () => {
    if (bootstrapPromise) return bootstrapPromise;
    const { status } = get();
    if (status === "ready" || status === "loading") return Promise.resolve();
    bootstrapPromise = runLoad(set);
    return bootstrapPromise;
  },

  refresh: () => {
    bootstrapPromise = runLoad(set);
    return bootstrapPromise;
  },

  revalidate: () => runLoad(set, { silent: true }),

  reset: () => {
    bootstrapPromise = null;
    set({ items: [], status: "idle", error: null });
  },

  // Toda mutación relee la lista completa en vez de parchear en memoria: el
  // progreso de CUALQUIER meta puede cambiar, y una sola petición ya lo trae
  // todo recalculado por el servidor.
  create: async (payload) => {
    await apiCreateGoal(payload);
    await runLoad(set, { silent: true });
  },

  update: async (id, payload) => {
    await apiUpdateGoal(id, payload);
    await runLoad(set, { silent: true });
  },

  cancel: async (id) => {
    await apiCancelGoal(id);
    await runLoad(set, { silent: true });
  },

  remove: async (id) => {
    await apiDeleteGoal(id);
    await runLoad(set, { silent: true });
  },
}));
