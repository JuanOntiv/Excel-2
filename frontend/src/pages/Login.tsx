
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Logo, Wordmark } from "../components/brand/Logo";

export default function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  // El interceptor de axios redirige aquí con ?session=expired cuando el
  // refresh token deja de ser válido (ver api/client.tsx); Settings redirige
  // con ?session=password_changed tras un cambio de contraseña.
  const [searchParams] = useSearchParams();
  const sessionParam = searchParams.get("session");
  // Ojo con el texto: la sesión NO caduca por inactividad. Dura mientras el
  // refresh token siga vivo (30 días) o hasta que algo lo revoque —cambio de
  // contraseña, cierre en todos los dispositivos, baja de la cuenta—, así que
  // culpar a la inactividad sería mentir sobre lo que pasó.
  const sessionNotice =
    sessionParam === "expired"
      ? "Tu sesión ya no es válida. Vuelve a iniciar sesión."
      : sessionParam === "password_changed"
        ? "Contraseña actualizada. Inicia sesión con tu nueva contraseña."
        : null;

  const [mail, setMail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(mail, password);
      navigate("/dashboard");
    } catch (err: any) {
      if (err?.response?.status === 429) {
        const retryAfter = Number(err.response.headers?.["retry-after"]);
        const minutes = retryAfter ? Math.ceil(retryAfter / 60) : null;
        // El bloqueo es por cuenta y su duración crece con cada reincidencia,
        // así que el tiempo se toma siempre de Retry-After, no se asume fijo.
        setError(
          minutes
            ? `Demasiados intentos fallidos para esta cuenta. Intenta de nuevo en ~${minutes} min.`
            : "Demasiados intentos fallidos para esta cuenta. Intenta de nuevo más tarde."
        );
      } else {
        setError("Correo o contraseña incorrectos.");
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
          <Logo size={44} />
          <Wordmark />
        </Link>

        <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-6 sm:p-8">
          <h1 className="text-2xl font-semibold mb-6 text-center">Iniciar sesión</h1>

          {sessionNotice && !error && (
            <div className="mb-4 rounded-lg border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark px-3 py-2 text-sm text-ink-muted-light dark:text-ink-muted-dark">
              {sessionNotice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                className="w-full px-3 py-2 rounded-lg border border-line-light dark:border-line-dark bg-surface-light dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {error && <p className="text-sm text-negative">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mt-6 text-center">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="font-medium text-accent underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
