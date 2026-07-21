import { Pencil, Pause, Play, XCircle, Zap } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency } from "../../utils/date";
import { dotToneForId } from "../../utils/rowTone";
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
  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  function categoryColor(id: string) {
    return categories.find((c) => c.id === id)?.color ?? null;
  }

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-light dark:border-line-dark text-left text-ink-muted-light dark:text-ink-muted-dark">
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Categoría</th>
            <th className="px-4 py-3 font-medium">Frecuencia</th>
            <th className="px-4 py-3 font-medium">Próxima ejecución</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium text-right">Monto</th>
            <th className="px-4 py-3 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-ink-muted-light dark:text-ink-muted-dark">
                Sin recurrencias registradas todavía.
              </td>
            </tr>
          )}
          {items.map((t) => (
            <tr key={t.id} className="border-b border-line-light dark:border-line-dark last:border-0">
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotToneForId(t.id)}`} />
                  {t.name}
                </span>
              </td>
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
              <td className="px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">{frequencyLabels[t.frequency]}</td>
              <td className="px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">
                {t.status === "cancelled" ? "—" : new Date(t.next_execution).toLocaleDateString("es-MX")}
              </td>
              <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
              <td className="px-4 py-3 text-right font-medium font-mono tabular-nums">{formatCurrency(t.amount)}</td>
              <td className="px-4 py-3">
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
