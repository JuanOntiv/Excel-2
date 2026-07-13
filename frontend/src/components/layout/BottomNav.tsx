import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat,
  Wallet,
  Tag,
} from "lucide-react";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Resumen" },
  { to: "/income", icon: ArrowUpCircle, label: "Ingresos" },
  { to: "/expenses", icon: ArrowDownCircle, label: "Egresos" },
  { to: "/recurring", icon: Repeat, label: "Recurr." },
  { to: "/categories", icon: Tag, label: "Categorías" },
  { to: "/wallets", icon: Wallet, label: "Carteras" },
];


export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-around z-50">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-xs ${
              isActive
                ? "text-gray-900 dark:text-white"
                : "text-gray-400 dark:text-gray-500"
            }`
          }
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
