import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

// Guarda inversa de ProtectedRoute: envuelve rutas publicas (landing, login,
// register) que un usuario YA autenticado no deberia ver. Si hay sesion, lo
// mandamos al dashboard en vez de mostrarle el formulario de login/registro.
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>Cargando...</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
