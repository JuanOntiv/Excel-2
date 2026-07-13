import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "../../utils/date";
import type { Transaction, Category } from "../../types";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
}

const PAGE_SIZE = 8;

export function TransactionTable({ transactions, categories, onEdit, onDelete }: Props) {
  const [page, setPage] = useState(0);
  const showActions = Boolean(onEdit || onDelete);

  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = sorted.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  function categoryColor(id: string) {
    return categories.find((c) => c.id === id)?.color ?? null;
  }

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-light dark:border-line-dark text-left text-ink-muted-light dark:text-ink-muted-dark">
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Categoría</th>
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3 font-medium text-right">Monto</th>
            {showActions && <th className="px-4 py-3 font-medium text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {pageItems.length === 0 && (
            <tr>
              <td colSpan={showActions ? 5 : 4} className="px-4 py-8 text-center text-ink-muted-light dark:text-ink-muted-dark">
                Sin transacciones registradas todavía.
              </td>
            </tr>
          )}
          {pageItems.map((t) => (
            <tr key={t.id} className="border-b border-line-light dark:border-line-dark last:border-0">
              <td className="px-4 py-3">{t.name}</td>
              <td className="px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">
                <span className="inline-flex items-center gap-2">
                  {categoryColor(t.category_id) && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: categoryColor(t.category_id)! }}
                    />
                  )}
                  {categoryName(t.category_id)}
                </span>
              </td>
              <td className="px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">{new Date(t.date).toLocaleDateString("es-MX")}</td>
              <td className="px-4 py-3 text-right font-medium">{formatCurrency(t.amount)}</td>
              {showActions && (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {onEdit && (
                      <button onClick={() => onEdit(t)} className="text-ink-muted-light dark:text-ink-muted-dark hover:text-accent">
                        <Pencil size={16} />
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(t)} className="text-ink-muted-light dark:text-ink-muted-dark hover:text-negative">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-line-light dark:border-line-dark text-sm text-ink-muted-light dark:text-ink-muted-dark">
          <span>Página {currentPage + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="px-3 py-1 rounded-lg border border-line-light dark:border-line-dark disabled:opacity-40">
              Anterior
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1} className="px-3 py-1 rounded-lg border border-line-light dark:border-line-dark disabled:opacity-40">
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
