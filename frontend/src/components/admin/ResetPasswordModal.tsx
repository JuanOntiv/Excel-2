import { useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { resetUserPassword } from "../../api/admin";
import { validatePasswordStrength, PASSWORD_REQUIREMENTS } from "../../utils/password";
import type { User } from "../../types";

interface Props {
  user: User;
  onClose: () => void;
  onDone: () => void;
}

// Modal para que un admin fije una nueva contrasena a un usuario. No pide la
// contrasena actual (a diferencia de la de Settings): es una accion
// administrativa. El backend revoca las sesiones del usuario al aplicarla.
export function ResetPasswordModal({ user, onClose, onDone }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const weakness = validatePasswordStrength(newPassword);
    if (weakness) {
      setError(weakness);
      return;
    }
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetUserPassword(user.id, newPassword);
      onDone();
      onClose();
    } catch (err: any) {
      if (err?.response?.status === 400) {
        setError(err.response.data?.detail ?? "No se pudo restablecer la contraseña.");
      } else {
        setError("No se pudo restablecer la contraseña.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface-elevated-light dark:bg-surface-elevated-dark border border-line-light dark:border-line-dark p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-ink-light dark:text-ink-dark">Restablecer contraseña</h2>
          <button onClick={onClose} className="text-ink-muted-light dark:text-ink-muted-dark">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-4">
          Para <span className="font-medium text-ink-light dark:text-ink-dark">{user.name}</span> ({user.mail}).
          Cerrará todas sus sesiones activas.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              autoFocus
              className={inputClass}
            />
            <p className="mt-1 text-xs text-ink-muted-light dark:text-ink-muted-dark">{PASSWORD_REQUIREMENTS}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-negative">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-line-light dark:border-line-dark text-ink-light dark:text-ink-dark">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-50">
              {isSubmitting ? "Aplicando..." : "Restablecer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
