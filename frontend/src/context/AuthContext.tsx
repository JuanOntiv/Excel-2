import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { apiClient, resetSessionExpired } from "../api/client";
import { executePending } from "../api/recurring";
import { loginRequest, logoutRequest } from "../api/auth";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (mail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

    executePending().catch(() => {});
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
