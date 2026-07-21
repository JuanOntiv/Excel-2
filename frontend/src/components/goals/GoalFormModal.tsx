
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { listWallets } from "../../api/wallets";
import { listCategories } from "../../api/categories";
import type { Goal, GoalType, Wallet, Category } from "../../types";
import type { GoalPayload } from "../../api/goals";
import { sanitizeAmountInput } from "../../utils/numberInput";

interface Props {
  goal: Goal | null;
  onClose: () => void;
  onSubmit: (payload: GoalPayload) => Promise<void>;
}

const GOAL_TYPE_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "income", label: "Meta de ingresos (juntar al menos $X)" },
  { value: "expense_limit", label: "Límite de gasto (gastar máximo $X)" },
  { value: "savings", label: "Ahorro neto (ingresos − gastos ≥ $X)" },
];

export function GoalFormModal({ goal, onClose, onSubmit }: Props) {
  const [name, setName] = useState(goal?.name ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [goalType, setGoalType] = useState<GoalType>(goal?.goal_type ?? "income");
  const [targetAmount, setTargetAmount] = useState(goal?.target_amount?.toString() ?? "");
  const [startDate, setStartDate] = useState(goal?.start_date ?? "");
  const [endDate, setEndDate] = useState(goal?.end_date ?? "");
  const [walletId, setWalletId] = useState(goal?.wallet_id ?? "");
  const [categoryId, setCategoryId] = useState(goal?.category_id ?? "");

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listWallets().then(setWallets).catch(() => setWallets([]));
    listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (endDate < startDate) {
      setError("La fecha de fin debe ser igual o posterior a la de inicio.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name,
        description: description || undefined,
        goal_type: goalType,
        target_amount: Number(targetAmount),
        start_date: startDate,
        end_date: endDate,
        wallet_id: walletId || null,
        category_id: categoryId || null,
      });
      onClose();
    } catch {
      setError("No se pudo guardar la meta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface-elevated-light dark:bg-surface-elevated-dark border border-line-light dark:border-line-dark p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-light dark:text-ink-dark">
            {goal ? "Editar" : "Nueva"} meta
          </h2>
          <button onClick={onClose} className="text-ink-muted-light dark:text-ink-muted-dark">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Descripción (opcional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Tipo de meta</label>
            <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)} className={inputClass}>
              {GOAL_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Monto objetivo</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(sanitizeAmountInput(e.target.value))}
              required
              className={inputClass}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Desde</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputClass} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Hasta</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Cartera (opcional)</label>
            <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className={inputClass}>
              <option value="">Todas las transacciones</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Categoría (opcional)</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
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
