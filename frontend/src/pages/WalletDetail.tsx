import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Settings2,
  TrendingUp,
  TrendingDown,
  Wallet as WalletIcon,
  Trophy,
  CalendarDays,
  Receipt,
  Download,
} from "lucide-react";
import { getWallet, updateWallet } from "../api/wallets";
import { listCategories } from "../api/categories";
import { listWalletRules } from "../api/walletRules";
import { exportTransactions } from "../api/transactions";
import { useWalletTransactions } from "../hooks/useWalletTransactions";
import { WalletFormModal } from "../components/wallets/WalletFormModal";
import { WalletRulesPanel } from "../components/wallets/WalletRulesPanel";
import { TimeBarChart } from "../components/charts/TimeBarChart";
import { CategoryDonut } from "../components/charts/CategoryDonut";
import { TransactionTable } from "../components/transactions/TransactionTable";
import { TransactionFilters, EMPTY_FILTERS, applyFilters } from "../components/transactions/TransactionFilters";
import type { TxFilters } from "../components/transactions/TransactionFilters";
import { SummaryCard } from "../components/dashboard/SummaryCard";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { useToast } from "../context/ToastContext";
import { formatCurrency, getPeriodRange, getPreviousPeriodRange, PERIOD_OPTIONS, PERIOD_COMPARISON_LABEL } from "../utils/date";
import type { Wallet, Category, Transaction } from "../types";
import type { Period } from "../utils/date";

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

export default function WalletDetail() {
  const { walletId } = useParams<{ walletId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [filters, setFilters] = useState<TxFilters>(EMPTY_FILTERS);
  const [period, setPeriod] = useState<Period>("month");
  const [ruleCount, setRuleCount] = useState<number | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const { transactions, isLoading: isLoadingTransactions, error } = useWalletTransactions(
    walletId ?? "",
    wallet?.is_default ?? false
  );

  const loadWallet = useCallback(async () => {
    if (!walletId) return;
    setIsLoadingWallet(true);
    try {
      const data = await getWallet(walletId);
      setWallet(data);
    } catch {
      setNotFound(true);
    } finally {
      setIsLoadingWallet(false);
    }
  }, [walletId]);

  // Contador junto a "Gestionar reglas": se recarga al cerrar el panel por si
  // se creó/borró alguna regla mientras estaba abierto.
  const loadRuleCount = useCallback(() => {
    if (!walletId) return;
    listWalletRules(walletId).then((rules) => setRuleCount(rules.length)).catch(() => {});
  }, [walletId]);

  useEffect(() => {
    loadWallet();
    listCategories().then(setCategories).catch(() => {});
  }, [loadWallet]);

  useEffect(() => {
    if (wallet && !wallet.is_default) loadRuleCount();
  }, [wallet, loadRuleCount]);

  function closeRulesPanel() {
    setRulesOpen(false);
    loadRuleCount();
  }

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

  async function handleEditSubmit(payload: { name: string; description?: string }) {
    if (!walletId) return;
    await updateWallet(walletId, payload);
    await loadWallet();
    toast.success("Cartera actualizada.");
  }

  // Mismo alcance que las tarjetas/gráficas (el periodo seleccionado arriba),
  // igual que el export de Ingresos/Egresos.
  async function handleExport(format: "csv" | "xlsx") {
    if (!wallet) return;
    setExportMenuOpen(false);
    setIsExporting(true);
    try {
      const range = getPeriodRange(period);
      await exportTransactions({
        format,
        ...range,
        category_id: filters.categoryId || undefined,
        wallet_id: wallet.is_default ? undefined : wallet.id,
      });
      toast.success("Exportación lista.");
    } catch {
      toast.error("No se pudo exportar. Intenta de nuevo.");
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoadingWallet) {
    return <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando cartera...</p>;
  }

  if (notFound || !wallet) {
    return (
      <div>
        <p className="text-negative mb-4">No se encontró la cartera.</p>
        <Link to="/wallets" className="text-accent hover:opacity-80">
          Volver a carteras
        </Link>
      </div>
    );
  }

  // El periodo (igual que en Ingresos/Egresos/Dashboard) SOLO acota tarjetas
  // y gráficas; el historial de abajo siempre muestra todo, sin importar el
  // periodo elegido aquí.
  const periodRange = getPeriodRange(period);
  const periodTransactions = transactions.filter((t) => {
    const d = t.date.slice(0, 10);
    return d >= periodRange.start_date && d <= periodRange.end_date;
  });

  const incomeTransactions = periodTransactions.filter((t) => t.type === "income");
  const expenseTransactions = periodTransactions.filter((t) => t.type === "expense");
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpenses;

  // Comparación vs. el periodo inmediatamente anterior (misma duración),
  // igual que en Ingresos/Egresos. null = "Todo" no tiene periodo previo.
  const previousRange = getPreviousPeriodRange(period);
  const previousPeriodTransactions = previousRange
    ? transactions.filter((t) => {
        const d = t.date.slice(0, 10);
        return d >= previousRange.start_date && d <= previousRange.end_date;
      })
    : [];
  const previousIncome = previousPeriodTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const previousExpenses = previousPeriodTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const previousBalance = previousIncome - previousExpenses;

  const incomeDelta = previousRange ? pctChange(totalIncome, previousIncome) : null;
  const expenseDelta = previousRange ? pctChange(totalExpenses, previousExpenses) : null;
  const balanceDelta = previousRange ? pctChange(balance, previousBalance) : null;

  const previousIncomeTransactions = previousPeriodTransactions.filter((t) => t.type === "income");
  const previousExpenseTransactions = previousPeriodTransactions.filter((t) => t.type === "expense");

  // Mayor movimiento por tipo: sin comparación vs. periodo anterior (igual
  // que en Ingresos/Egresos, es un dato puntual, no una tendencia).
  const highestIncome = incomeTransactions.length
    ? incomeTransactions.reduce((max, t) => (t.amount > max.amount ? t : max))
    : null;
  const highestExpense = expenseTransactions.length
    ? expenseTransactions.reduce((max, t) => (t.amount > max.amount ? t : max))
    : null;

  const monthlyAvgIncome = totalIncome / monthsSpanned(incomeTransactions);
  const monthlyAvgExpense = totalExpenses / monthsSpanned(expenseTransactions);
  const previousMonthlyAvgIncome = previousRange ? previousIncome / monthsSpanned(previousIncomeTransactions) : null;
  const previousMonthlyAvgExpense = previousRange ? previousExpenses / monthsSpanned(previousExpenseTransactions) : null;
  const monthlyAvgIncomeDelta = previousMonthlyAvgIncome !== null ? pctChange(monthlyAvgIncome, previousMonthlyAvgIncome) : null;
  const monthlyAvgExpenseDelta = previousMonthlyAvgExpense !== null ? pctChange(monthlyAvgExpense, previousMonthlyAvgExpense) : null;

  const transactionsCountDelta = previousRange ? pctChange(periodTransactions.length, previousPeriodTransactions.length) : null;

  // El filtro de categoría solo ofrece las categorías presentes en esta cartera.
  const presentCategoryIds = new Set(transactions.map((t) => t.category_id));
  const categoryOptions = categories
    .filter((c) => presentCategoryIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filtrado client-side: SOLO afecta la tabla, no las gráficas ni las tarjetas.
  const filteredTransactions = applyFilters(transactions, filters);

  return (
    <div>
      <button
        onClick={() => navigate("/wallets")}
        className="flex items-center gap-1 text-sm text-ink-muted-light dark:text-ink-muted-dark hover:text-accent mb-4"
      >
        <ArrowLeft size={16} />
        Carteras
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">{wallet.name}</h1>
          {wallet.description && (
            <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mt-1">{wallet.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell align="right" />
          {!wallet.is_default && (
            <button
              onClick={() => (rulesOpen ? closeRulesPanel() : setRulesOpen(true))}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line-dark dark:border-line-light bg-surface-dark/80 dark:bg-surface-light/80 text-ink-dark dark:text-ink-light font-medium hover:opacity-90"
            >
              <Settings2 size={16} />
              {rulesOpen ? "Ocultar reglas" : `Gestionar reglas${ruleCount !== null ? ` (${ruleCount})` : ""}`}
            </button>
          )}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line-dark dark:border-line-light bg-surface-dark/80 dark:bg-surface-light/80 text-ink-dark dark:text-ink-light font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
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
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90"
          >
            <Pencil size={16} />
            Editar
          </button>
        </div>
      </div>

      {!wallet.is_default && rulesOpen && (
        <div className="mb-6">
          <WalletRulesPanel wallet={wallet} onClose={closeRulesPanel} />
        </div>
      )}

      {error && <p className="text-negative mb-4">{error}</p>}

      {/* Selector de periodo: solo acota tarjetas y gráficas de abajo. */}
      <div className="flex flex-wrap gap-2 mb-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="Ingresos"
          value={formatCurrency(totalIncome)}
          icon={<TrendingUp size={22} />}
          tone="positive"
          delta={incomeDelta}
          higherIsBetter
          deltaLabel={PERIOD_COMPARISON_LABEL[period]}
        />
        <SummaryCard
          label="Egresos"
          value={formatCurrency(totalExpenses)}
          icon={<TrendingDown size={22} />}
          tone="negative"
          delta={expenseDelta}
          higherIsBetter={false}
          deltaLabel={PERIOD_COMPARISON_LABEL[period]}
        />
        <SummaryCard
          label="Balance"
          value={formatCurrency(balance)}
          icon={<WalletIcon size={22} />}
          tone={balance >= 0 ? "positive" : "negative"}
          delta={balanceDelta}
          higherIsBetter
          deltaLabel={PERIOD_COMPARISON_LABEL[period]}
        />
        <SummaryCard
          label="Total de transacciones"
          value={String(periodTransactions.length)}
          icon={<Receipt size={22} />}
          delta={transactionsCountDelta}
          deltaLabel={PERIOD_COMPARISON_LABEL[period]}
        />
        <SummaryCard
          label="Mayor ingreso"
          value={highestIncome ? formatCurrency(highestIncome.amount) : "—"}
          subtitle={highestIncome ? `${highestIncome.name} · ${new Date(highestIncome.date).toLocaleDateString("es-MX")}` : null}
          icon={<Trophy size={22} />}
          tone="positive"
        />
        <SummaryCard
          label="Mayor egreso"
          value={highestExpense ? formatCurrency(highestExpense.amount) : "—"}
          subtitle={highestExpense ? `${highestExpense.name} · ${new Date(highestExpense.date).toLocaleDateString("es-MX")}` : null}
          icon={<Trophy size={22} />}
          tone="negative"
        />
        <SummaryCard
          label="Promedio mensual (ingresos)"
          value={formatCurrency(monthlyAvgIncome)}
          icon={<CalendarDays size={22} />}
          tone="positive"
          delta={monthlyAvgIncomeDelta}
          higherIsBetter
          deltaLabel={PERIOD_COMPARISON_LABEL[period]}
        />
        <SummaryCard
          label="Promedio mensual (egresos)"
          value={formatCurrency(monthlyAvgExpense)}
          icon={<CalendarDays size={22} />}
          tone="negative"
          delta={monthlyAvgExpenseDelta}
          higherIsBetter={false}
          deltaLabel={PERIOD_COMPARISON_LABEL[period]}
        />
      </div>

      {isLoadingTransactions ? (
        <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando movimientos...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <TimeBarChart transactions={incomeTransactions} color="#10b981" period={period} title="Ingresos" />
            <TimeBarChart transactions={expenseTransactions} color="#b91c1c" period={period} title="Egresos" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <CategoryDonut transactions={incomeTransactions} categories={categories} title="Ingresos por categoría" />
            <CategoryDonut transactions={expenseTransactions} categories={categories} title="Egresos por categoría" />
          </div>

          <TransactionFilters
            filters={filters}
            onChange={setFilters}
            categories={categoryOptions}
            resultCount={filteredTransactions.length}
            totalCount={transactions.length}
          />
          <TransactionTable transactions={filteredTransactions} categories={categories} />
        </>
      )}

      {modalOpen && (
        <WalletFormModal wallet={wallet} onClose={() => setModalOpen(false)} onSubmit={handleEditSubmit} />
      )}
    </div>
  );
}
