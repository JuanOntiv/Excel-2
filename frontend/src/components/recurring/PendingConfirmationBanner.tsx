import { AlertCircle } from "lucide-react";
import type { RecurringTransaction } from "../../types";
import { formatCurrency } from "../../utils/date";

interface Props {
  pending: RecurringTransaction[];
  onConfirm: (trx: RecurringTransaction) => void;
}

export function PendingConfirmationBanner({ pending, onConfirm }: Props) {
  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3 text-amber-800 dark:text-amber-400">
        <AlertCircle size={18} />
        <span className="font-medium text-sm">
          {pending.length} recurrencia{pending.length > 1 ? "s" : ""} esperando confirmación
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {pending.map((trx) => (
          <div key={trx.id} className="flex items-center justify-between text-sm">
            <span>{trx.name} — {formatCurrency(trx.amount)}</span>
            <button
              onClick={() => onConfirm(trx)}
              className="px-3 py-1 rounded-lg bg-accent text-white text-xs font-medium hover:opacity-90"
            >
              Confirmar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
