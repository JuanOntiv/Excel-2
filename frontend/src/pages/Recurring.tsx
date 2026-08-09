import { useState } from "react";
import { Plus } from "lucide-react";
import type { createRecurring } from "../api/recurring";
import { useRecurringStore } from "../store/recurringStore";
import { useRecurring } from "../hooks/useRecurring";
import { useCategories } from "../hooks/useCategories";
import { RecurringTable } from "../components/recurring/RecurringTable";
import { RecurringFormModal } from "../components/recurring/RecurringFormModal";
import { PendingConfirmationBanner } from "../components/recurring/PendingConfirmationBanner";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import type { RecurringTransaction } from "../types";

export default function Recurring() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { categories } = useCategories(false);
  // Datos desde la cache en memoria: AppShell ya llamó a bootstrap(), así que
  // el "Cargando..." solo se ve la primera vez de la sesión, no en cada visita.
  const { items, pending, isLoading } = useRecurring();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(t: RecurringTransaction) {
    setEditing(t);
    setModalOpen(true);
  }

  async function handleSubmit(payload: Parameters<typeof createRecurring>[0]) {
    const store = useRecurringStore.getState();
    if (editing) {
      await store.update(editing.id, payload);
    } else {
      await store.create(payload);
    }
    toast.success(editing ? "Recurrencia actualizada." : "Recurrencia creada.");
  }

  async function handlePause(t: RecurringTransaction) {
    try {
      await useRecurringStore.getState().pause(t.id);
      toast.success(`"${t.name}" pausada.`);
    } catch {
      toast.error("No se pudo pausar la recurrencia.");
    }
  }

  async function handleResume(t: RecurringTransaction) {
    try {
      await useRecurringStore.getState().resume(t.id);
      toast.success(`"${t.name}" reanudada.`);
    } catch {
      toast.error("No se pudo reanudar la recurrencia.");
    }
  }

  async function handleCancel(t: RecurringTransaction) {
    if (!(await confirm({ message: `¿Cancelar "${t.name}"? Dejará de ejecutarse.`, tone: "danger" }))) return;
    try {
      await useRecurringStore.getState().cancel(t.id);
      toast.success(`"${t.name}" cancelada.`);
    } catch {
      toast.error("No se pudo cancelar la recurrencia.");
    }
  }

  async function handleExecuteNow(t: RecurringTransaction) {
    if (!(await confirm(`¿Ejecutar "${t.name}" ahora?`))) return;
    try {
      // El store invalida transacciones y metas: ejecutar crea una Transaction
      // real y mueve el progreso de las metas (ver recurringStore.executeNow).
      await useRecurringStore.getState().executeNow(t.id);
      toast.success(`"${t.name}" ejecutada.`);
    } catch {
      toast.error("No se pudo ejecutar la recurrencia.");
    }
  }

  if (isLoading) return <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando recurrencias...</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-ink-light dark:text-ink-dark">Transacciones recurrentes</h1>
        <div className="flex items-center gap-2 shrink-0">
          {/* En móvil ya está la campana de MobileHeader; esta es solo para desktop. */}
          <div className="hidden md:block">
            <NotificationBell align="right" />
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90">
            <Plus size={18} className="shrink-0" />
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
