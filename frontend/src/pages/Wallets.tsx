import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Star, Settings2 } from "lucide-react";
import { listWallets, createWallet, updateWallet, deleteWallet } from "../api/wallets";
import { WalletFormModal } from "../components/wallets/WalletFormModal";
import { WalletRulesPanel } from "../components/wallets/WalletRulesPanel";
import type { Wallet } from "../types";

export default function Wallets() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [expandedWalletId, setExpandedWalletId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listWallets();
      setWallets(data);
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

  function openEdit(w: Wallet) {
    setEditing(w);
    setModalOpen(true);
  }

  async function handleSubmit(payload: { name: string; description?: string; is_default: boolean }) {
    if (editing) {
      await updateWallet(editing.id, payload);
    } else {
      await createWallet(payload);
    }
    await load();
  }

  async function handleDelete(w: Wallet) {
    if (w.is_default) {
      alert("No se puede eliminar la cartera predeterminada.");
      return;
    }
    if (!confirm(`¿Eliminar "${w.name}"?`)) return;
    await deleteWallet(w.id);
    if (expandedWalletId === w.id) setExpandedWalletId(null);
    await load();
  }

  function toggleRules(w: Wallet) {
    setExpandedWalletId((current) => (current === w.id ? null : w.id));
  }

  if (isLoading) return <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando carteras...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">Carteras</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90">
          <Plus size={18} />
          Nueva
        </button>
      </div>

      <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-4">
        Todas tus transacciones viven en la cartera principal por defecto. Las carteras personalizadas agrupan transacciones específicas, manual o automáticamente vía reglas.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((w) => (
          <div key={w.id} className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-ink-light dark:text-ink-dark flex items-center gap-1">
                {w.name}
                {w.is_default && <Star size={14} className="text-accent fill-accent" />}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => openEdit(w)} className="text-ink-muted-light dark:text-ink-muted-dark hover:text-accent">
                  <Pencil size={16} />
                </button>
                <button onClick={() => handleDelete(w)} className="text-ink-muted-light dark:text-ink-muted-dark hover:text-negative">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {w.description && (
              <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-3">{w.description}</p>
            )}
            <button
              onClick={() => toggleRules(w)}
              className="flex items-center gap-1 text-sm text-accent hover:opacity-80"
            >
              <Settings2 size={14} />
              {expandedWalletId === w.id ? "Ocultar reglas" : "Gestionar reglas"}
            </button>

            {expandedWalletId === w.id && (
              <WalletRulesPanel wallet={w} onClose={() => setExpandedWalletId(null)} />
            )}
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
