import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat,
  Wallet,
  Target,
  Tag,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Resumen" },
  { to: "/income", icon: ArrowUpCircle, label: "Ingresos" },
  { to: "/expenses", icon: ArrowDownCircle, label: "Egresos" },
  { to: "/recurring", icon: Repeat, label: "Recurr." },
  { to: "/categories", icon: Tag, label: "Categorías" },
  { to: "/wallets", icon: Wallet, label: "Carteras" },
  { to: "/goals", icon: Target, label: "Metas" },
];


export function BottomNav() {
  const { user } = useAuth();
  const items = user?.is_admin
    ? [...navItems, { to: "/admin", icon: ShieldCheck, label: "Admin" }]
    : navItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-elevated-light dark:bg-surface-elevated-dark border-t border-line-light dark:border-line-dark flex items-center justify-around z-50 overflow-x-auto">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-xs ${
              isActive
                ? "text-accent"
                : "text-ink-muted-light dark:text-ink-muted-dark"
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
