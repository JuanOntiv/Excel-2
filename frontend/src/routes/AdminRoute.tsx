import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

// Guarda de rutas solo-admin. Encima de la autenticacion (ProtectedRoute),
// exige is_admin; un usuario normal que intente entrar a /admin es redirigido
// al dashboard. El backend valida el rol de nuevo en cada endpoint, esto es
// solo la capa de UX.
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
