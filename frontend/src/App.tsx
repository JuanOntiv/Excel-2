// import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
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
import Settings from "./pages/Settings";
// ...

function Placeholder({ title }: { title: string }) {
  return <h1 className="text-2xl font-semibold">{title}</h1>;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

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
			  path="/settings"
				element={
				  <ProtectedRoute>
					<AppShell>
					  <Settings />
					</AppShell>
				  </ProtectedRoute>
				}
		  	/>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
