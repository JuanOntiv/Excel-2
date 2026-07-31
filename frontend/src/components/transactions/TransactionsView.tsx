import { useState, useEffect, useRef } from "react";
import { Plus, TrendingUp, TrendingDown, Trophy, CalendarDays, Download, Wallet as WalletIcon } from "lucide-react";
import { useTransactionsByType } from "../../hooks/useTransactionsByType";
import { useAllTransactionsByType } from "../../hooks/useAllTransactionsByType";
import { useSelectedWallet } from "../../hooks/useSelectedWallet";
import { useCategories } from "../../hooks/useCategories";
import { useWallets } from "../../hooks/useWallets";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { useTransactionsStore } from "../../store/transactionsStore";
import { exportTransactions } from "../../api/transactions";
import { TimeBarChart } from "../charts/TimeBarChart";
import { CategoryDonut } from "../charts/CategoryDonut";
import { SummaryCard } from "../dashboard/SummaryCard";
import { TransactionTable } from "./TransactionTable";
import { TransactionFilters, EMPTY_FILTERS, applyFilters } from "./TransactionFilters";
import type { TxFilters } from "./TransactionFilters";
import { TransactionFormModal } from "./TransactionFormModal";
import { NotificationBell } from "../notifications/NotificationBell";
import { formatCurrency, getPeriodRange, PERIOD_OPTIONS, PERIOD_COMPARISON_LABEL } from "../../utils/date";
import type { Transaction, TransactionType } from "../../types";
import type { Period } from "../../utils/date";

// El verde de "Ingresos" es el mismo tono --color-positive (ver index.css),
// pero más brillante para que resalte en la gráfica de barras.
const typeConfig = {
  income: { label: "Ingresos", singular: "ingreso", chartColor: "#10b981" },
  expense: { label: "Egresos", singular: "egreso", chartColor: "#b91c1c" },
};

/** Variación % vs. periodo anterior. null = sin base para comparar. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Nº de meses que abarcan las transacciones (para el promedio mensual). */
function monthsSpanned(txs: Transaction[]): number {
  if (txs.length === 0) return 1;
  const months = txs.map((t) => t.date.slice(0, 7));
  const min = months.reduce((a, b) => (a < b ? a : b));
  const max = months.reduce((a, b) => (a > b ? a : b));
  const [minY, minM] = min.split("-").map(Number);
  const [maxY, maxM] = max.split("-").map(Number);
  return Math.max(1, (maxY - minY) * 12 + (maxM - minM) + 1);
}

export function TransactionsView({ type }: { type: TransactionType }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [period, setPeriod] = useState<Period>("month");
  // Cartera activa: es CONTEXTO, no un filtro de tabla. Acota tarjetas,
  // gráficas e historial por igual, y define en qué cartera nacen los
  // movimientos nuevos. Se recuerda entre Ingresos/Egresos y al recargar.
  const [selectedWalletId, setSelectedWalletId] = useSelectedWallet();
  const { transactions, previousTotal, previousTransactions, isLoading, error } = useTransactionsByType(type, period, selectedWalletId);
  // Historial: independiente del periodo elegido arriba, siempre trae todo
  // (paginado en la tabla) para que cambiar de periodo no lo recalcule.
  const { transactions: allTransactions, isLoading: isLoadingAll, error: allError } = useAllTransactionsByType(type, selectedWalletId);
  const { categories } = useCategories();
  const { wallets } = useWallets();
  const [filters, setFilters] = useState<TxFilters>(EMPTY_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const config = typeConfig[type];
  const isIncome = type === "income";

  // Si la cartera recordada ya no existe (se borró en otra sesión), volvemos a
  // "Todas": si no, cada carga pediría un wallet_id que el backend rechaza con 404.
  useEffect(() => {
    if (wallets.length && selectedWalletId && !wallets.some((w) => w.id === selectedWalletId)) {
      setSelectedWalletId(null);
    }
  }, [wallets, selectedWalletId, setSelectedWalletId]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [exportMenuOpen]);

  function openCreateModal() {
    setEditingTransaction(null);
    setModalOpen(true);
  }

  function openEditModal(t: Transaction) {
    setEditingTransaction(t);
    setModalOpen(true);
  }

  async function handleSubmit(payload: { name: string; description?: string; amount: number; date: string; category_id: string; wallet_id: string | null }) {
    const store = useTransactionsStore.getState();
    if (editingTransaction) {
      await store.update(editingTransaction.id, payload);
    } else {
      await store.create({ ...payload, type });
    }
    toast.success(editingTransaction ? "Movimiento actualizado." : "Movimiento creado.");
  }

  async function handleDelete(t: Transaction) {
    if (!(await confirm({ message: `¿Eliminar "${t.name}"?`, tone: "danger" }))) return;
    try {
      await useTransactionsStore.getState().remove(t.id);
      toast.success("Movimiento eliminado.");
    } catch {
      toast.error("No se pudo eliminar el movimiento.");
    }
  }

  // Exporta el periodo/categoría actualmente seleccionados (mismo alcance
  // que las gráficas y tarjetas, no solo la página visible de la tabla).
  async function handleExport(format: "csv" | "xlsx") {
    setExportMenuOpen(false);
    setIsExporting(true);
    try {
      const range = getPeriodRange(period);
      await exportTransactions({
        format,
        type,
        ...range,
        category_id: filters.categoryId || undefined,
        wallet_id: selectedWalletId || undefined,
      });
      toast.success("Exportación lista.");
    } catch {
      toast.error("No se pudo exportar. Intenta de nuevo.");
    } finally {
      setIsExporting(false);
    }
  }

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const highest = transactions.length
    ? transactions.reduce((max, t) => (t.amount > max.amount ? t : max))
    : null;
  const monthlyAvg = total / monthsSpanned(transactions);
  const totalDelta = previousTotal !== null ? pctChange(total, previousTotal) : null;
  const previousMonthlyAvg = previousTotal !== null ? previousTotal / monthsSpanned(previousTransactions) : null;
  const monthlyAvgDelta = previousMonthlyAvg !== null ? pctChange(monthlyAvg, previousMonthlyAvg) : null;

  // La cartera default es implícita ("todo"), así que no es una opción del
  // selector: para eso está "Todas las carteras", que no manda wallet_id.
  const assignableWallets = wallets.filter((w) => !w.is_default);

  // El filtro de categoría solo ofrece las categorías presentes en el historial completo.
  const presentCategoryIds = new Set(allTransactions.map((t) => t.category_id));
  const categoryOptions = categories
    .filter((c) => presentCategoryIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filtrado client-side sobre el historial completo (no el del periodo):
  // SOLO afecta la tabla, no las gráficas ni las tarjetas.
  const filtered = applyFilters(allTransactions, filters);

  return (
    <div>
      {/* flex-wrap + etiquetas que se ocultan en móvil: con el título, la
          campana, "Exportar" y el CTA en una sola fila, a 375px el botón
          principal quedaba cortado fuera de pantalla. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-ink-light dark:text-ink-dark">{config.label}</h1>
        <div className="flex items-center gap-2 shrink-0">
          {/* En móvil ya está la campana de MobileHeader; esta es solo para desktop. */}
          <div className="hidden md:block">
            <NotificationBell align="right" />
          </div>
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={isExporting}
              title="Exportar"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-line-dark dark:border-line-light bg-surface-dark/80 dark:bg-surface-light/80 text-ink-dark dark:text-ink-light font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} className="shrink-0" />
              <span className="hidden sm:inline">{isExporting ? "Exportando..." : "Exportar"}</span>
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-lg border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark shadow-lg overflow-hidden z-10">
                <button
                  onClick={() => handleExport("csv")}
                  className="block w-full text-left px-4 py-2 text-sm text-ink-light dark:text-ink-dark hover:bg-line-light/40 dark:hover:bg-line-dark/40"
                >
                  CSV
                </button>
                <button
                  onClick={() => handleExport("xlsx")}
                  className="block w-full text-left px-4 py-2 text-sm text-ink-light dark:text-ink-dark hover:bg-line-light/40 dark:hover:bg-line-dark/40"
                >
                  Excel
                </button>
              </div>
            )}
          </div>
          <button onClick={openCreateModal} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 whitespace-nowrap">
            <Plus size={18} className="shrink-0" />
            Nuevo <span className="hidden sm:inline">{config.singular}</span>
          </button>
        </div>
      </div>

      {/* Periodo (acota tarjetas/gráficas) + cartera (acota todo, y define
          dónde nacen los movimientos nuevos). */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setPeriod(o.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === o.value
                  ? "bg-accent text-white"
                  : "border border-line-light dark:border-line-dark text-ink-muted-light dark:text-ink-muted-dark hover:text-ink-light dark:hover:text-ink-dark"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <WalletIcon size={16} className="text-ink-muted-light dark:text-ink-muted-dark shrink-0" />
          <select
            value={selectedWalletId ?? ""}
            onChange={(e) => setSelectedWalletId(e.target.value || null)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark text-ink-light dark:text-ink-dark focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">General</option>
            {assignableWallets.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando {config.label.toLowerCase()}...</p>
      ) : error ? (
        <p className="text-negative">{error}</p>
      ) : (
        <>
          {/* Tarjetas resumen del periodo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              label={`Total de ${config.label.toLowerCase()}`}
              value={formatCurrency(total)}
              icon={isIncome ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              tone={isIncome ? "positive" : "negative"}
              delta={totalDelta}
              higherIsBetter={isIncome}
              deltaLabel={PERIOD_COMPARISON_LABEL[period]}
            />
            <SummaryCard
              label="Mayor movimiento"
              value={highest ? formatCurrency(highest.amount) : "—"}
              subtitle={highest ? `${highest.name} · ${new Date(highest.date).toLocaleDateString("es-MX")}` : null}
              icon={<Trophy size={20} />}
            />
            <SummaryCard
              label="Promedio mensual"
              value={formatCurrency(monthlyAvg)}
              icon={<CalendarDays size={20} />}
              delta={monthlyAvgDelta}
              higherIsBetter={isIncome}
              deltaLabel={PERIOD_COMPARISON_LABEL[period]}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 my-6">
            <TimeBarChart transactions={transactions} color={config.chartColor} period={period} />
            <CategoryDonut transactions={transactions} categories={categories} title={`${config.label} por categoría`} />
          </div>
        </>
      )}

      {/* Historial: siempre trae todas las transacciones del tipo, sin
          importar el periodo elegido arriba (solo afecta tarjetas/gráficas). */}
      {isLoadingAll ? (
        <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando historial...</p>
      ) : allError ? (
        <p className="text-negative">{allError}</p>
      ) : (
        <>
          <TransactionFilters
            filters={filters}
            onChange={setFilters}
            categories={categoryOptions}
            resultCount={filtered.length}
            totalCount={allTransactions.length}
          />
          <TransactionTable transactions={filtered} categories={categories} onEdit={openEditModal} onDelete={handleDelete} />
        </>
      )}

      {modalOpen && (
        <TransactionFormModal type={type} categories={categories} wallets={wallets} defaultWalletId={selectedWalletId} transaction={editingTransaction} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
