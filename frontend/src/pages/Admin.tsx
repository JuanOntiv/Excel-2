import { useState, useEffect, useCallback } from "react";
import { KeyRound, UserX, UserCheck, ShieldCheck } from "lucide-react";
import { listUsers, deactivateUser, reactivateUser } from "../api/admin";
import { ResetPasswordModal } from "../components/admin/ResetPasswordModal";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import type { User } from "../types";

export default function Admin() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [resetting, setResetting] = useState<User | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setUsers(await listUsers(includeInactive));
    } finally {
      setIsLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeactivate(u: User) {
    if (!confirm(`¿Desactivar la cuenta de ${u.name}? No podrá iniciar sesión.`)) return;
    setBusyId(u.id);
    try {
      await deactivateUser(u.id);
      await load();
      toast.success(`Cuenta de ${u.name} desactivada.`);
    } catch {
      toast.error("No se pudo desactivar el usuario.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(u: User) {
    setBusyId(u.id);
    try {
      await reactivateUser(u.id);
      await load();
      toast.success(`Cuenta de ${u.name} reactivada.`);
    } catch {
      toast.error("No se pudo reactivar el usuario.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-ink-light dark:text-ink-dark flex items-center gap-2">
          <ShieldCheck size={22} className="text-accent" />
          Administración
        </h1>
        <div className="flex items-center gap-3">
          <NotificationBell align="right" />
          <label className="flex items-center gap-2 text-sm text-ink-muted-light dark:text-ink-muted-dark">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="accent-accent"
            />
            Mostrar inactivos
          </label>
        </div>
      </div>

      <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-4">
        Gestión de cuentas de usuario. Puedes restablecer contraseñas y activar o desactivar el acceso.
        Las cuentas de administrador no se pueden desactivar ni modificar desde aquí.
      </p>

      {isLoading ? (
        <p className="text-ink-muted-light dark:text-ink-muted-dark">Cargando usuarios...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-light dark:border-line-dark text-left text-ink-muted-light dark:text-ink-muted-dark">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                // El backend bloquea acciones sobre otros admins; reflejamos
                // eso en la UI deshabilitando sus botones (y los propios).
                const locked = u.is_admin;
                const busy = busyId === u.id;

                return (
                  <tr key={u.id} className="border-b border-line-light dark:border-line-dark last:border-0">
                    <td className="px-4 py-3 text-ink-light dark:text-ink-dark">
                      <span className="flex items-center gap-2">
                        {u.name}
                        {u.is_admin && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">
                            {isSelf ? "Tú" : "Admin"}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted-light dark:text-ink-muted-dark">{u.mail}</td>
                    <td className="px-4 py-3">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-positive">
                          <span className="w-1.5 h-1.5 rounded-full bg-positive" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-ink-muted-light dark:text-ink-muted-dark">
                          <span className="w-1.5 h-1.5 rounded-full bg-ink-muted-light dark:bg-ink-muted-dark" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setResetting(u)}
                          disabled={locked || busy}
                          title="Restablecer contraseña"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line-light dark:border-line-dark text-ink-light dark:text-ink-dark hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-line-light disabled:hover:text-ink-light"
                        >
                          <KeyRound size={15} />
                          <span className="hidden sm:inline">Contraseña</span>
                        </button>

                        {u.is_active ? (
                          <button
                            onClick={() => handleDeactivate(u)}
                            disabled={locked || busy}
                            title="Desactivar cuenta"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-negative/40 text-negative hover:bg-negative/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            <UserX size={15} />
                            <span className="hidden sm:inline">Desactivar</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(u)}
                            disabled={busy}
                            title="Reactivar cuenta"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-positive/40 text-positive hover:bg-positive/10 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <UserCheck size={15} />
                            <span className="hidden sm:inline">Reactivar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {users.length === 0 && (
            <p className="px-4 py-6 text-ink-muted-light dark:text-ink-muted-dark">No hay usuarios que mostrar.</p>
          )}
        </div>
      )}

      {resetting && (
        <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} onDone={load} />
      )}
    </div>
  );
}
