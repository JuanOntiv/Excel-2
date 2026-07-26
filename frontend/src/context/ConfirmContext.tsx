import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

type ConfirmContextType = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  function handle(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-surface-elevated-light dark:bg-surface-elevated-dark border border-line-light dark:border-line-dark p-6">
            <h2 className="text-lg font-semibold text-ink-light dark:text-ink-dark mb-2">
              {pending.title ?? "Confirmar"}
            </h2>
            <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-5">{pending.message}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handle(false)}
                autoFocus
                className="flex-1 px-4 py-2 rounded-lg border border-line-light dark:border-line-dark text-ink-light dark:text-ink-dark"
              >
                {pending.cancelLabel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => handle(true)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-white hover:opacity-90 ${
                  pending.tone === "danger" ? "bg-negative" : "bg-accent"
                }`}
              >
                {pending.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextType {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return context;
}
