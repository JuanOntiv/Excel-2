
import { useCallback, useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Wallet as WalletIcon, Receipt } from "lucide-react";
import { listTransactions, getTransactionsSummary } from "../api/transactions";
import type { TransactionsSummary } from "../api/transactions";
import { listCategories } from "../api/categories";
import { listGoals } from "../api/goals";
import { listWallets } from "../api/wallets";
import {
  getPeriodRange,
  getPreviousPeriodRange,
  formatCurrency,
  PERIOD_OPTIONS,
  PERIOD_NOUN,
  PERIOD_COMPARISON_LABEL,
} from "../utils/date";
import type { Period } from "../utils/date";
import { SummaryCard } from "../components/dashboard/SummaryCard";
import { MonthlyTrendChart } from "../components/dashboard/MonthlyTrendChart";
import { ExpenseDonut } from "../components/dashboard/ExpenseDonut";
import { GoalsPreview, WalletsPreview, RecentTransactionsPreview } from "../components/dashboard/panels";
import { NotificationBell } from "../components/notifications/NotificationBell";
import type { Transaction, Category, Goal, Wallet } from "../types";

/** Variación % respecto al periodo anterior equivalente. null = no hay base para comparar. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Subtítulo bajo el título: rango de fechas de la ventana móvil seleccionada. */
function rangeLabel(period: Period, range: { start_date: string; end_date: string }): string {
  if (period === "all") return "Todo el historial";
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(range.start_date)} – ${fmt(range.end_date)}`;
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("month");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionsSummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<TransactionsSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const currentRange = getPeriodRange(period);
      const previousRange = getPreviousPeriodRange(period);

      const [current, previous, currentSummary, previousSummary, cats, goalsData, walletsData] =
        await Promise.all([
          listTransactions({ ...currentRange, limit: 1000 }),
          previousRange ? listTransactions({ ...previousRange, limit: 1000 }) : Promise.resolve([]),
          getTransactionsSummary(currentRange),
          previousRange ? getTransactionsSummary(previousRange) : Promise.resolve(null),
          listCategories(),
          listGoals(),
          listWallets(),
        ]);
      setTransactions(current);
      setPrevTransactions(previous);
      setSummary(currentSummary);
      setPrevSummary(previousSummary);
      setCategories(cats);
      setGoals(goalsData);
      setWallets(walletsData);
    } catch {
      setError("No se pudieron cargar los datos del periodo.");
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalIncome = summary?.total_income ?? 0;
  const totalExpenses = summary?.total_expenses ?? 0;
  const balance = summary?.balance ?? 0;
  const transactionsCount = summary?.count ?? 0;

  const prevIncome = prevSummary?.total_income ?? 0;
  const prevExpenses = prevSummary?.total_expenses ?? 0;
  const prevBalance = prevSummary?.balance ?? 0;
  const prevTransactionsCount = prevSummary?.count ?? 0;

  const expenseTx = transactions.filter((t) => t.type === "expense");
  const defaultWallet = wallets.find((w) => w.is_default);
  const currentRange = getPeriodRange(period);

  if (isLoading) {
    return <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando resumen...</p>;
  }

  if (error) {
    return <p className="text-negative">{error}</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">Resumen</h1>
        <NotificationBell align="right" />
      </div>
      <p className="text-ink-muted-light dark:text-ink-muted-dark mb-4 capitalize">
        {rangeLabel(period, currentRange)}
      </p>

      {/* Selector de periodo: mismo patrón que Ingresos/Egresos */}
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

      {/* KPIs con comparación vs. periodo anterior equivalente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label={`Ingresos ${PERIOD_NOUN[period]}`}
          value={formatCurrency(totalIncome)}
          icon={<TrendingUp size={20} />}
          tone="positive"
          delta={prevSummary ? pctChange(totalIncome, prevIncome) : null}
          higherIsBetter
          deltaLabel={PERIOD_COMPARISON_LABEL[period]}
        />
        <SummaryCard
          label={`Egresos ${PERIOD_NOUN[period]}`}
          value={formatCurrency(totalExpenses)}
          icon={<TrendingDown size={20} />}
          tone="negative"
          delta={prevSummary ? pctChange(totalExpenses, prevExpenses) : null}
          higherIsBetter={false}
          deltaLabel={PERIOD_COMPARISON_LABEL[period]}
        />
        <SummaryCard
          label={`Balance ${PERIOD_NOUN[period]}`}
          value={formatCurrency(balance)}
          icon={<WalletIcon size={20} />}
          tone={balance >= 0 ? "positive" : "negative"}
          delta={prevSummary ? pctChange(balance, prevBalance) : null}
          higherIsBetter
          deltaLabel={PERIOD_COMPARISON_LABEL[period]}
        />
        <SummaryCard
          label={`Transacciones ${PERIOD_NOUN[period]}`}
          value={String(transactionsCount)}
          icon={<Receipt size={20} />}
          delta={prevSummary ? pctChange(transactionsCount, prevTransactionsCount) : null}
          deltaLabel={PERIOD_COMPARISON_LABEL[period]}
        />
      </div>

      {/* Gráficas: tendencia + distribución de gastos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <MonthlyTrendChart transactions={transactions} period={period} />
        <ExpenseDonut transactions={expenseTx} categories={categories} />
      </div>

      {/* Paneles de acceso rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <GoalsPreview goals={goals} />
        <WalletsPreview wallets={wallets} />
        <RecentTransactionsPreview
          transactions={[...transactions, ...prevTransactions]}
          categories={categories}
          walletTo={defaultWallet ? `/wallets/${defaultWallet.id}` : undefined}
        />
      </div>
    </div>
  );
}
