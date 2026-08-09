import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  X,
  Repeat,
  Clock,
  Trophy,
  AlertTriangle,
  XCircle,
  CheckCheck,
} from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import type { AppNotification, NotificationType } from "../../types";

// Icono + color de acento por tipo de notificación (tokens semánticos).
const TYPE_META: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  RECURRING_EXECUTED: { icon: Repeat, color: "text-accent" },
  RECURRING_PENDING: { icon: Clock, color: "text-accent" },
  GOAL_ACHIEVED: { icon: Trophy, color: "text-positive" },
  GOAL_EXCEEDED: { icon: AlertTriangle, color: "text-negative" },
  GOAL_FAILED: { icon: XCircle, color: "text-negative" },
};

// entity_type del backend → ruta del frontend.
const ENTITY_ROUTE: Record<string, string> = {
  recurring_transaction: "/recurring",
  goal: "/goals",
};

// Ancho del panel y margen mínimo contra los bordes de la pantalla.
// Deben coincidir con las clases `w-80` y `max-w-[calc(100vw-2rem)]` de abajo.
const PANEL_WIDTH = 320;
const VIEWPORT_MARGIN = 16;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell({ align = "right" }: { align?: "right" | "left" }) {
  const { notifications, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // El panel se ancla al botón (`right-0`), pero en móvil la campana no es el
  // último icono del header: tiene tema/historial/ajustes a su derecha. Anclado
  // así, sus 320px de ancho se salían por el borde izquierdo mientras sobraba
  // hueco a la derecha. Medimos el botón y desplazamos el panel lo justo para
  // que quepa, en vez de fijar un offset por breakpoint.
  useLayoutEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    function reposition() {
      const anchor = ref.current?.getBoundingClientRect();
      if (!anchor) return;
      const vw = document.documentElement.clientWidth;
      const width = Math.min(PANEL_WIDTH, vw - VIEWPORT_MARGIN * 2);
      // Posición natural del panel según el anclaje, sin corregir.
      const left = align === "right" ? anchor.right - width : anchor.left;
      const clamped = Math.min(
        Math.max(left, VIEWPORT_MARGIN),
        vw - VIEWPORT_MARGIN - width,
      );
      setShift(clamped - left);
    }
    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [open, align]);

  function handleClick(n: AppNotification) {
    if (!n.is_read) markRead(n.id);
    const route = n.entity_type ? ENTITY_ROUTE[n.entity_type] : undefined;
    if (route) {
      setOpen(false);
      navigate(route);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-md text-ink-muted-light dark:text-ink-muted-dark hover:text-ink-light dark:hover:text-ink-dark hover:bg-surface-light dark:hover:bg-surface-dark"
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-negative text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
          className={`absolute z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark shadow-xl overflow-hidden ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-line-light dark:border-line-dark">
            <span className="text-sm font-semibold text-ink-light dark:text-ink-dark">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-xs text-accent hover:opacity-80"
              >
                <CheckCheck size={14} /> Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted-light dark:text-ink-muted-dark">
                No tienes notificaciones.
              </p>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_META[n.type];
                const Icon = meta?.icon ?? Bell;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-line-light dark:border-line-dark last:border-0 cursor-pointer hover:bg-surface-light dark:hover:bg-surface-dark ${
                      n.is_read ? "opacity-60" : ""
                    }`}
                    onClick={() => handleClick(n)}
                  >
                    <Icon size={17} className={`mt-0.5 shrink-0 ${meta?.color ?? "text-accent"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink-light dark:text-ink-dark truncate">{n.title}</p>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                      </div>
                      <p className="text-xs text-ink-muted-light dark:text-ink-muted-dark mt-0.5 break-words">{n.message}</p>
                      <p className="text-[11px] text-ink-muted-light dark:text-ink-muted-dark mt-1">{relativeTime(n.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(n.id);
                      }}
                      className="shrink-0 text-ink-muted-light dark:text-ink-muted-dark hover:text-negative"
                      aria-label="Descartar"
                    >
                      <X size={15} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
