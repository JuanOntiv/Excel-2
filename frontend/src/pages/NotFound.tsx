import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

// Página 404 para rutas no encontradas. Se renderiza dentro del AppShell
// (con la navegación), así el usuario autenticado no queda "perdido".
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <Compass size={48} className="text-accent mb-4" />
      <h1 className="text-3xl font-semibold text-ink-light dark:text-ink-dark mb-2">404</h1>
      <p className="text-ink-muted-light dark:text-ink-muted-dark mb-6">
        La página que buscas no existe o fue movida.
      </p>
      <Link
        to="/dashboard"
        className="px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
