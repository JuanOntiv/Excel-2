import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat,
  Wallet,
  Settings,
  Moon,
  Sun,
  Globe,
  ChevronLeft,
  ChevronRight,
  Tag,
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
  { to: "/wallets", icon: Wallet, label: "Carteras" },
  { to: "/settings", icon: Settings, label: "Configuración" },
  { to: "/categories", icon: Tag, label: "Categorías" },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <aside
      className={`hidden md:flex flex-col h-screen sticky top-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Botón de colapso */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 border-b border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* Navegación principal */}
      <nav className="flex-1 py-4 flex flex-col gap-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Controles: tema e idioma */}
      <div className="flex flex-col gap-1 px-2 pb-2">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>}
        </button>
        <button className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
          <Globe size={18} />
          {!collapsed && <span>Idioma</span>}
        </button>
      </div>

      {/* Perfil, anclado abajo */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold shrink-0">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.mail}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
