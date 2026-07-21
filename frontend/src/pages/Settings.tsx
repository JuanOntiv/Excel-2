import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { updateProfile, deactivateAccount, changePassword } from "../api/users";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { validatePasswordStrength, PASSWORD_REQUIREMENTS } from "../utils/password";

export default function Settings() {
  const { user, refreshUser, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [mail, setMail] = useState(user?.mail ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [isDeactivating, setIsDeactivating] = useState(false);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setIsSavingProfile(true);
    try {
      await updateProfile({ name, mail });
      await refreshUser();
      toast.success("Perfil actualizado.");
    } catch (err: any) {
      if (err?.response?.status === 400) {
        setProfileError("Ese correo ya está en uso.");
      } else {
        setProfileError("No se pudo actualizar el perfil.");
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    const weakness = validatePasswordStrength(newPassword);
    if (weakness) {
      setPasswordError(weakness);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    setIsSavingPassword(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contraseña actualizada.");
    } catch (err: any) {
      if (err?.response?.status === 400) {
        setPasswordError("La contraseña actual es incorrecta.");
      } else {
        setPasswordError("No se pudo actualizar la contraseña.");
      }
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleDeactivate() {
    if (!confirm("¿Desactivar tu cuenta? Podrás recuperarla contactando soporte, pero perderás acceso inmediato.")) {
      return;
    }
    setIsDeactivating(true);
    try {
      await deactivateAccount();
      await logout();
      navigate("/");
    } catch {
      toast.error("No se pudo desactivar la cuenta.");
      setIsDeactivating(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">Configuración</h1>
        <NotificationBell align="right" />
      </div>

      {/* Perfil */}
      <section className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5 mb-6">
        <h2 className="text-lg font-medium text-ink-light dark:text-ink-dark mb-4">Perfil</h2>
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Correo</label>
            <input
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {profileError && <p className="text-sm text-negative">{profileError}</p>}

          <button
            type="submit"
            disabled={isSavingProfile}
            className="self-start px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isSavingProfile ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </section>

      {/* Contraseña */}
      <section className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5 mb-6">
        <h2 className="text-lg font-medium text-ink-light dark:text-ink-dark mb-4">Cambiar contraseña</h2>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Contraseña actual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="mt-1 text-xs text-ink-muted-light dark:text-ink-muted-dark">{PASSWORD_REQUIREMENTS}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-ink-light dark:text-ink-dark">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-transparent focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {passwordError && <p className="text-sm text-negative">{passwordError}</p>}

          <button
            type="submit"
            disabled={isSavingPassword}
            className="self-start px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isSavingPassword ? "Guardando..." : "Actualizar contraseña"}
          </button>
        </form>
      </section>

      {/* Zona de peligro */}
      <section className="rounded-xl border border-negative/30 bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
        <h2 className="text-lg font-medium text-negative mb-2">Zona de peligro</h2>
        <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-4">
          Desactivar tu cuenta cerrará tu sesión y ocultará tu acceso. Tus datos no se eliminan de inmediato.
        </p>
        <button
          onClick={handleDeactivate}
          disabled={isDeactivating}
          className="px-4 py-2 rounded-lg border border-negative text-negative font-medium hover:bg-negative/10 disabled:opacity-50"
        >
          {isDeactivating ? "Desactivando..." : "Desactivar cuenta"}
        </button>
      </section>
    </div>
  );
}
