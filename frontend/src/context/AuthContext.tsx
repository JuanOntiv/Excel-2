import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { apiClient, resetSessionExpired } from "../api/client";
import { executePending } from "../api/recurring";
import { loginRequest, logoutRequest } from "../api/auth";
import { useTransactionsStore } from "../store/transactionsStore";
import { useCategoriesStore } from "../store/categoriesStore";
import { useWalletsStore } from "../store/walletsStore";
import { useGoalsStore } from "../store/goalsStore";
import { useRecurringStore } from "../store/recurringStore";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (mail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * execute-pending puede crear transacciones reales (y avanzar next_execution)
 * justo mientras AppShell está arrancando sus bootstrap(). Sin esto, lo que se
 * acaba de registrar solo aparecía tras recargar la página.
 *
 * Se espera al bootstrap en curso ANTES de refrescar: transactionsStore carga
 * por lotes y dos cargas simultáneas pueden intercalar sus `set`, duplicando
 * filas. bootstrap() es idempotente y resuelve cuando la carga en vuelo acaba.
 */
async function syncStoresAfterPendingExecution() {
  const transactions = useTransactionsStore.getState();
  await transactions.bootstrap();
  await transactions.refresh();

  const recurring = useRecurringStore.getState();
  await recurring.bootstrap();
  await recurring.refresh();

  const goals = useGoalsStore.getState();
  await goals.bootstrap();
  await goals.revalidate();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  async function fetchCurrentUser() {
    try {
      const { data } = await apiClient.get<User>("/users/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(mail: string, password: string) {
    const tokens = await loginRequest(mail, password);
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
    // Reactiva el interceptor si una sesion previa habia expirado sin recargar.
    resetSessionExpired();
    await fetchCurrentUser();

    // Sin await: no debe retrasar la entrada a la app. Si generó algo, los
    // stores se ponen al día en segundo plano.
    executePending()
      .then((result) => {
        if (!result?.executed) return;
        return syncStoresAfterPendingExecution();
      })
      .catch(() => {});
  }

  async function logout() {
    const refreshToken = localStorage.getItem("refresh_token");
    try {
      if (refreshToken) await logoutRequest(refreshToken);
    } catch {
      // si falla la llamada al backend, igual limpiamos la sesión local
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
      // Sin esto, la próxima sesión (otro usuario, mismo navegador) vería en
      // memoria las transacciones/categorías/carteras del usuario anterior.
      useTransactionsStore.getState().reset();
      useCategoriesStore.getState().reset();
      useWalletsStore.getState().reset();
      useGoalsStore.getState().reset();
      useRecurringStore.getState().reset();
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout,  refreshUser: fetchCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
