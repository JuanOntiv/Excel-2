import { NavLink } from "react-router-dom";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat,
  Wallet,
  Target,
  Tag,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Logo } from "../brand/Logo";

const navItems = [
  { to: "/dashboard", icon: Logo, label: "Resumen" },
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
    // Cada item lleva `flex-[1_0_4.25rem]`: crece para repartirse el ancho cuando
    // sobra espacio (como el justify-around de antes), pero NO se encoge cuando
    // no cabe — con 7-8 secciones en una pantalla de 375px encogerlos partía las
    // etiquetas. Al no encogerse, el contenedor desborda y se desliza en
    // horizontal, que es preferible a texto cortado.
    <nav className="md:hidden fixed bottom-0 left-0 right-0 min-h-16 pb-[env(safe-area-inset-bottom)] bg-surface-elevated-light dark:bg-surface-elevated-dark border-t border-line-light dark:border-line-dark flex items-stretch z-50 overflow-x-auto">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-[1_0_4.25rem] flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium leading-none whitespace-nowrap ${
              isActive
                ? "text-accent"
                : "text-ink-muted-light dark:text-ink-muted-dark"
            }`
          }
        >
          <Icon size={20} className="shrink-0" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
