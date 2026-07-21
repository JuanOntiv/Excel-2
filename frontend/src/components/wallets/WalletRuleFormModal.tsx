import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { listCategories } from "../../api/categories";
import type { WalletRule, WalletRuleType, TransactionType, Category } from "../../types";
import type { WalletRulePayload } from "../../api/walletRules";
import { sanitizeAmountInput } from "../../utils/numberInput";

interface Props {
  rule: WalletRule | null;
  onClose: () => void;
  onSubmit: (payload: Omit<WalletRulePayload, "wallet_id">) => Promise<void>;
}

const ruleTypeLabels: Record<WalletRuleType, string> = {
  Category: "Categoría",
  TransactionType: "Tipo de transacción",
  Keyword: "Palabra clave",
  DateRange: "Rango de fechas",
  AmountRange: "Rango de monto",
};

export function WalletRuleFormModal({ rule, onClose, onSubmit }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [ruleType, setRuleType] = useState<WalletRuleType>(rule?.rule_type ?? "Category");
  const [categoryId, setCategoryId] = useState(rule?.category_id ?? "");
  const [transactionType, setTransactionType] = useState<TransactionType>(rule?.transaction_type ?? "expense");
  const [keyword, setKeyword] = useState(rule?.keyword ?? "");
  const [dateFrom, setDateFrom] = useState(rule?.date_from ?? "");
  const [dateTo, setDateTo] = useState(rule?.date_to ?? "");
  const [amountFrom, setAmountFrom] = useState(rule?.amount_from?.toString() ?? "");
  const [amountTo, setAmountTo] = useState(rule?.amount_to?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listCategories(false).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: Omit<WalletRulePayload, "wallet_id"> = { rule_type: ruleType };

    if (ruleType === "Category") {
      if (!categoryId) return setError("Selecciona una categoría.");
      payload.category_id = categoryId;
    } else if (ruleType === "TransactionType") {
      payload.transaction_type = transactionType;
    } else if (ruleType === "Keyword") {
      if (!keyword.trim()) return setError("Escribe una palabra clave.");
      payload.keyword = keyword.trim();
    } else if (ruleType === "DateRange") {
      if (!dateFrom || !dateTo) return setError("Completa ambas fechas.");
      payload.date_from = dateFrom;
      payload.date_to = dateTo;
    } else if (ruleType === "AmountRange") {
      const from = parseFloat(amountFrom);
      const to = parseFloat(amountTo);
      if (isNaN(from) || isNaN(to)) return setError("Completa ambos montos.");
      payload.amount_from = from;
      payload.amount_to = to;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch {
      setError("No se pudo guardar la regla.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface-elevated-light dark:bg-surface-elevated-dark border border-line-light dark:border-line-dark p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-light dark:text-ink-dark">
            {rule ? "Editar" : "Nueva"} regla
          </h2>
          <button onClick={onClose} className="text-ink-muted-light dark:text-ink-muted-dark">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Tipo de regla</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as WalletRuleType)}
              disabled={!!rule}
              className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            >
              {Object.entries(ruleTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {ruleType === "Category" && (
            <div>
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Categoría</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {ruleType === "TransactionType" && (
            <div>
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Tipo</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="income">Ingreso</option>
                <option value="expense">Egreso</option>
              </select>
            </div>
          )}

          {ruleType === "Keyword" && (
            <div>
              <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Palabra clave</label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="ej. Netflix"
                className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          )}

          {ruleType === "DateRange" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Desde</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Hasta</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            </div>
          )}

          {ruleType === "AmountRange" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Monto mínimo</label>
                <input type="number" step="0.01" min="0" value={amountFrom} onChange={(e) => setAmountFrom(sanitizeAmountInput(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Monto máximo</label>
                <input type="number" step="0.01" min="0" value={amountTo} onChange={(e) => setAmountTo(sanitizeAmountInput(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            </div>
          )}

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
