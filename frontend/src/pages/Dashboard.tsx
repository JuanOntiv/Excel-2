
import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Wallet as WalletIcon, Receipt } from "lucide-react";
import { useTransactionsStore } from "../store/transactionsStore";
import { useGoalsStore } from "../store/goalsStore";
import { byPeriod, summarize } from "../store/selectors";
import { useCategories } from "../hooks/useCategories";
import { useWallets } from "../hooks/useWallets";
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

  const { categories } = useCategories();
  const { wallets } = useWallets();
  const goals = useGoalsStore((s) => s.items);

  // Todo sale de memoria (ver store/transactionsStore): ni transacciones ni
  // KPIs piden nada al servidor, así que cambiar de periodo es instantáneo.
  const items = useTransactionsStore((s) => s.items);
  const transactionsStatus = useTransactionsStore((s) => s.status);
  const transactionsError = useTransactionsStore((s) => s.error);

  const currentRange = useMemo(() => getPeriodRange(period), [period]);
  const previousRange = useMemo(() => getPreviousPeriodRange(period), [period]);
  const transactions = useMemo(() => byPeriod(items, currentRange), [items, currentRange]);
  const prevTransactions = useMemo(
    () => (previousRange ? byPeriod(items, previousRange) : []),
    [items, previousRange]
  );

  // Los KPIs sustituyen a GET /transactions/summary. Solo son válidos con la
  // carga COMPLETA: mientras el store esté en "partial" (varios lotes, >500
  // movimientos) los totales estarían incompletos, y un total incompleto se
  // lee igual que uno correcto. Por eso abajo se espera a "ready".
  const summary = useMemo(() => summarize(transactions), [transactions]);
  const prevSummary = useMemo(
    () => (previousRange ? summarize(prevTransactions) : null),
    [prevTransactions, previousRange]
  );

  const totalIncome = summary.total_income;
  const totalExpenses = summary.total_expenses;
  const balance = summary.balance;
  const transactionsCount = summary.count;

  const prevIncome = prevSummary?.total_income ?? 0;
  const prevExpenses = prevSummary?.total_expenses ?? 0;
  const prevBalance = prevSummary?.balance ?? 0;
  const prevTransactionsCount = prevSummary?.count ?? 0;

  const expenseTx = transactions.filter((t) => t.type === "expense");
  const defaultWallet = wallets.find((w) => w.is_default);

  if (transactionsStatus !== "ready" && transactionsStatus !== "error") {
    return <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando resumen...</p>;
  }

  // Sin esto, un fallo de carga pintaría los KPIs en cero, que se leen como
  // "no tienes movimientos" en lugar de "no pudimos cargarlos".
  if (transactionsStatus === "error") {
    return <p className="text-negative">{transactionsError ?? "No se pudieron cargar los datos del periodo."}</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-ink-light dark:text-ink-dark">Resumen</h1>
        {/* En móvil ya está la campana de MobileHeader; esta es solo para desktop. */}
        <div className="hidden md:block">
          <NotificationBell align="right" />
        </div>
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
