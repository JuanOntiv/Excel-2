import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useTransactionsByType } from "../../hooks/useTransactionsByType";
import { listCategories } from "../../api/categories";
import { createTransaction, updateTransaction, deleteTransaction } from "../../api/transactions";
import { MonthlyChart } from "./MonthlyChart";
import { CategoryPieChart } from "./CategoryPieChart";
import { HighlightCards } from "./HighlightCards";
import { TransactionTable } from "./TransactionTable";
import { TransactionFormModal } from "./TransactionFormModal";
import type { Transaction, Category, TransactionType } from "../../types";

const typeConfig = {
  income: { label: "Ingresos", chartColor: "#0f766e" },
  expense: { label: "Egresos", chartColor: "#b91c1c" },
};

export function TransactionsView({ type }: { type: TransactionType }) {
  const { transactions, isLoading, error, reload } = useTransactionsByType(type);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const config = typeConfig[type];

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  function openCreateModal() {
    setEditingTransaction(null);
    setModalOpen(true);
  }

  function openEditModal(t: Transaction) {
    setEditingTransaction(t);
    setModalOpen(true);
  }

  async function handleSubmit(payload: { name: string; description?: string; amount: number; date: string; category_id: string }) {
    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, payload);
    } else {
      await createTransaction({ ...payload, type });
    }
    await reload();
  }

  async function handleDelete(t: Transaction) {
    if (!confirm(`¿Eliminar "${t.name}"?`)) return;
    await deleteTransaction(t.id);
    await reload();
  }

  if (isLoading) return <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando {config.label.toLowerCase()}...</p>;
  if (error) return <p className="text-negative">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">{config.label}</h1>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90">
          <Plus size={18} />
          Nuevo
        </button>
      </div>

      <HighlightCards transactions={transactions} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 my-6">
        <MonthlyChart transactions={transactions} color={config.chartColor} />
        <CategoryPieChart transactions={transactions} categories={categories} />
      </div>

      <TransactionTable transactions={transactions} categories={categories} onEdit={openEditModal} onDelete={handleDelete} />

      {modalOpen && (
        <TransactionFormModal type={type} categories={categories} transaction={editingTransaction} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
