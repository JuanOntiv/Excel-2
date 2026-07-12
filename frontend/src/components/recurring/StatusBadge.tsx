import type { RecurringStatus } from "../../types";

const styles: Record<RecurringStatus, string> = {
  active: "bg-accent-soft text-accent dark:bg-accent/20 dark:text-accent-dark",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  cancelled: "bg-line-light text-ink-muted-light dark:bg-line-dark dark:text-ink-muted-dark",
};

const labels: Record<RecurringStatus, string> = {
  active: "Activa",
  paused: "Pausada",
  cancelled: "Cancelada",
};

export function StatusBadge({ status }: { status: RecurringStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
