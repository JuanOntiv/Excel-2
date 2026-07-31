import { useMemo } from "react";
import { useCategoriesStore } from "../store/categoriesStore";

// Lee directo de la cache en memoria (ver store/categoriesStore), que siempre
// guarda el superset (incluye ocultas); este hook filtra en cliente cuando
// includeHidden=false, igual que hacía antes el include_hidden del backend.
export function useCategories(includeHidden = false) {
  const items = useCategoriesStore((s) => s.items);
  const status = useCategoriesStore((s) => s.status);
  const error = useCategoriesStore((s) => s.error);

  const categories = useMemo(
    () => (includeHidden ? items : items.filter((c) => !c.is_hidden)),
    [items, includeHidden]
  );

  return { categories, isLoading: status === "idle" || status === "loading", error };
}
