import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import {
  listRecurring,
  createRecurring,
  updateRecurring,
  cancelRecurring,
  pauseRecurring,
  resumeRecurring,
  executeRecurringNow,
  listPendingConfirmation,
} from "../api/recurring";
import { listCategories } from "../api/categories";
import { RecurringTable } from "../components/recurring/RecurringTable";
import { RecurringFormModal } from "../components/recurring/RecurringFormModal";
import { PendingConfirmationBanner } from "../components/recurring/PendingConfirmationBanner";
import type { RecurringTransaction, Category } from "../types";

export default function Recurring() {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [pending, setPending] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recurringData, pendingData, categoriesData] = await Promise.all([
        listRecurring(),
        listPendingConfirmation(),
        listCategories(false),
      ]);
      setItems(recurringData);
      setPending(pendingData);
      setCategories(categoriesData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(t: RecurringTransaction) {
    setEditing(t);
    setModalOpen(true);
  }

  async function handleSubmit(payload: Parameters<typeof createRecurring>[0]) {
    if (editing) {
      await updateRecurring(editing.id, payload);
    } else {
      await createRecurring(payload);
    }
    await load();
  }

  async function handlePause(t: RecurringTransaction) {
    await pauseRecurring(t.id);
    await load();
  }

  async function handleResume(t: RecurringTransaction) {
    await resumeRecurring(t.id);
    await load();
  }

  async function handleCancel(t: RecurringTransaction) {
    if (!confirm(`¿Cancelar "${t.name}"? Dejará de ejecutarse.`)) return;
    await cancelRecurring(t.id);
    await load();
  }

  async function handleExecuteNow(t: RecurringTransaction) {
    if (!confirm(`¿Ejecutar "${t.name}" ahora?`)) return;
    await executeRecurringNow(t.id);
    await load();
  }

  if (isLoading) return <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando recurrencias...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">Transacciones recurrentes</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90">
          <Plus size={18} />
          Nueva
        </button>
      </div>

      <PendingConfirmationBanner pending={pending} onConfirm={handleExecuteNow} />

      <RecurringTable
        items={items}
        categories={categories}
        onEdit={openEdit}
        onPause={handlePause}
        onResume={handleResume}
        onCancel={handleCancel}
        onExecuteNow={handleExecuteNow}
      />

      {modalOpen && (
        <RecurringFormModal recurring={editing} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
