import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Ban, Target } from "lucide-react";
import {
  listGoals,
  getGoalProgress,
  createGoal,
  updateGoal,
  deleteGoal,
  cancelGoal,
} from "../api/goals";
import type { GoalPayload } from "../api/goals";
import { listWallets } from "../api/wallets";
import { listCategories } from "../api/categories";
import { GoalFormModal } from "../components/goals/GoalFormModal";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { formatCurrency } from "../utils/date";
import type { Goal, GoalProgress, GoalType, GoalStatus, Wallet, Category } from "../types";

const TYPE_LABELS: Record<GoalType, string> = {
  income: "Meta de ingresos",
  expense_limit: "Límite de gasto",
  savings: "Ahorro neto",
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Activa",
  achieved: "Cumplida",
  failed: "No cumplida",
  cancelled: "Cancelada",
};

export default function Goals() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listGoals();
      const withProgress = await Promise.all(list.map((g) => getGoalProgress(g.id)));
      setGoals(withProgress);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    listWallets().then(setWallets).catch(() => setWallets([]));
    listCategories(true).then(setCategories).catch(() => setCategories([]));
  }, [load]);

  const walletName = useCallback((id: string | null) => wallets.find((w) => w.id === id)?.name, [wallets]);
  const categoryName = useCallback((id: string | null) => categories.find((c) => c.id === id)?.name, [categories]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(g: Goal) {
    setEditing(g);
    setModalOpen(true);
  }

  async function handleSubmit(payload: GoalPayload) {
    if (editing) {
      await updateGoal(editing.id, payload);
    } else {
      await createGoal(payload);
    }
    await load();
    toast.success(editing ? "Meta actualizada." : "Meta creada.");
  }

  async function handleDelete(g: Goal) {
    if (!(await confirm({ message: `¿Eliminar "${g.name}"?`, tone: "danger" }))) return;
    try {
      await deleteGoal(g.id);
      await load();
      toast.success("Meta eliminada.");
    } catch {
      toast.error("No se pudo eliminar la meta.");
    }
  }

  async function handleCancel(g: Goal) {
    if (!(await confirm(`¿Cancelar la meta "${g.name}"?`))) return;
    try {
      await cancelGoal(g.id);
      await load();
      toast.success("Meta cancelada.");
    } catch {
      toast.error("No se pudo cancelar la meta.");
    }
  }

  if (isLoading) return <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando metas...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">Metas</h1>
        <div className="flex items-center gap-2">
          <NotificationBell align="right" />
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90">
            <Plus size={18} />
            Nueva
          </button>
        </div>
      </div>

      <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-4">
        Plantéate objetivos financieros para un periodo: juntar cierto ingreso, no rebasar un límite de gasto, o alcanzar un ahorro neto. El avance se calcula automáticamente a partir de tus transacciones. Puedes acotar una meta a una cartera o categoría específica.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            walletName={walletName(g.wallet_id)}
            categoryName={categoryName(g.category_id)}
            onEdit={() => openEdit(g)}
            onDelete={() => handleDelete(g)}
            onCancel={() => handleCancel(g)}
          />
        ))}
      </div>

      {goals.length === 0 && (
        <p className="text-ink-muted-light dark:text-ink-muted-dark">Sin metas todavía.</p>
      )}

      {modalOpen && (
        <GoalFormModal goal={editing} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}

interface GoalCardProps {
  goal: GoalProgress;
  walletName?: string;
  categoryName?: string;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

function GoalCard({ goal, walletName, categoryName, onEdit, onDelete, onCancel }: GoalCardProps) {
  const pct = Math.max(0, Math.min(100, goal.percentage));
  // Para límites de gasto, acercarse/rebasar el tope es "malo" (rojo);
  // para ingresos/ahorro, avanzar hacia la meta es "bueno" (verde/acento).
  const barColor = goal.is_on_track ? "bg-accent" : "bg-negative";
  const isCancelled = goal.status === "cancelled";

  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-medium text-ink-light dark:text-ink-dark flex items-center gap-2">
          <Target size={16} className="text-accent shrink-0" />
          {goal.name}
        </h3>
        <div className="flex gap-2">
          <button onClick={onEdit} className="text-ink-muted-light dark:text-ink-muted-dark hover:text-accent">
            <Pencil size={16} />
          </button>
          {!isCancelled && (
            <button onClick={onCancel} title="Cancelar meta" className="text-ink-muted-light dark:text-ink-muted-dark hover:text-negative">
              <Ban size={16} />
            </button>
          )}
          <button onClick={onDelete} className="text-ink-muted-light dark:text-ink-muted-dark hover:text-negative">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <p className="text-xs text-ink-muted-light dark:text-ink-muted-dark mb-3">
        {TYPE_LABELS[goal.goal_type]} · {STATUS_LABELS[goal.status]}
      </p>

      <div className="flex items-baseline justify-between mb-1">
        <span className={`text-lg font-semibold font-mono tabular-nums ${goal.is_on_track ? "text-positive" : "text-negative"}`}>
          {formatCurrency(goal.current_amount)}
        </span>
        <span className="text-sm font-mono tabular-nums text-ink-muted-light dark:text-ink-muted-dark">
          / {formatCurrency(goal.target_amount)}
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-line-light dark:bg-line-dark overflow-hidden mb-2">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs text-ink-muted-light dark:text-ink-muted-dark">
        <span>{goal.percentage.toFixed(0)}%</span>
        <span>
          {goal.goal_type === "expense_limit"
            ? `Disponible ${formatCurrency(goal.remaining)}`
            : `Faltan ${formatCurrency(goal.remaining)}`}
        </span>
      </div>

      {(walletName || categoryName) && (
        <p className="mt-2 text-xs text-ink-muted-light dark:text-ink-muted-dark">
          {[walletName && `Cartera: ${walletName}`, categoryName && `Categoría: ${categoryName}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <p className="mt-1 text-xs text-ink-muted-light dark:text-ink-muted-dark">
        {new Date(goal.start_date).toLocaleDateString("es-MX")} — {new Date(goal.end_date).toLocaleDateString("es-MX")}
      </p>
    </div>
  );
}
