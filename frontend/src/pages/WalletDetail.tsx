import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, TrendingUp, TrendingDown, Wallet as WalletIcon } from "lucide-react";
import { getWallet, updateWallet } from "../api/wallets";
import { listCategories } from "../api/categories";
import { useWalletTransactions } from "../hooks/useWalletTransactions";
import { WalletFormModal } from "../components/wallets/WalletFormModal";
import { MonthlyChart } from "../components/transactions/MonthlyChart";
import { CategoryPieChart } from "../components/transactions/CategoryPieChart";
import { TransactionTable } from "../components/transactions/TransactionTable";
import { SummaryCard } from "../components/dashboard/SummaryCard";
import { formatCurrency } from "../utils/date";
import type { Wallet, Category } from "../types";

export default function WalletDetail() {
  const { walletId } = useParams<{ walletId: string }>();
  const navigate = useNavigate();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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

  useEffect(() => {
    loadWallet();
    listCategories().then(setCategories).catch(() => {});
  }, [loadWallet]);

  async function handleEditSubmit(payload: { name: string; description?: string }) {
    if (!walletId) return;
    await updateWallet(walletId, payload);
    await loadWallet();
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

  const incomeTransactions = transactions.filter((t) => t.type === "income");
  const expenseTransactions = transactions.filter((t) => t.type === "expense");
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpenses;

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
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line-light dark:border-line-dark text-ink-light dark:text-ink-dark hover:border-accent"
        >
          <Pencil size={16} />
          Editar
        </button>
      </div>

      {error && <p className="text-negative mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Ingresos" value={formatCurrency(totalIncome)} icon={<TrendingUp size={22} />} tone="positive" />
        <SummaryCard label="Egresos" value={formatCurrency(totalExpenses)} icon={<TrendingDown size={22} />} tone="negative" />
        <SummaryCard
          label="Balance"
          value={formatCurrency(balance)}
          icon={<WalletIcon size={22} />}
          tone={balance >= 0 ? "positive" : "negative"}
        />
      </div>

      {isLoadingTransactions ? (
        <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando movimientos...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <MonthlyChart transactions={incomeTransactions} color="#0f766e" title="Ingresos por mes" />
            <MonthlyChart transactions={expenseTransactions} color="#b91c1c" title="Egresos por mes" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <CategoryPieChart transactions={incomeTransactions} categories={categories} title="Ingresos por categoría" />
            <CategoryPieChart transactions={expenseTransactions} categories={categories} title="Egresos por categoría" />
          </div>

          <TransactionTable transactions={transactions} categories={categories} />
        </>
      )}

      {modalOpen && (
        <WalletFormModal wallet={wallet} onClose={() => setModalOpen(false)} onSubmit={handleEditSubmit} />
      )}
    </div>
  );
}
