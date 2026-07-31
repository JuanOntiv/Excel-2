import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { useWallets } from "../hooks/useWallets";
import { useWalletsStore } from "../store/walletsStore";
import { WalletFormModal } from "../components/wallets/WalletFormModal";
import { WalletRulesPanel } from "../components/wallets/WalletRulesPanel";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import type { Wallet } from "../types";

export default function Wallets() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { wallets, isLoading } = useWallets();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Wallet | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(w: Wallet) {
    setEditing(w);
    setModalOpen(true);
  }

  async function handleSubmit(payload: { name: string; description?: string }) {
    const store = useWalletsStore.getState();
    if (editing) {
      await store.update(editing.id, payload);
    } else {
      await store.create(payload);
    }
    toast.success(editing ? "Cartera actualizada." : "Cartera creada.");
  }

  async function handleDelete(w: Wallet) {
    if (!(await confirm({ message: `¿Eliminar "${w.name}"?`, tone: "danger" }))) return;
    try {
      await useWalletsStore.getState().remove(w.id);
      toast.success("Cartera eliminada.");
    } catch {
      toast.error("No se pudo eliminar la cartera.");
    }
  }

  if (isLoading) return <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando carteras...</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-ink-light dark:text-ink-dark">Carteras</h1>
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

      <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-4">
        Todas tus transacciones viven en la cartera principal por defecto. Las carteras personalizadas agrupan transacciones específicas, manual o automáticamente vía reglas. Toca una cartera para ver sus movimientos, balance y analíticas.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((w) => (
          <div
            key={w.id}
            onClick={() => navigate(`/wallets/${w.id}`)}
            className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5 cursor-pointer hover:border-accent transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="min-w-0 font-medium text-ink-light dark:text-ink-dark flex items-center gap-1 break-words">
                <span className="break-words">{w.name}</span>
                {w.is_default && <Star size={14} className="text-accent fill-accent shrink-0" />}
              </h3>
              <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(w)} className="text-ink-muted-light dark:text-ink-muted-dark hover:text-accent">
                  <Pencil size={16} />
                </button>
                {!w.is_default && (
                  <button onClick={() => handleDelete(w)} className="text-ink-muted-light dark:text-ink-muted-dark hover:text-negative">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            {w.description && (
              <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-3">{w.description}</p>
            )}

            <div onClick={(e) => e.stopPropagation()}>
              {w.is_default ? (
                <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5 mt-4">
                  <h3 className="text-sm font-medium text-ink-light dark:text-ink-dark mb-1">
                    Reglas de "{w.name}"
                  </h3>
                  <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark">
                    Incluye todas tus transacciones automáticamente. No usa reglas.
                  </p>
                </div>
              ) : (
                <WalletRulesPanel wallet={w} />
              )}
            </div>

          </div>
        ))}
      </div>

      {wallets.length === 0 && (
        <p className="text-ink-muted-light dark:text-ink-muted-dark">Sin carteras personalizadas todavía.</p>
      )}

      {modalOpen && (
        <WalletFormModal wallet={editing} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
