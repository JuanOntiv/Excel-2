import { create } from "zustand";
import {
  listCategories,
  createCategory as apiCreateCategory,
  updateCategory as apiUpdateCategory,
  deleteCategory as apiDeleteCategory,
  updateCategoryPreference as apiUpdateCategoryPreference,
} from "../api/categories";
import type { Category, CategoryType } from "../types";

type Status = "idle" | "loading" | "ready" | "error";

interface CategoriesState {
  // Siempre incluye ocultas (include_hidden=true): es el superset, y los
  // consumidores que solo quieren visibles filtran !c.is_hidden en cliente.
  items: Category[];
  status: Status;
  error: string | null;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  create: (name: string, type: CategoryType) => Promise<Category>;
  update: (
    id: string,
    payload: Partial<{ name: string; type: CategoryType; is_active: boolean }>
  ) => Promise<Category>;
  remove: (id: string) => Promise<void>;
  setPreference: (id: string, payload: Partial<{ is_hidden: boolean; color: string }>) => Promise<void>;
}

let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap(
  set: (partial: Partial<CategoriesState> | ((s: CategoriesState) => Partial<CategoriesState>)) => void
) {
  set({ status: "loading", error: null });
  try {
    const items = await listCategories(true);
    set({ items, status: "ready" });
  } catch {
    set({ status: "error", error: "No se pudieron cargar las categorías." });
  } finally {
    bootstrapPromise = null;
  }
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
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

  create: async (name, type) => {
    const created = await apiCreateCategory(name, type);
    set((s) => ({ items: [...s.items, created] }));
    return created;
  },

  update: async (id, payload) => {
    const updated = await apiUpdateCategory(id, payload);
    set((s) => ({ items: s.items.map((c) => (c.id === id ? updated : c)) }));
    return updated;
  },

  remove: async (id) => {
    await apiDeleteCategory(id);
    set((s) => ({ items: s.items.filter((c) => c.id !== id) }));
  },

  setPreference: async (id, payload) => {
    await apiUpdateCategoryPreference(id, payload);
    set((s) => ({
      items: s.items.map((c) => (c.id === id ? { ...c, ...payload } : c)),
    }));
  },
}));
