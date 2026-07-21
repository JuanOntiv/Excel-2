import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PiggyBank, Check, X, Moon, Sun } from "lucide-react";
import { registerRequest } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { validatePasswordStrength, getPasswordChecks } from "../utils/password";

const APP_NAME = "Finanzas";

export default function Register() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [mail, setMail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordChecks = getPasswordChecks(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const weakness = validatePasswordStrength(password);
    if (weakness) {
      setError(weakness);
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);

    try {
      await registerRequest(name, mail, password);
      // Registrado con éxito -> lo logeamos directo para no pedirle el formulario dos veces
      await login(mail, password);
      navigate("/dashboard");
    } catch (err: any) {
      if (err?.response?.status === 400) {
        setError("Ese correo ya está registrado.");
      } else {
        setError("No se pudo crear la cuenta. Intenta de nuevo.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-light dark:bg-surface-dark text-ink-light dark:text-ink-dark px-4">
      <button
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        className={`fixed top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center transition ${
          theme === "dark"
            ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
            : "bg-violet-500/15 text-violet-500 hover:bg-violet-500/25"
        }`}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-sm">
        <Link to="/" className="flex flex-col items-center gap-2.5 mb-6">
          <div className="w-11 h-11 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
            <PiggyBank size={22} />
          </div>
          <span className="font-bold text-lg">{APP_NAME}</span>
        </Link>

        <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-6 sm:p-8">
          <h1 className="text-2xl font-semibold mb-6 text-center">Crear cuenta</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Nombre
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="mail" className="block text-sm font-medium mb-1">
                Correo
              </label>
              <input
                id="mail"
                type="email"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <ul className="mt-2 flex flex-col gap-1">
                {passwordChecks.map((check) => (
                  <li
                    key={check.label}
                    className={`flex items-center gap-1.5 text-xs ${
                      check.met ? "text-positive" : "text-ink-muted-light dark:text-ink-muted-dark"
                    }`}
                  >
                    {check.met ? <Check size={13} className="shrink-0" /> : <X size={13} className="shrink-0" />}
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <p className="mt-1 text-xs text-negative">Las contraseñas no coinciden.</p>
              )}
            </div>

            {error && <p className="text-sm text-negative">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>
        </div>

        <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mt-6 text-center">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-accent underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
