import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { listWalletRules, createWalletRule, updateWalletRule, deleteWalletRule } from "../../api/walletRules";
import type { WalletRulePayload } from "../../api/walletRules";
import { listCategories } from "../../api/categories";
import { WalletRuleFormModal } from "./WalletRuleFormModal";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import type { Wallet, WalletRule, Category } from "../../types";

const ruleTypeLabels: Record<string, string> = {
  Category: "Categoría",
  TransactionType: "Tipo de transacción",
  Keyword: "Palabra clave",
  DateRange: "Rango de fechas",
  AmountRange: "Rango de monto",
};

function describeRule(rule: WalletRule, categories: Category[]): string {
  switch (rule.rule_type) {
    case "Category":
      return categories.find((c) => c.id === rule.category_id)?.name ?? "Categoría desconocida";
    case "TransactionType":
      return rule.transaction_type === "income" ? "Ingresos" : "Egresos";
    case "Keyword":
      return `Contiene "${rule.keyword}"`;
    case "DateRange":
      return `${rule.date_from} → ${rule.date_to}`;
    case "AmountRange":
      return `${rule.amount_from} — ${rule.amount_to}`;
    default:
      return "";
  }
}

export function WalletRulesPanel({ wallet, onClose }: { wallet: Wallet; onClose?: () => void }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [rules, setRules] = useState<WalletRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WalletRule | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rulesData, categoriesData] = await Promise.all([
        listWalletRules(wallet.id),
        listCategories(false),
      ]);
      setRules(rulesData);
      setCategories(categoriesData);
    } finally {
      setIsLoading(false);
    }
  }, [wallet.id]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(rule: WalletRule) {
    setEditing(rule);
    setModalOpen(true);
  }

  // El modal es agnostico a la cartera: entrega el payload SIN wallet_id.
  // El panel, que conoce la cartera, lo inyecta al crear (al editar no se
  // cambia de cartera, por eso el update no lo toca).
  async function handleSubmit(payload: Omit<WalletRulePayload, "wallet_id">) {
    if (editing) {
      await updateWalletRule(editing.id, payload);
    } else {
      await createWalletRule({ ...payload, wallet_id: wallet.id });
    }
    await load();
    toast.success(editing ? "Regla actualizada." : "Regla creada.");
  }

  async function handleDelete(rule: WalletRule) {
    if (!(await confirm({ message: "¿Eliminar esta regla?", tone: "danger" }))) return;
    try {
      await deleteWalletRule(rule.id);
      await load();
      toast.success("Regla eliminada.");
    } catch {
      toast.error("No se pudo eliminar la regla.");
    }
  }

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-ink-light dark:text-ink-dark">
          Reglas de "{wallet.name}"
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={openCreate} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-accent text-white text-xs font-medium hover:opacity-90">
            <Plus size={14} /> Nueva regla
          </button>
          {onClose && (
            <button onClick={onClose} className="text-ink-muted-light dark:text-ink-muted-dark">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark">Cargando reglas...</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark">
          Sin reglas. Las transacciones deben asignarse manualmente a esta cartera.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between text-sm border border-line-light dark:border-line-dark rounded-lg px-3 py-2">
              <div>
                <span className="font-medium text-ink-light dark:text-ink-dark">{ruleTypeLabels[rule.rule_type]}: </span>
                <span className="text-ink-muted-light dark:text-ink-muted-dark">{describeRule(rule, categories)}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(rule)} className="text-ink-muted-light dark:text-ink-muted-dark hover:text-accent">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(rule)} className="text-ink-muted-light dark:text-ink-muted-dark hover:text-negative">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <WalletRuleFormModal rule={editing} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
