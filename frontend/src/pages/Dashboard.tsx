
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Wallet as WalletIcon, Receipt } from "lucide-react";
import { listTransactions, getTransactionsSummary } from "../api/transactions";
import type { TransactionsSummary } from "../api/transactions";
import { listCategories } from "../api/categories";
import { listGoals } from "../api/goals";
import { listWallets } from "../api/wallets";
import { getCurrentMonthRange, getPreviousMonthRange, formatCurrency } from "../utils/date";
import { SummaryCard } from "../components/dashboard/SummaryCard";
import { MonthlyTrendChart } from "../components/dashboard/MonthlyTrendChart";
import { ExpenseDonut } from "../components/dashboard/ExpenseDonut";
import { GoalsPreview, WalletsPreview, RecentTransactionsPreview } from "../components/dashboard/panels";
import { NotificationBell } from "../components/notifications/NotificationBell";
import type { Transaction, Category, Goal, Wallet } from "../types";

/** Variación % respecto al mes anterior. null = no hay base para comparar. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionsSummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<TransactionsSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const currentRange = getCurrentMonthRange();
      const previousRange = getPreviousMonthRange();
      const [current, previous, currentSummary, previousSummary, cats, goalsData, walletsData] =
        await Promise.all([
          listTransactions({ ...currentRange, limit: 1000 }),
          listTransactions({ ...previousRange, limit: 1000 }),
          getTransactionsSummary(currentRange),
          getTransactionsSummary(previousRange),
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
      setError("No se pudieron cargar los datos del mes.");
    } finally {
      setIsLoading(false);
    }
  }

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

  const monthLabel = new Date().toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

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
      <p className="text-ink-muted-light dark:text-ink-muted-dark mb-6 capitalize">{monthLabel}</p>

      {/* KPIs con comparación vs. mes anterior */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Ingresos del mes"
          value={formatCurrency(totalIncome)}
          icon={<TrendingUp size={20} />}
          tone="positive"
          delta={pctChange(totalIncome, prevIncome)}
          higherIsBetter
        />
        <SummaryCard
          label="Egresos del mes"
          value={formatCurrency(totalExpenses)}
          icon={<TrendingDown size={20} />}
          tone="negative"
          delta={pctChange(totalExpenses, prevExpenses)}
          higherIsBetter={false}
        />
        <SummaryCard
          label="Balance"
          value={formatCurrency(balance)}
          icon={<WalletIcon size={20} />}
          tone={balance >= 0 ? "positive" : "negative"}
          delta={pctChange(balance, prevBalance)}
          higherIsBetter
        />
        <SummaryCard
          label="Transacciones"
          value={String(transactionsCount)}
          icon={<Receipt size={20} />}
          delta={pctChange(transactionsCount, prevTransactionsCount)}
        />
      </div>

      {/* Gráficas: tendencia diaria + distribución de gastos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <MonthlyTrendChart transactions={transactions} />
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
