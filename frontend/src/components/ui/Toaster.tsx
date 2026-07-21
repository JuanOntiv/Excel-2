import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import type { ToastType } from "../../context/ToastContext";

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

// Color del icono / borde de acento por tipo, usando los tokens semánticos.
const ACCENT: Record<ToastType, string> = {
  success: "text-positive",
  error: "text-negative",
  info: "text-accent",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            role="status"
            className="flex items-start gap-3 rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark shadow-lg px-4 py-3 animate-[toast-in_0.15s_ease-out]"
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${ACCENT[t.type]}`} />
            <p className="flex-1 text-sm text-ink-light dark:text-ink-dark">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-ink-muted-light dark:text-ink-muted-dark hover:text-ink-light dark:hover:text-ink-dark"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
