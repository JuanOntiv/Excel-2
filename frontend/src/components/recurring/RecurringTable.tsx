import { Fragment, useState } from "react";
import { Pencil, Pause, Play, XCircle, Zap, ZapOff, ChevronRight } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency } from "../../utils/date";
import { categoryColor } from "../../utils/categoryColor";
import type { RecurringTransaction, Category } from "../../types";

interface Props {
  items: RecurringTransaction[];
  categories: Category[];
  onEdit: (t: RecurringTransaction) => void;
  onPause: (t: RecurringTransaction) => void;
  onResume: (t: RecurringTransaction) => void;
  onCancel: (t: RecurringTransaction) => void;
  onExecuteNow: (t: RecurringTransaction) => void;
}

const frequencyLabels: Record<string, string> = {
  Daily: "Diaria", Weekly: "Semanal", Biweekly: "Quincenal", Monthly: "Mensual", Yearly: "Anual",
};

export function RecurringTable({ items, categories, onEdit, onPause, onResume, onCancel, onExecuteNow }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  function categoryColorFor(id: string) {
    return categoryColor(id, categories.find((c) => c.id === id)?.color);
  }

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {/* 9 columnas no caben en móvil ni de lejos. Se van ocultando de menos
              a más relevante conforme se estrecha; todas siguen visibles al
              desplegar la fila. El salto a `xl` es porque el sidebar (14rem)
              se come ancho útil justo a partir de `md`. */}
          <tr className="border-b border-line-light dark:border-line-dark text-left text-ink-muted-light dark:text-ink-muted-dark">
            <th className="px-2 sm:px-4 py-3 font-medium w-8" />
            <th className="px-2 sm:px-4 py-3 font-medium">Concepto</th>
            <th className="hidden xl:table-cell px-4 py-3 font-medium">Categoría</th>
            <th className="hidden lg:table-cell px-4 py-3 font-medium">Frecuencia</th>
            <th className="hidden lg:table-cell px-4 py-3 font-medium">Próxima ejecución</th>
            <th className="hidden sm:table-cell px-4 py-3 font-medium">Estado</th>
            <th className="hidden xl:table-cell px-4 py-3 font-medium">Automática</th>
            <th className="px-2 sm:px-4 py-3 font-medium text-right">Monto</th>
            <th className="px-2 sm:px-4 py-3 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-ink-muted-light dark:text-ink-muted-dark">
                Sin recurrencias registradas todavía.
              </td>
            </tr>
          )}
          {items.map((t) => {
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
              <td className="hidden xl:table-cell px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: categoryColorFor(t.category_id) }}
                  />
                  {categoryName(t.category_id)}
                </span>
              </td>
              <td className="hidden lg:table-cell px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">{frequencyLabels[t.frequency]}</td>
              <td className="hidden lg:table-cell px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark whitespace-nowrap">
                {t.status === "cancelled" ? "—" : new Date(t.next_execution).toLocaleDateString("es-MX")}
              </td>
              <td className="hidden sm:table-cell px-4 py-3"><StatusBadge status={t.status} /></td>
              <td className="hidden xl:table-cell px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    t.auto_execute
                      ? "text-accent dark:text-accent-dark"
                      : "text-ink-muted-light dark:text-ink-muted-dark"
                  }`}
                  title={t.auto_execute ? "Se ejecuta automáticamente al llegar la fecha" : "Requiere confirmación manual"}
                >
                  {t.auto_execute ? <Zap size={14} /> : <ZapOff size={14} />}
                  {t.auto_execute ? "Automática" : "Manual"}
                </span>
              </td>
              <td
                className={`px-2 sm:px-4 py-3 text-right font-medium font-mono tabular-nums whitespace-nowrap ${
                  t.type === "income" ? "text-positive" : "text-negative"
                }`}
              >
                {formatCurrency(t.amount)}
              </td>
              <td className="px-2 sm:px-4 py-3">
                <div className="flex justify-end gap-2">
                  {t.status === "active" && (
                    <>
                      <button onClick={() => onExecuteNow(t)} title="Ejecutar ahora" className="cursor-pointer text-ink-muted-light dark:text-ink-muted-dark hover:text-accent">
                        <Zap size={16} />
                      </button>
                      <button onClick={() => onEdit(t)} title="Editar" className="cursor-pointer text-ink-muted-light dark:text-ink-muted-dark hover:text-accent">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => onPause(t)} title="Pausar" className="cursor-pointer text-ink-muted-light dark:text-ink-muted-dark hover:text-amber-600">
                        <Pause size={16} />
                      </button>
                      <button onClick={() => onCancel(t)} title="Cancelar" className="cursor-pointer text-ink-muted-light dark:text-ink-muted-dark hover:text-negative">
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                  {t.status === "paused" && (
                    <>
                      <button onClick={() => onResume(t)} title="Reanudar" className="cursor-pointer text-ink-muted-light dark:text-ink-muted-dark hover:text-accent">
                        <Play size={16} />
                      </button>
                      <button onClick={() => onCancel(t)} title="Cancelar" className="cursor-pointer text-ink-muted-light dark:text-ink-muted-dark hover:text-negative">
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
            <tr
              className={`border-line-light dark:border-line-dark last:border-0 transition-colors duration-200 ${
                isExpanded ? "border-b bg-surface-light/60 dark:bg-surface-dark/40" : ""
              }`}
            >
              <td className="px-2 sm:px-4" />
              <td colSpan={8} className="px-2 sm:px-4 pr-4">
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
                      <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Frecuencia</span>
                      <span className="text-ink-light dark:text-ink-dark">{frequencyLabels[t.frequency]}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Próxima ejecución</span>
                      <span className="text-ink-light dark:text-ink-dark">
                        {t.status === "cancelled" ? "—" : new Date(t.next_execution).toLocaleDateString("es-MX")}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Estado</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Automática</span>
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          t.auto_execute ? "text-accent dark:text-accent-dark" : "text-ink-muted-light dark:text-ink-muted-dark"
                        }`}
                      >
                        {t.auto_execute ? <Zap size={14} /> : <ZapOff size={14} />}
                        {t.auto_execute ? "Automática" : "Manual"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Tipo</span>
                      <span className={`font-medium ${t.type === "income" ? "text-positive" : "text-negative"}`}>
                        {t.type === "income" ? "Ingreso" : "Egreso"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Monto</span>
                      <span
                        className={`font-medium font-mono tabular-nums ${
                          t.type === "income" ? "text-positive" : "text-negative"
                        }`}
                      >
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Fecha de inicio</span>
                      <span className="text-ink-light dark:text-ink-dark">{new Date(t.start_date).toLocaleDateString("es-MX")}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Última ejecución</span>
                      <span className="text-ink-light dark:text-ink-dark">
                        {t.last_executed ? new Date(t.last_executed).toLocaleDateString("es-MX") : "Nunca"}
                      </span>
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
    </div>
  );
}
