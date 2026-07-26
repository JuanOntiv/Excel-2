import { useState, useEffect, useCallback } from "react";
import {
  PlusCircle,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  Eye,
  History as HistoryIcon,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { listLogs } from "../api/logs";
import { NotificationBell } from "../components/notifications/NotificationBell";
import type { ActivityLog, LogAction, LogLevel } from "../types";

// Carga TODOS los logs de una vez (como las transacciones) para poder
// filtrar/paginar en el cliente en vez de "cargar más" incremental.
const FETCH_LIMIT = 2000;
const PAGE_SIZE = 15;

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

const LEVEL_LABELS: Record<LogLevel, string> = {
  INFO: "Información",
  WARNING: "Advertencia",
  ERROR: "Error",
  SECURITY: "Seguridad",
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: "bg-line-light text-ink-muted-light dark:bg-line-dark dark:text-ink-muted-dark",
  WARNING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  ERROR: "bg-negative/10 text-negative",
  SECURITY: "bg-negative/10 text-negative",
};

const ACTION_FILTERS: { value: LogAction | ""; label: string }[] = [
  { value: "", label: "Todas las acciones" },
  { value: "CREATE", label: "Creaciones" },
  { value: "UPDATE", label: "Ediciones" },
  { value: "DELETE", label: "Eliminaciones" },
  { value: "READ", label: "Consultas" },
  { value: "LOGIN", label: "Inicios de sesión" },
  { value: "LOGOUT", label: "Cierres de sesión" },
];

const LEVEL_FILTERS: { value: LogLevel | ""; label: string }[] = [
  { value: "", label: "Todos los niveles" },
  { value: "INFO", label: "Información" },
  { value: "WARNING", label: "Advertencia" },
  { value: "ERROR", label: "Error" },
  { value: "SECURITY", label: "Seguridad" },
];

function subjectLabel(log: ActivityLog): string {
  if (!log.table) return "—";
  return TABLE_LABELS[log.table] ?? log.table;
}

function describe(log: ActivityLog): string {
  const verb = ACTION_LABELS[log.action] ?? log.action;
  if (log.action === "LOGIN" || log.action === "LOGOUT" || !log.table) return verb;
  if (log.detail) return `${verb} "${log.detail}"`;
  return `${verb} ${subjectLabel(log)}`;
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

interface LogFiltersState {
  search: string;
  action: LogAction | "";
  level: LogLevel | "";
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: LogFiltersState = { search: "", action: "", level: "", dateFrom: "", dateTo: "" };

function hasActiveFilters(f: LogFiltersState): boolean {
  return Boolean(f.search || f.action || f.level || f.dateFrom || f.dateTo);
}

function applyFilters(logs: ActivityLog[], f: LogFiltersState): ActivityLog[] {
  const search = f.search.trim().toLowerCase();
  return logs.filter((log) => {
    if (f.action && log.action !== f.action) return false;
    if (f.level && log.level !== f.level) return false;
    if (search) {
      const haystack = `${describe(log)} ${log.detail ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    const d = log.created_at.slice(0, 10); // YYYY-MM-DD
    if (f.dateFrom && d < f.dateFrom) return false;
    if (f.dateTo && d > f.dateTo) return false;
    return true;
  });
}

const inputClass =
  "px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent text-sm text-ink-light dark:text-ink-dark focus:outline-none focus:ring-2 focus:ring-accent";
const labelClass = "block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1";

export default function History() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<LogFiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listLogs({ skip: 0, limit: FETCH_LIMIT });
      setLogs(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function set(patch: Partial<LogFiltersState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = applyFilters(logs, filters);
  const active = hasActiveFilters(filters);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  // Al cambiar el filtro/resultados, vuelve a la primera página.
  useEffect(() => {
    setPage(0);
  }, [filters, logs.length]);

  useEffect(() => {
    setPageInput(String(currentPage + 1));
  }, [currentPage]);

  function handlePageInputChange(value: string) {
    setPageInput(value);
    if (value.trim() === "") return;
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return;
    setPage(Math.min(Math.max(n, 1), totalPages) - 1);
  }

  function handlePageInputBlur() {
    const n = parseInt(pageInput, 10);
    if (Number.isNaN(n)) setPageInput(String(currentPage + 1));
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

      <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className={labelClass}>Buscar</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted-light dark:text-ink-muted-dark" />
              <input
                value={filters.search}
                onChange={(e) => set({ search: e.target.value })}
                placeholder="Acción o detalle..."
                className={`${inputClass} w-full pl-9`}
              />
            </div>
          </div>

          <div className="min-w-[160px]">
            <label className={labelClass}>Acción</label>
            <select value={filters.action} onChange={(e) => set({ action: e.target.value as LogAction | "" })} className={`${inputClass} w-full`}>
              {ACTION_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[160px]">
            <label className={labelClass}>Nivel</label>
            <select value={filters.level} onChange={(e) => set({ level: e.target.value as LogLevel | "" })} className={`${inputClass} w-full`}>
              {LEVEL_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Desde</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Hasta</label>
            <input type="date" value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} className={inputClass} />
          </div>

          {active && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-ink-muted-light dark:text-ink-muted-dark hover:text-negative"
            >
              <X size={15} /> Limpiar
            </button>
          )}
        </div>

        {active && (
          <p className="mt-3 text-xs text-ink-muted-light dark:text-ink-muted-dark">
            Mostrando {filtered.length} de {logs.length}
          </p>
        )}
      </div>

      {isLoading ? (
        <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando historial...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-ink-muted-light dark:text-ink-muted-dark">
          <HistoryIcon size={32} className="mb-2 opacity-50" />
          <p>{logs.length === 0 ? "Sin actividad registrada todavía." : "Ningún registro coincide con los filtros."}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark overflow-hidden">
          <div className="divide-y divide-line-light dark:divide-line-dark">
            {pageItems.map((log) => {
              const Icon = ACTION_ICONS[log.action] ?? Eye;
              const isExpanded = expandedIds.has(log.id);
              return (
                <div key={log.id}>
                  <button
                    onClick={() => toggleExpanded(log.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-surface-light/60 dark:hover:bg-surface-dark/40"
                  >
                    <ChevronRight size={16} className={`shrink-0 text-ink-muted-light dark:text-ink-muted-dark transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ACTION_COLORS[log.action]}`}>
                      <Icon size={15} />
                    </span>
                    <p className="flex-1 text-sm text-ink-light dark:text-ink-dark">{describe(log)}</p>
                    <span className="text-xs text-ink-muted-light dark:text-ink-muted-dark whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </span>
                  </button>

                  <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm pl-14 pr-4 pb-4">
                        <div>
                          <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Nivel</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLORS[log.level]}`}>
                            {LEVEL_LABELS[log.level] ?? log.level}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Sección</span>
                          <span className="text-ink-light dark:text-ink-dark">{subjectLabel(log)}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-2">
                          <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Fecha completa</span>
                          <span className="text-ink-light dark:text-ink-dark">{formatDateTime(log.created_at)}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-4">
                          <span className="block text-xs font-medium text-ink-muted-light dark:text-ink-muted-dark mb-1">Detalle</span>
                          <span className="text-ink-light dark:text-ink-dark">{log.detail || "Sin detalle adicional."}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-line-light dark:border-line-dark text-sm text-ink-muted-light dark:text-ink-muted-dark">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                aria-label="Página anterior"
                className="p-2 rounded-lg border border-line-light dark:border-line-dark hover:bg-line-light/40 dark:hover:bg-line-dark/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => handlePageInputChange(e.target.value)}
                  onBlur={handlePageInputBlur}
                  className="w-14 px-2 py-1 rounded-lg border border-line-light dark:border-line-dark bg-transparent text-center text-ink-light dark:text-ink-dark focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <span>de {totalPages}</span>
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
                aria-label="Página siguiente"
                className="p-2 rounded-lg border border-line-light dark:border-line-dark hover:bg-line-light/40 dark:hover:bg-line-dark/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
