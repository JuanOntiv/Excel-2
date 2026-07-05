import { SummaryCard } from "../dashboard/SummaryCard";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { formatCurrency } from "../../utils/date";
import type { Transaction } from "../../types";

export function HighlightCards({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) return null;

  const highest = transactions.reduce((max, t) => (t.amount > max.amount ? t : max));
  const lowest = transactions.reduce((min, t) => (t.amount < min.amount ? t : min));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SummaryCard label={`Mayor: ${highest.name}`} value={formatCurrency(highest.amount)} icon={<ArrowUpCircle size={22} />} tone="positive" />
      <SummaryCard label={`Menor: ${lowest.name}`} value={formatCurrency(lowest.amount)} icon={<ArrowDownCircle size={22} />} tone="neutral" />
    </div>
  );
}
