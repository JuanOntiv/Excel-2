import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Sun, Moon, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { updateProfile, deactivateAccount, changePassword, logoutAllDevices } from "../api/users";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { validatePasswordStrength, getPasswordChecks, PASSWORD_REQUIREMENTS } from "../utils/password";
import { AVATAR_OPTIONS, getAvatarIcon } from "../utils/avatars";

export default function Settings() {
  const { user, refreshUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [mail, setMail] = useState(user?.mail ?? "");
  const [avatarKey, setAvatarKey] = useState(user?.avatar_key ?? null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setIsSavingProfile(true);
    try {
      await updateProfile({ name, mail, avatar_key: avatarKey });
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

  async function handleLogoutAllDevices() {
    const ok = await confirm({
      message: "¿Cerrar sesión en todos los dispositivos? Tendrás que volver a iniciar sesión aquí y en cualquier otro lugar donde estés conectado.",
      tone: "danger",
    });
    if (!ok) return;
    setIsLoggingOutAll(true);
    try {
      await logoutAllDevices();
      await logout();
      navigate("/");
    } catch {
      toast.error("No se pudo cerrar sesión en todos los dispositivos.");
      setIsLoggingOutAll(false);
    }
  }

  async function handleDeactivate() {
    const ok = await confirm({
      message: "¿Desactivar tu cuenta? Podrás recuperarla contactando soporte, pero perderás acceso inmediato.",
      tone: "danger",
    });
    if (!ok) return;
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark">Configuración</h1>
        {/* En móvil ya está la campana de MobileHeader; esta es solo para desktop. */}
        <div className="hidden md:block">
          <NotificationBell align="right" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Perfil */}
      <section className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-ink-light dark:text-ink-dark">Perfil</h2>
          <div className="flex items-center gap-2">
            {user?.is_admin && (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-accent/10 text-accent">
                <ShieldCheck size={13} />
                Administrador
              </span>
            )}
            {user?.created_at && (
              <span className="text-xs text-ink-muted-light dark:text-ink-muted-dark">
                Miembro desde {new Date(user.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-ink-light dark:text-ink-dark">Avatar</label>
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 text-accent shrink-0">
                {(() => {
                  const SelectedIcon = getAvatarIcon(avatarKey);
                  return SelectedIcon ? <SelectedIcon size={26} /> : <UserIcon size={24} />;
                })()}
              </div>
              <div className="flex flex-wrap gap-2">
                {AVATAR_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = avatarKey === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      title={option.label}
                      aria-label={option.label}
                      aria-pressed={isSelected}
                      onClick={() => setAvatarKey(isSelected ? null : option.key)}
                      className={`flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${
                        isSelected
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-line-light dark:border-line-dark text-ink-muted-light dark:text-ink-muted-dark hover:border-accent/50"
                      }`}
                    >
                      <Icon size={17} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      <section className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {newPassword ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {getPasswordChecks(newPassword).map((check) => (
                    <li
                      key={check.label}
                      className={`flex items-center gap-1.5 text-xs ${
                        check.met ? "text-positive" : "text-ink-muted-light dark:text-ink-muted-dark"
                      }`}
                    >
                      {check.met ? <Check size={13} /> : <X size={13} />}
                      {check.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-ink-muted-light dark:text-ink-muted-dark">{PASSWORD_REQUIREMENTS}</p>
              )}
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

      {/* Preferencias */}
      <section className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
        <h2 className="text-lg font-medium text-ink-light dark:text-ink-dark mb-4">Preferencias</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink-light dark:text-ink-dark">Tema</p>
            <p className="text-xs text-ink-muted-light dark:text-ink-muted-dark">
              También puedes cambiarlo desde el menú lateral.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              theme === "dark" ? "bg-amber-500/15 text-amber-500" : "bg-violet-500/15 text-violet-500"
            }`}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>
        </div>
      </section>

      {/* Zona de peligro */}
      <section className="rounded-xl border border-negative/30 bg-surface-elevated-light dark:bg-surface-elevated-dark p-5">
        <h2 className="text-lg font-medium text-negative mb-4">Zona de peligro</h2>

        <div className="flex flex-col gap-3 pb-4 mb-4 border-b border-line-light dark:border-line-dark">
          <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark">
            Cierra la sesión en cualquier otro dispositivo o navegador donde hayas iniciado sesión, incluida esta.
          </p>
          <button
            onClick={handleLogoutAllDevices}
            disabled={isLoggingOutAll}
            className="self-start px-4 py-2 rounded-lg border border-negative text-negative font-medium hover:bg-negative/10 disabled:opacity-50"
          >
            {isLoggingOutAll ? "Cerrando sesiones..." : "Cerrar sesión en todos los dispositivos"}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark">
            Desactivar tu cuenta cerrará tu sesión y ocultará tu acceso. Tus datos no se eliminan de inmediato.
          </p>
          <button
            onClick={handleDeactivate}
            disabled={isDeactivating}
            className="self-start px-4 py-2 rounded-lg border border-negative text-negative font-medium hover:bg-negative/10 disabled:opacity-50"
          >
            {isDeactivating ? "Desactivando..." : "Desactivar cuenta"}
          </button>
        </div>
      </section>

      </div>
    </div>
  );
}
