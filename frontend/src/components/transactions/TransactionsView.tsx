import { useState, useEffect, useRef } from "react";
import { Plus, TrendingUp, TrendingDown, Trophy, CalendarDays, Download } from "lucide-react";
import { useTransactionsByType } from "../../hooks/useTransactionsByType";
import { useToast } from "../../context/ToastContext";
import { listCategories } from "../../api/categories";
import { createTransaction, updateTransaction, deleteTransaction, exportTransactions } from "../../api/transactions";
import { TimeBarChart } from "../charts/TimeBarChart";
import { CategoryDonut } from "../charts/CategoryDonut";
import { SummaryCard } from "../dashboard/SummaryCard";
import { TransactionTable } from "./TransactionTable";
import { TransactionFilters, EMPTY_FILTERS, applyFilters } from "./TransactionFilters";
import type { TxFilters } from "./TransactionFilters";
import { TransactionFormModal } from "./TransactionFormModal";
import { NotificationBell } from "../notifications/NotificationBell";
import { formatCurrency, getPeriodRange, PERIOD_OPTIONS } from "../../utils/date";
import type { Transaction, Category, TransactionType } from "../../types";
import type { Period } from "../../utils/date";

const typeConfig = {
  income: { label: "Ingresos", chartColor: "#0f766e" },
  expense: { label: "Egresos", chartColor: "#b91c1c" },
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
  const [period, setPeriod] = useState<Period>("month");
  const { transactions, previousTotal, isLoading, error, reload } = useTransactionsByType(type, period);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<TxFilters>(EMPTY_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const config = typeConfig[type];
  const isIncome = type === "income";

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  // Al cambiar de periodo cambian los datos cargados; se limpian los filtros
  // para no dejar un filtro que ya no aplica al nuevo conjunto.
  useEffect(() => {
    setFilters(EMPTY_FILTERS);
  }, [period]);

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

  async function handleSubmit(payload: { name: string; description?: string; amount: number; date: string; category_id: string }) {
    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, payload);
    } else {
      await createTransaction({ ...payload, type });
    }
    await reload();
    toast.success(editingTransaction ? "Movimiento actualizado." : "Movimiento creado.");
  }

  async function handleDelete(t: Transaction) {
    if (!confirm(`¿Eliminar "${t.name}"?`)) return;
    try {
      await deleteTransaction(t.id);
      await reload();
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

  // El filtro de categoría solo ofrece las categorías presentes en el periodo.
  const presentCategoryIds = new Set(transactions.map((t) => t.category_id));
  const categoryOptions = categories
    .filter((c) => presentCategoryIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filtrado client-side: SOLO afecta la tabla, no las gráficas ni las tarjetas.
  const filtered = applyFilters(transactions, filters);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">{config.label}</h1>
        <div className="flex items-center gap-2">
          <NotificationBell align="right" />
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line-light dark:border-line-dark text-ink-light dark:text-ink-dark font-medium hover:bg-line-light/40 dark:hover:bg-line-dark/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              {isExporting ? "Exportando..." : "Exportar"}
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
          <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90">
            <Plus size={18} />
            Nuevo
          </button>
        </div>
      </div>

      {/* Selector de periodo */}
      <div className="flex flex-wrap gap-2 mb-6">
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
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 my-6">
            <TimeBarChart transactions={transactions} color={config.chartColor} period={period} />
            <CategoryDonut transactions={transactions} categories={categories} title={`${config.label} por categoría`} />
          </div>

          <TransactionFilters
            filters={filters}
            onChange={setFilters}
            categories={categoryOptions}
            resultCount={filtered.length}
            totalCount={transactions.length}
          />
          <TransactionTable transactions={filtered} categories={categories} onEdit={openEditModal} onDelete={handleDelete} />
        </>
      )}

      {modalOpen && (
        <TransactionFormModal type={type} categories={categories} transaction={editingTransaction} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
