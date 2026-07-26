import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat,
  Wallet,
  Target,
  Settings,
  ShieldCheck,
  Moon,
  Sun,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Tag,
  PiggyBank,
  History,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Resumen" },
  { to: "/income", icon: ArrowUpCircle, label: "Ingresos" },
  { to: "/expenses", icon: ArrowDownCircle, label: "Egresos" },
  { to: "/recurring", icon: Repeat, label: "Recurrentes" },
  { to: "/categories", icon: Tag, label: "Categorías" },
  { to: "/wallets", icon: Wallet, label: "Carteras" },
  { to: "/goals", icon: Target, label: "Metas" },
];

// Nombre de la app mostrado junto al logo. Cámbialo por el tuyo.
const APP_NAME = "Finanzas";

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // El enlace de administración solo aparece para admins. El backend valida el rol igual.
  const items = [...navItems];
  if (user?.is_admin) {
    items.push({ to: "/admin", icon: ShieldCheck, label: "Administración" });
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <aside
      className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Marca: logo + nombre.
          Para usar tu logo real, reemplaza el <div> del placeholder por:
            <img src="/logo.svg" alt={APP_NAME} className="w-9 h-9 rounded-lg shrink-0" />
          (coloca el archivo en frontend/public/logo.svg). */}
      <div
        className={`flex items-center h-16 border-b border-line-light dark:border-line-dark ${
          collapsed ? "justify-center px-2" : "px-4 gap-2.5"
        }`}
      >
        <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
          <PiggyBank size={20} />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg text-ink-light dark:text-ink-dark truncate">{APP_NAME}</span>
        )}
      </div>

      {/* Botón de colapso */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-9 border-b border-line-light dark:border-line-dark text-ink-muted-light dark:text-ink-muted-dark hover:text-ink-light dark:hover:text-ink-dark"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* Navegación principal */}
      <nav className="flex-1 py-4 flex flex-col gap-1.5">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 py-2.5 mx-2 rounded-lg text-[15px] font-medium transition-colors ${
                collapsed ? "justify-center px-0" : "px-4"
              } ${
                isActive
                  ? "bg-accent text-white"
                  : "text-ink-muted-light dark:text-ink-muted-dark hover:bg-surface-light dark:hover:bg-surface-dark hover:text-ink-light dark:hover:text-ink-dark"
              }`
            }
          >
            <Icon size={19} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Controles: tema */}
      <div className="flex flex-col gap-1.5 px-2 pb-2">
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-3 px-2 py-2.5 rounded-lg text-[15px] font-medium text-ink-muted-light dark:text-ink-muted-dark hover:bg-surface-light dark:hover:bg-surface-dark ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span
            className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
              theme === "dark" ? "bg-amber-500/15 text-amber-500" : "bg-violet-500/15 text-violet-500"
            }`}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </span>
          {!collapsed && <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>}
        </button>
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-2 py-2.5 rounded-lg text-[15px] font-medium text-negative hover:bg-negative/10 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut size={19} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>

      {/* Perfil, anclado abajo. La config vive aquí, a la derecha del usuario. */}
      <div className="border-t border-line-light dark:border-line-dark p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-accent-soft dark:bg-accent-dark/25 text-accent flex items-center justify-center text-sm font-semibold shrink-0">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold truncate text-ink-light dark:text-ink-dark">{user?.name}</p>
              <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark truncate">{user?.mail}</p>
            </div>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `p-2 rounded-lg shrink-0 ${
                  isActive
                    ? "bg-accent text-white"
                    : "text-ink-muted-light dark:text-ink-muted-dark hover:bg-surface-light dark:hover:bg-surface-dark hover:text-ink-light dark:hover:text-ink-dark"
                }`
              }
              title="Historial"
            >
              <History size={18} />
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `p-2 rounded-lg shrink-0 ${
                  isActive
                    ? "bg-accent text-white"
                    : "text-ink-muted-light dark:text-ink-muted-dark hover:bg-surface-light dark:hover:bg-surface-dark hover:text-ink-light dark:hover:text-ink-dark"
                }`
              }
              title="Configuración"
            >
              <Settings size={18} />
            </NavLink>
          </>
        )}
      </div>
    </aside>
  );
}
