import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-6">
      <h1 className="text-4xl font-bold mb-4">Tu dinero, en orden.</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md text-center">
        Controla ingresos, egresos, carteras y transacciones recurrentes en un solo lugar.
      </p>
      <div className="flex gap-4">
        <Link
          to="/login"
          className="px-6 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:opacity-90 transition"
        >
          Iniciar sesión
        </Link>
        <Link
          to="/register"
          className="px-6 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}
