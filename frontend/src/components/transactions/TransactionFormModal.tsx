import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import type { Transaction, Category, TransactionType, Wallet } from "../../types";
import { sanitizeAmountInput, parseAmountInput } from "../../utils/numberInput";

interface Props {
  type: TransactionType;
  categories: Category[];
  wallets: Wallet[];
  /** Cartera activa en la vista: pre-llena el campo al crear. null = "General". */
  defaultWalletId: string | null;
  transaction: Transaction | null;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    description?: string;
    amount: number;
    date: string;
    category_id: string;
    wallet_id: string | null;
  }) => Promise<void>;
}

export function TransactionFormModal({ type, categories, wallets, defaultWalletId, transaction, onClose, onSubmit }: Props) {
  const [name, setName] = useState(transaction?.name ?? "");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [amount, setAmount] = useState(transaction?.amount?.toString() ?? "");
  const [date, setDate] = useState(transaction?.date ? transaction.date.split("T")[0] : new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  // Al editar manda la cartera real de la transacción; al crear, la del contexto.
  const [walletId, setWalletId] = useState<string>(
    transaction ? transaction.wallet_id ?? "" : defaultWalletId ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const relevantCategories = categories.filter((c) => c.type === type || c.type === "both");
  // La cartera default es implícita (contiene todo), nunca se asigna a mano:
  // asignarla crearía una fila en Transaction_Wallets, justo lo que el diseño
  // del backend prohíbe (ver services/wallet_assignment.py).
  const assignableWallets = wallets.filter((w) => !w.is_default);

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
    if (!categoryId) {
      setError("Selecciona una categoría.");
      return;
    }

    setIsSubmitting(true);
    try {
      // wallet_id va como null explícito (no undefined) a propósito: el backend
      // usa exclude_unset, así que undefined significaría "no lo toques" y no se
      // podría sacar una transacción de su cartera al editarla.
      await onSubmit({
        name,
        description: description || undefined,
        amount: parsedAmount,
        date,
        category_id: categoryId,
        wallet_id: walletId || null,
      });
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

          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Cartera</label>
            <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="">General (sin cartera específica)</option>
              {assignableWallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
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
