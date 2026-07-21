import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";
import { NotificationProvider } from "../../context/NotificationContext";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <NotificationProvider>
      <div className="flex min-h-screen bg-surface-light dark:bg-surface-dark text-ink-light dark:text-ink-dark">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader />
          <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">{children}</main>
        </div>

        <BottomNav />
      </div>
    </NotificationProvider>
  );
}
