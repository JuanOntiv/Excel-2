import { Link } from "react-router-dom";
import { PiggyBank, ArrowUpCircle, ArrowDownCircle, Repeat, Wallet, Target, Tag, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const APP_NAME = "Finanzas";

const features = [
  {
    icon: ArrowUpCircle,
    title: "Ingresos y egresos",
    description: "Registra tus movimientos y visualiza tendencias por día, mes o el periodo que necesites.",
  },
  {
    icon: Repeat,
    title: "Recurrentes",
    description: "Automatiza pagos y cobros repetidos, con confirmación manual si así lo prefieres.",
  },
  {
    icon: Wallet,
    title: "Carteras",
    description: "Separa tu dinero en cuentas y reglas automáticas que clasifican tus transacciones.",
  },
  {
    icon: Target,
    title: "Metas",
    description: "Define objetivos de ahorro y da seguimiento a tu progreso en tiempo real.",
  },
  {
    icon: Tag,
    title: "Categorías",
    description: "Organiza cada movimiento con categorías propias o predefinidas, a tu gusto.",
  },
  {
    icon: ArrowDownCircle,
    title: "Panorama claro",
    description: "Un resumen único de tu balance, sin hojas de cálculo ni apps a medias.",
  },
];

export default function Landing() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-surface-light dark:bg-surface-dark text-ink-light dark:text-ink-dark">
      {/* Encabezado con marca y accesos */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <PiggyBank size={20} />
          </div>
          <span className="font-bold text-lg">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
              theme === "dark"
                ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                : "bg-violet-500/15 text-violet-500 hover:bg-violet-500/25"
            }`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link
            to="/login"
            className="px-4 py-2 rounded-lg text-sm font-medium text-ink-muted-light dark:text-ink-muted-dark hover:text-ink-light dark:hover:text-ink-dark transition"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition"
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 max-w-2xl">Tu dinero, en orden.</h1>
        <p className="text-lg text-ink-muted-light dark:text-ink-muted-dark mb-8 max-w-md">
          Controla ingresos, egresos, carteras y transacciones recurrentes en un solo lugar.
        </p>
        <div className="flex gap-4">
          <Link
            to="/register"
            className="px-6 py-2.5 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition"
          >
            Crear cuenta gratis
          </Link>
          <Link
            to="/login"
            className="px-6 py-2.5 rounded-lg border border-line-light dark:border-line-dark font-medium hover:bg-surface-elevated-light dark:hover:bg-surface-elevated-dark transition"
          >
            Iniciar sesión
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="px-6 pb-20 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5"
            >
              <div className="w-11 h-11 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-4">
                <Icon size={20} />
              </div>
              <h3 className="font-semibold mb-1.5">{title}</h3>
              <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-sm text-ink-muted-light dark:text-ink-muted-dark border-t border-line-light dark:border-line-dark">
        {APP_NAME} — gestiona tus finanzas personales.
      </footer>
    </div>
  );
}
