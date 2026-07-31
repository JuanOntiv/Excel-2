import { Fragment, useState, useEffect } from "react";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "../../utils/date";
import { categoryColor } from "../../utils/categoryColor";
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
  const [pageInput, setPageInput] = useState("1");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const showActions = Boolean(onEdit || onDelete);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Al cambiar el nº de resultados (ej. al aplicar/quitar un filtro), vuelve a
  // la primera página para no quedar en una página que ya no existe.
  useEffect(() => {
    setPage(0);
  }, [transactions.length]);

  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = sorted.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  // El input de página se mantiene en sincronía con la página actual salvo
  // mientras el usuario está escribiendo en él.
  useEffect(() => {
    setPageInput(String(currentPage + 1));
  }, [currentPage]);

  // Cambia de página mientras se escribe, sin esperar Enter/blur.
  function handlePageInputChange(value: string) {
    setPageInput(value);
    if (value.trim() === "") return;
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return;
    setPage(Math.min(Math.max(n, 1), totalPages) - 1);
  }

  // Si se deja el campo vacío o inválido, vuelve a mostrar la página actual.
  function handlePageInputBlur() {
    const n = parseInt(pageInput, 10);
    if (Number.isNaN(n)) setPageInput(String(currentPage + 1));
  }

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  function categoryColorFor(id: string) {
    return categoryColor(id, categories.find((c) => c.id === id)?.color);
  }

  return (
    // Categoría y Fecha se ocultan en pantallas angostas: ambas siguen
    // disponibles al desplegar la fila, así que la tabla cabe sin scroll
    // horizontal en móvil en vez de aplastar Concepto y Monto.
    // Ojo: el ancho útil no crece de forma monótona con el viewport (a partir
    // de `md` aparece el sidebar de 14rem), por eso Categoría espera hasta `lg`.
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-light dark:border-line-dark text-left text-ink-muted-light dark:text-ink-muted-dark">
            <th className="px-2 sm:px-4 py-3 font-medium w-8" />
            <th className="px-2 sm:px-4 py-3 font-medium">Concepto</th>
            <th className="hidden lg:table-cell px-4 py-3 font-medium">Categoría</th>
            <th className="hidden sm:table-cell px-4 py-3 font-medium">Fecha</th>
            <th className="px-2 sm:px-4 py-3 font-medium text-right">Monto</th>
            {showActions && <th className="px-2 sm:px-4 py-3 font-medium text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {pageItems.length === 0 && (
            <tr>
              <td colSpan={showActions ? 6 : 5} className="px-4 py-8 text-center text-ink-muted-light dark:text-ink-muted-dark">
                Sin transacciones registradas todavía.
              </td>
            </tr>
          )}
          {pageItems.map((t) => {
            const isExpanded = expandedIds.has(t.id);
            return (
            <Fragment key={t.id}>
            <tr className="border-b border-line-light dark:border-line-dark last:border-0">
              <td className="px-2 sm:px-4 py-3">
                <button
                  onClick={() => toggleExpanded(t.id)}
                  title={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                  className="cursor-pointer p-2 -m-2 rounded-lg text-ink-muted-light dark:text-ink-muted-dark hover:text-accent hover:bg-line-light/40 dark:hover:bg-line-dark/40"
                >
                  <ChevronRight size={16} className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                </button>
              </td>
              <td className="px-2 sm:px-4 py-3">
                <span className="inline-flex items-center gap-2 break-words">{t.name}</span>
              </td>
              <td className="hidden lg:table-cell px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: categoryColorFor(t.category_id) }}
                  />
                  {categoryName(t.category_id)}
                </span>
              </td>
              <td className="hidden sm:table-cell px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark whitespace-nowrap">{new Date(t.date).toLocaleDateString("es-MX")}</td>
              <td className="px-2 sm:px-4 py-3 text-right font-medium font-mono tabular-nums whitespace-nowrap">{formatCurrency(t.amount)}</td>
              {showActions && (
                <td className="px-2 sm:px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {onEdit && (
                      <button onClick={() => onEdit(t)} className="cursor-pointer text-ink-muted-light dark:text-ink-muted-dark hover:text-accent">
                        <Pencil size={16} />
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(t)} className="cursor-pointer text-ink-muted-light dark:text-ink-muted-dark hover:text-negative">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
            <tr
              className={`border-line-light dark:border-line-dark last:border-0 transition-colors duration-200 ${
                isExpanded ? "border-b bg-surface-light/60 dark:bg-surface-dark/40" : ""
              }`}
            >
              <td className="px-2 sm:px-4" />
              <td colSpan={showActions ? 5 : 4} className="px-2 sm:px-4 pr-4">
                <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm py-4">
                      <div>
                        <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Concepto</span>
                        <span className="inline-flex items-center gap-2 text-ink-light dark:text-ink-dark">{t.name}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Categoría</span>
                        <span className="inline-flex items-center gap-2 text-ink-light dark:text-ink-dark">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: categoryColorFor(t.category_id) }}
                          />
                          {categoryName(t.category_id)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Fecha</span>
                        <span className="text-ink-light dark:text-ink-dark">{new Date(t.date).toLocaleDateString("es-MX")}</span>
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Monto</span>
                        <span className="font-medium font-mono tabular-nums text-ink-light dark:text-ink-dark">{formatCurrency(t.amount)}</span>
                      </div>
                      <div className="col-span-2 sm:col-span-4">
                        <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Descripción</span>
                        <span className="text-ink-light dark:text-ink-dark">{t.description || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
            </Fragment>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-line-light dark:border-line-dark text-sm text-ink-muted-light dark:text-ink-muted-dark">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            aria-label="Página anterior"
            className="p-2 rounded-lg border border-line-light dark:border-line-dark hover:bg-line-light/40 dark:hover:bg-line-dark/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => handlePageInputChange(e.target.value)}
              onBlur={handlePageInputBlur}
              className="w-14 px-2 py-1 rounded-lg border border-line-light dark:border-line-dark bg-transparent text-center text-ink-light dark:text-ink-dark focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <span>de {totalPages}</span>
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            aria-label="Página siguiente"
            className="p-2 rounded-lg border border-line-light dark:border-line-dark hover:bg-line-light/40 dark:hover:bg-line-dark/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
