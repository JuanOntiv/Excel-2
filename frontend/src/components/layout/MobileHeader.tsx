import { Link } from "react-router-dom";
import { Settings, Moon, Sun, History } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { NotificationBell } from "../notifications/NotificationBell";

export function MobileHeader() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-accent-soft dark:bg-accent-dark/25 text-accent flex items-center justify-center text-xs font-semibold">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="text-sm font-medium text-ink-light dark:text-ink-dark">{user?.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell align="right" />
        <button
          onClick={toggleTheme}
          className={`w-7 h-7 rounded-md flex items-center justify-center ${
            theme === "dark" ? "bg-amber-500/15 text-amber-500" : "bg-violet-500/15 text-violet-500"
          }`}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <Link to="/history" className="text-ink-muted-light dark:text-ink-muted-dark">
          <History size={18} />
        </Link>
        <Link to="/settings" className="text-ink-muted-light dark:text-ink-muted-dark">
          <Settings size={18} />
        </Link>
      </div>
    </header>
  );
}
