import { Search, X } from "lucide-react";
import type { Category, Transaction } from "../../types";
import { sanitizeAmountInput } from "../../utils/numberInput";

export interface TxFilters {
  name: string;
  categoryId: string;
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: TxFilters = {
  name: "",
  categoryId: "",
  minAmount: "",
  maxAmount: "",
  dateFrom: "",
  dateTo: "",
};

export function hasActiveFilters(f: TxFilters): boolean {
  return Boolean(f.name || f.categoryId || f.minAmount || f.maxAmount || f.dateFrom || f.dateTo);
}

// Aplica los filtros (client-side) sobre las transacciones ya cargadas.
export function applyFilters(transactions: Transaction[], f: TxFilters): Transaction[] {
  const name = f.name.trim().toLowerCase();
  const min = parseFloat(f.minAmount);
  const max = parseFloat(f.maxAmount);

  return transactions.filter((t) => {
    if (name && !t.name.toLowerCase().includes(name)) return false;
    if (f.categoryId && t.category_id !== f.categoryId) return false;
    if (!Number.isNaN(min) && t.amount < min) return false;
    if (!Number.isNaN(max) && t.amount > max) return false;
    const d = t.date.slice(0, 10); // YYYY-MM-DD
    if (f.dateFrom && d < f.dateFrom) return false;
    if (f.dateTo && d > f.dateTo) return false;
    return true;
  });
}

interface Props {
  filters: TxFilters;
  onChange: (f: TxFilters) => void;
  categories: Category[];
  resultCount: number;
  totalCount: number;
}

const inputClass =
  "px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent text-sm text-ink-light dark:text-ink-dark focus:outline-none focus:ring-2 focus:ring-accent";
const labelClass = "block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1";

export function TransactionFilters({ filters, onChange, categories, resultCount, totalCount }: Props) {
  const set = (patch: Partial<TxFilters>) => onChange({ ...filters, ...patch });
  const active = hasActiveFilters(filters);

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-4 mb-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Buscar por nombre */}
        <div className="flex-1 min-w-[180px]">
          <label className={labelClass}>Buscar</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted-light dark:text-ink-muted-dark" />
            <input
              value={filters.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Nombre..."
              className={`${inputClass} w-full pl-9`}
            />
          </div>
        </div>

        {/* Categoría */}
        <div className="min-w-[150px]">
          <label className={labelClass}>Categoría</label>
          <select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={`${inputClass} w-full`}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Rango de monto */}
        <div className="w-24">
          <label className={labelClass}>Monto mín</label>
          <input type="number" min="0" value={filters.minAmount} onChange={(e) => set({ minAmount: sanitizeAmountInput(e.target.value) })} placeholder="0" className={`${inputClass} w-full`} />
        </div>
        <div className="w-24">
          <label className={labelClass}>Monto máx</label>
          <input type="number" min="0" value={filters.maxAmount} onChange={(e) => set({ maxAmount: sanitizeAmountInput(e.target.value) })} placeholder="∞" className={`${inputClass} w-full`} />
        </div>

        {/* Rango de fecha */}
        <div>
          <label className={labelClass}>Desde</label>
          <input type="date" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Hasta</label>
          <input type="date" value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} className={inputClass} />
        </div>

        {active && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-ink-muted-light dark:text-ink-muted-dark hover:text-negative"
          >
            <X size={15} /> Limpiar
          </button>
        )}
      </div>

      {active && (
        <p className="mt-3 text-xs text-ink-muted-light dark:text-ink-muted-dark">
          Mostrando {resultCount} de {totalCount}
        </p>
      )}
    </div>
  );
}
