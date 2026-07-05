
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Wallet as WalletIcon, Receipt } from "lucide-react";
import { listTransactions } from "../api/transactions";
import { getCurrentMonthRange, formatCurrency } from "../utils/date";
import { SummaryCard } from "../components/dashboard/SummaryCard";
import type { Transaction } from "../types";

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentMonth();
  }, []);

  async function loadCurrentMonth() {
    setIsLoading(true);
    setError(null);
    try {
      const range = getCurrentMonthRange();
      const data = await listTransactions({ ...range, limit: 1000 });
      setTransactions(data);
    } catch {
      setError("No se pudieron cargar las transacciones del mes.");
    } finally {
      setIsLoading(false);
    }
  }

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  const monthLabel = new Date().toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  if (isLoading) {
    return <p className="text-gray-500 dark:text-gray-400">Cargando resumen...</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Resumen</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6 capitalize">{monthLabel}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Ingresos del mes"
          value={formatCurrency(totalIncome)}
          icon={<TrendingUp size={22} />}
          tone="positive"
        />
        <SummaryCard
          label="Egresos del mes"
          value={formatCurrency(totalExpenses)}
          icon={<TrendingDown size={22} />}
          tone="negative"
        />
        <SummaryCard
          label="Balance"
          value={formatCurrency(balance)}
          icon={<WalletIcon size={22} />}
          tone={balance >= 0 ? "positive" : "negative"}
        />
        <SummaryCard
          label="Transacciones"
          value={String(transactions.length)}
          icon={<Receipt size={22} />}
        />
      </div>
    </div>
  );
}
