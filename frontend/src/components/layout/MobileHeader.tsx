import { Link } from "react-router-dom";
import { Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

export function MobileHeader() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="text-sm font-medium">{user?.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={toggleTheme} className="text-gray-500 dark:text-gray-400">
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Link to="/settings" className="text-gray-500 dark:text-gray-400">
          <Settings size={18} />
        </Link>
      </div>
    </header>
  );
}

// import { Link } from "react-router-dom";
// import { Settings, Moon, Sun } from "lucide-react";
// import { useTheme } from "../../context/ThemeContext";
// import { useAuth } from "../../context/AuthContext";

// export function MobileHeader() {
//   const { theme, toggleTheme } = useTheme();
//   const { user } = useAuth();
//   const navigate = useNavigate();

//     async function handleLogout() {
//       await logout();
//       navigate("/login");
//     }

//   return (
//     <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-40">
//       <div className="flex items-center gap-2">
//         <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold">
//           {user?.name?.[0]?.toUpperCase() ?? "?"}
//         </div>
//         <span className="text-sm font-medium">{user?.name}</span>
//       </div>
//       <div className="flex items-center gap-3">
//         <button onClick={toggleTheme} className="text-gray-500 dark:text-gray-400">
//           {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
//         </button>
//         <Link to="/settings" className="text-gray-500 dark:text-gray-400">
//           <Settings size={18} />
//         </Link>
//       </div>
//     </header>
//   );
// }
