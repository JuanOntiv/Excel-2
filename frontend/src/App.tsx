// import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { Toaster } from "./components/ui/Toaster";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { PublicOnlyRoute } from "./routes/PublicOnlyRoute";
import { AdminRoute } from "./routes/AdminRoute";
import { AppShell } from "./components/layout/AppShell";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Income from "./pages/Income";
import Expenses from "./pages/Expenses";
import Recurring from "./pages/Recurring";
import Categories from "./pages/Categories";
import Wallets from "./pages/Wallets";
import WalletDetail from "./pages/WalletDetail";
import Goals from "./pages/Goals";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
// ...

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <PublicOnlyRoute>
                  <Landing />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <Register />
                </PublicOnlyRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Dashboard />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/income"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Income />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Expenses />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/recurring"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Recurring />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Categories />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallets"
              element={
              	<ProtectedRoute>
				  <AppShell>
					<Wallets/>
				  </AppShell>
				</ProtectedRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Goals />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallets/:walletId"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <WalletDetail />
                  </AppShell>
                </ProtectedRoute>
              }
            />
			<Route
			  path="/settings"
				element={
				  <ProtectedRoute>
					<AppShell>
					  <Settings />
					</AppShell>
				  </ProtectedRoute>
				}
		  	/>
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AppShell>
                    <Admin />
                  </AppShell>
                </AdminRoute>
              }
            />

            {/* Catch-all: cualquier ruta no definida muestra el 404 dentro del
                shell autenticado (usuarios sin sesión son enviados a /login). */}
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <NotFound />
                  </AppShell>
                </ProtectedRoute>
              }
            />
          </Routes>
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
