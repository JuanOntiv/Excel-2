import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>Cargando...</div>; // luego lo cambiamos por un spinner real
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
