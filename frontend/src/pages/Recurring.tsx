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
import { NotificationBell } from "../components/notifications/NotificationBell";
import { useToast } from "../context/ToastContext";
import type { RecurringTransaction, Category } from "../types";

export default function Recurring() {
  const { toast } = useToast();
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
    toast.success(editing ? "Recurrencia actualizada." : "Recurrencia creada.");
  }

  async function handlePause(t: RecurringTransaction) {
    try {
      await pauseRecurring(t.id);
      await load();
      toast.success(`"${t.name}" pausada.`);
    } catch {
      toast.error("No se pudo pausar la recurrencia.");
    }
  }

  async function handleResume(t: RecurringTransaction) {
    try {
      await resumeRecurring(t.id);
      await load();
      toast.success(`"${t.name}" reanudada.`);
    } catch {
      toast.error("No se pudo reanudar la recurrencia.");
    }
  }

  async function handleCancel(t: RecurringTransaction) {
    if (!confirm(`¿Cancelar "${t.name}"? Dejará de ejecutarse.`)) return;
    try {
      await cancelRecurring(t.id);
      await load();
      toast.success(`"${t.name}" cancelada.`);
    } catch {
      toast.error("No se pudo cancelar la recurrencia.");
    }
  }

  async function handleExecuteNow(t: RecurringTransaction) {
    if (!confirm(`¿Ejecutar "${t.name}" ahora?`)) return;
    try {
      await executeRecurringNow(t.id);
      await load();
      toast.success(`"${t.name}" ejecutada.`);
    } catch {
      toast.error("No se pudo ejecutar la recurrencia.");
    }
  }

  if (isLoading) return <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando recurrencias...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">Transacciones recurrentes</h1>
        <div className="flex items-center gap-2">
          <NotificationBell align="right" />
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90">
            <Plus size={18} />
            Nueva
          </button>
        </div>
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
