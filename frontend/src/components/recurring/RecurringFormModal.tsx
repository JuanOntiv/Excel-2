import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { listCategories } from "../../api/categories";
import type { RecurringTransaction, Category, TransactionType, RecurringFrequency } from "../../types";
import { sanitizeAmountInput, parseAmountInput } from "../../utils/numberInput";

interface Props {
  recurring: RecurringTransaction | null;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    description?: string;
    amount: number;
    type: TransactionType;
    frequency: RecurringFrequency;
    start_date: string;
    auto_execute: boolean;
    category_id: string;
  }) => Promise<void>;
}

const frequencyLabels: Record<RecurringFrequency, string> = {
  Daily: "Diaria",
  Weekly: "Semanal",
  Biweekly: "Quincenal",
  Monthly: "Mensual",
  Yearly: "Anual",
};

export function RecurringFormModal({ recurring, onClose, onSubmit }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(recurring?.name ?? "");
  const [description, setDescription] = useState(recurring?.description ?? "");
  const [amount, setAmount] = useState(recurring?.amount?.toString() ?? "");
  const [type, setType] = useState<TransactionType>(recurring?.type ?? "expense");
  const [frequency, setFrequency] = useState<RecurringFrequency>(recurring?.frequency ?? "Monthly");
  const [startDate, setStartDate] = useState(recurring?.start_date ?? new Date().toISOString().split("T")[0]);
  const [autoExecute, setAutoExecute] = useState(recurring?.auto_execute ?? true);
  const [categoryId, setCategoryId] = useState(recurring?.category_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!recurring;
  const relevantCategories = categories.filter((c) => c.type === type || c.type === "both");

  useEffect(() => {
    listCategories(false).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!categoryId && relevantCategories.length > 0) {
      setCategoryId(relevantCategories[0].id);
    }
  }, [relevantCategories, categoryId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseAmountInput(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("El monto debe ser un número mayor a 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name,
        description: description || undefined,
        amount: parsedAmount,
        type,
        frequency,
        start_date: startDate,
        auto_execute: autoExecute,
        category_id: categoryId,
      });
      onClose();
    } catch {
      setError("No se pudo guardar la recurrencia.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface-elevated-light dark:bg-surface-elevated-dark border border-line-light dark:border-line-dark p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-light dark:text-ink-dark">
            {isEditing ? "Editar" : "Nueva"} recurrencia
          </h2>
          <button onClick={onClose} className="text-ink-muted-light dark:text-ink-muted-dark">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Concepto</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Descripción (opcional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Monto</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted-light dark:text-ink-muted-dark">$</span>
                <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))} required className="w-full pl-7 pr-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as TransactionType)} disabled={isEditing} className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50">
                <option value="income">Ingreso</option>
                <option value="expense">Egreso</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Frecuencia</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)} disabled={isEditing} className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50">
                {Object.entries(frequencyLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Fecha de inicio</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={isEditing} className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Categoría</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent">
              {relevantCategories.length === 0 && <option value="">Sin categorías disponibles</option>}
              {relevantCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-light dark:text-ink-dark">
            <input type="checkbox" checked={autoExecute} onChange={(e) => setAutoExecute(e.target.checked)} />
            Ejecutar automáticamente al llegar la fecha
          </label>

          {error && <p className="text-sm text-negative">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-line-light dark:border-line-dark text-ink-light dark:text-ink-dark">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-50">
              {isSubmitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
