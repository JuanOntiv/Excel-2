import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";
import { NotificationProvider } from "../../context/NotificationContext";
import { useTransactionsStore } from "../../store/transactionsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { useWalletsStore } from "../../store/walletsStore";
import { useGoalsStore } from "../../store/goalsStore";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Se dispara en cada montaje (cada navegación entre rutas protegidas
  // remonta AppShell), pero bootstrap() es idempotente: si ya hay datos o una
  // carga en curso, no repite el fetch. Así toda la app comparte una sola
  // carga inicial de transacciones/categorías/carteras en memoria.
  useEffect(() => {
    useTransactionsStore.getState().bootstrap();
    useCategoriesStore.getState().bootstrap();
    useWalletsStore.getState().bootstrap();
    useGoalsStore.getState().bootstrap();
  }, []);

  return (
    <NotificationProvider>
      <div className="flex min-h-screen bg-surface-light dark:bg-surface-dark text-ink-light dark:text-ink-dark">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader />
          {/* min-w-0 evita que una tabla/gráfica ancha estire toda la página en
              móvil; el padding inferior deja hueco para BottomNav + la barra de
              gestos de iOS (safe-area). */}
          <main className="flex-1 min-w-0 p-4 md:p-8 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
            {children}
          </main>
        </div>

        <BottomNav />
      </div>
    </NotificationProvider>
  );
}
