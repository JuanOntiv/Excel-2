import { useState, useEffect, useCallback } from "react";
import { PlusCircle, Pencil, Trash2, LogIn, LogOut, Eye, History as HistoryIcon } from "lucide-react";
import { listLogs } from "../api/logs";
import { NotificationBell } from "../components/notifications/NotificationBell";
import type { ActivityLog, LogAction } from "../types";

const PAGE_SIZE = 30;

const ACTION_LABELS: Record<LogAction, string> = {
  CREATE: "Creaste",
  UPDATE: "Editaste",
  DELETE: "Eliminaste",
  READ: "Consultaste",
  LOGIN: "Iniciaste sesión",
  LOGOUT: "Cerraste sesión",
};

const ACTION_ICONS: Record<LogAction, typeof PlusCircle> = {
  CREATE: PlusCircle,
  UPDATE: Pencil,
  DELETE: Trash2,
  READ: Eye,
  LOGIN: LogIn,
  LOGOUT: LogOut,
};

const ACTION_COLORS: Record<LogAction, string> = {
  CREATE: "bg-accent-soft text-accent dark:bg-accent/20 dark:text-accent-dark",
  UPDATE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  DELETE: "bg-negative/10 text-negative",
  READ: "bg-line-light text-ink-muted-light dark:bg-line-dark dark:text-ink-muted-dark",
  LOGIN: "bg-accent-soft text-accent dark:bg-accent/20 dark:text-accent-dark",
  LOGOUT: "bg-line-light text-ink-muted-light dark:bg-line-dark dark:text-ink-muted-dark",
};

const TABLE_LABELS: Record<string, string> = {
  transactions: "una transacción",
  wallets: "una cartera",
  categories: "una categoría",
  wallet_rules: "una regla de cartera",
  goals: "una meta",
  recurring_transactions: "una transacción recurrente",
  users: "tu cuenta",
};

const ACTION_FILTERS: { value: LogAction | ""; label: string }[] = [
  { value: "", label: "Todas las acciones" },
  { value: "CREATE", label: "Creaciones" },
  { value: "UPDATE", label: "Ediciones" },
  { value: "DELETE", label: "Eliminaciones" },
];

function describe(log: ActivityLog): string {
  const verb = ACTION_LABELS[log.action] ?? log.action;
  if (log.action === "LOGIN" || log.action === "LOGOUT" || !log.table) return verb;
  const subject = TABLE_LABELS[log.table] ?? log.table;
  return `${verb} ${subject}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function History() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [actionFilter, setActionFilter] = useState<LogAction | "">("");

  const load = useCallback(async (filter: LogAction | "") => {
    setIsLoading(true);
    try {
      const data = await listLogs({
        skip: 0,
        limit: PAGE_SIZE,
        action: filter || undefined,
      });
      setLogs(data);
      setHasMore(data.length === PAGE_SIZE);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(actionFilter);
  }, [load, actionFilter]);

  async function loadMore() {
    setIsLoadingMore(true);
    try {
      const data = await listLogs({
        skip: logs.length,
        limit: PAGE_SIZE,
        action: actionFilter || undefined,
      });
      setLogs((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">Historial</h1>
        <NotificationBell align="right" />
      </div>

      <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-4">
        Registro de los cambios que has hecho en tu cuenta: transacciones, carteras, categorías, metas y más.
      </p>

      <div className="flex gap-2 mb-4">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as LogAction | "")}
          className="px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark text-sm text-ink-light dark:text-ink-dark"
        >
          {ACTION_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando historial...</p>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-ink-muted-light dark:text-ink-muted-dark">
          <HistoryIcon size={32} className="mb-2 opacity-50" />
          <p>Sin actividad registrada todavía.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark divide-y divide-line-light dark:divide-line-dark">
          {logs.map((log) => {
            const Icon = ACTION_ICONS[log.action] ?? Eye;
            return (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ACTION_COLORS[log.action]}`}>
                  <Icon size={15} />
                </span>
                <p className="flex-1 text-sm text-ink-light dark:text-ink-dark">{describe(log)}</p>
                <span className="text-xs text-ink-muted-light dark:text-ink-muted-dark whitespace-nowrap">
                  {formatDateTime(log.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && logs.length > 0 && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-4 py-2 rounded-lg border border-line-light dark:border-line-dark text-sm text-ink-light dark:text-ink-dark hover:bg-surface-light dark:hover:bg-surface-dark disabled:opacity-50"
          >
            {isLoadingMore ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      )}
    </div>
  );
}
