import { useState, useEffect, FormEvent } from "react";
import { X } from "lucide-react";
import type { Transaction, Category, TransactionType } from "../../types";

interface Props {
  type: TransactionType;
  categories: Category[];
  transaction: Transaction | null;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    description?: string;
    amount: number;
    date: string;
    category_id: string;
  }) => Promise<void>;
}

export function TransactionFormModal({ type, categories, transaction, onClose, onSubmit }: Props) {
  const [name, setName] = useState(transaction?.name ?? "");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [amount, setAmount] = useState(transaction?.amount?.toString() ?? "");
  const [date, setDate] = useState(transaction?.date ? transaction.date.split("T")[0] : new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const relevantCategories = categories.filter((c) => c.type === type || c.type === "both");

  useEffect(() => {
    if (!categoryId && relevantCategories.length > 0) {
      setCategoryId(relevantCategories[0].id);
    }
  }, [relevantCategories, categoryId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("El monto debe ser un número mayor a 0.");
      return;
    }
    if (!categoryId) {
      setError("Selecciona una categoría.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name, description: description || undefined, amount: parsedAmount, date, category_id: categoryId });
      onClose();
    } catch {
      setError("No se pudo guardar la transacción.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface-elevated-light dark:bg-surface-elevated-dark border border-line-light dark:border-line-dark p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-light dark:text-ink-dark">
            {transaction ? "Editar" : "Nueva"} {type === "income" ? "ingreso" : "egreso"}
          </h2>
          <button onClick={onClose} className="text-ink-muted-light dark:text-ink-muted-dark">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Descripción (opcional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Monto</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
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
