// Paleta usada como respaldo para categorías sin color propio asignado
// (columna `color` en `UserCategoryPreference` en null). Compartida por la
// página de categorías, las tablas y las gráficas para que una misma
// categoría se vea siempre del mismo color en toda la app.
const FALLBACK_COLORS = ["#2563eb", "#2dd4bf", "#dc2626", "#a855f7", "#f59e0b", "#059669", "#ec4899", "#78716c"];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Color determinístico por id: la misma categoría siempre cae en el mismo
// color del fallback, sin importar orden o posición en la lista donde se dibuje.
export function fallbackCategoryColor(categoryId: string): string {
  return FALLBACK_COLORS[hashString(categoryId) % FALLBACK_COLORS.length];
}

export function categoryColor(categoryId: string, color: string | null | undefined): string {
  return color ?? fallbackCategoryColor(categoryId);
}
