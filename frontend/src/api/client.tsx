import axios from "axios";
import type { TokenResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const apiClient = axios.create({ baseURL: API_BASE_URL });

// Shared in-flight refresh: concurrent 401s await ONE /auth/refresh instead of
// stampeding the rotating refresh token and self-invalidating the session.
// Esto solo cubre UNA pestaña; entre pestañas lo cubre withRefreshLock().
let refreshPromise: Promise<string> | null = null;

// Definitive-death guard. Once refresh fails for real, every later interceptor
// invocation short-circuits here — THIS is what stops the loop, not the redirect.
let sessionExpired = false;

// Endpoints that must never trigger a refresh on 401.
const AUTH_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

// Nombre del candado compartido entre pestañas (Web Locks API).
const REFRESH_LOCK = "finanzas:auth-refresh";

// Let a fresh login (while still on /login, no reload) refresh again later.
export function resetSessionExpired() {
  sessionExpired = false;
  refreshPromise = null;
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

function handleSessionExpired() {
  if (sessionExpired) return; // tear down once
  sessionExpired = true;
  clearTokens();
  if (window.location.pathname !== "/login") {
    // El query param permite que /login muestre un aviso de "sesión expirada"
    // en vez de dejar al usuario sin explicación (ver pages/Login.tsx).
    // Ojo: es una navegación dura, así que depende de que el hosting sirva
    // index.html para rutas que no son archivos (ver frontend/vercel.json).
    window.location.replace("/login?session=expired"); // UX only; guard flag already stops retries
  }
}

/** No hay refresh token guardado: no hay nada que renovar, la sesión murió. */
class NoRefreshTokenError extends Error {
  constructor() {
    super("no_refresh_token");
    this.name = "NoRefreshTokenError";
  }
}

/**
 * Un refresh fallido solo cierra la sesión si el servidor DIJO que el token ya
 * no sirve. Un timeout, un corte de red o un 5xx no prueban nada — y en Render
 * (plan gratuito) el servicio se duerme, así que el primer request tras un rato
 * de inactividad tarda o falla de forma rutinaria. Antes cualquiera de esos
 * casos borraba los tokens y expulsaba al usuario con una sesión válida.
 */
function isDefinitiveAuthFailure(error: unknown): boolean {
  if (error instanceof NoRefreshTokenError) return true;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status === 401 || status === 403;
  }
  return false;
}

/**
 * Mutex REAL entre pestañas. El backend rota el refresh token en cada uso, así
 * que si dos pestañas renuevan a la vez mandan el mismo valor: una gana y a la
 * otra le contestan 401 con un token que acaba de ser revocado — sesión muerta
 * sin motivo. El candado serializa esas renovaciones.
 * Si el navegador no soporta la API, se degrada al comportamiento anterior.
 */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks: LockManager | undefined = navigator.locks;
  if (!locks) return fn();
  return locks.request(REFRESH_LOCK, fn) as Promise<T>;
}

/** Raw axios: bypasses this interceptor (no recursion). */
async function requestNewTokens(refreshToken: string): Promise<string> {
  const { data } = await axios.post<TokenResponse>(
    `${API_BASE_URL}/auth/refresh`,
    { refresh_token: refreshToken }
  );
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  return data.access_token;
}

async function refreshTokens(): Promise<string> {
  // Se lee ANTES de pedir el candado, para poder comparar después: si el valor
  // cambió mientras esperábamos, es que otra pestaña ya renovó por nosotros.
  const tokenBeforeLock = localStorage.getItem("refresh_token");

  return withRefreshLock(async () => {
    const current = localStorage.getItem("refresh_token");
    if (!current) throw new NoRefreshTokenError();

    if (current !== tokenBeforeLock) {
      const alreadyRenewed = localStorage.getItem("access_token");
      // Reutilizamos lo que dejó la otra pestaña en vez de gastar (y rotar) el
      // token otra vez.
      if (alreadyRenewed) return alreadyRenewed;
    }

    return requestNewTokens(current);
  });
}

// Single-flight dentro de la pestaña.
function performRefresh(): Promise<string> {
  if (!refreshPromise) {
    const pending = refreshTokens();
    refreshPromise = pending;
    // .finally() devuelve una promesa DERIVADA que también rechaza; sin el
    // .catch() queda sin manejar y el navegador escupe "Uncaught (in promise)"
    // cada vez que un refresh falla. El rechazo real lo maneja quien await-ea
    // `refreshPromise` en el interceptor.
    pending.finally(() => {
      refreshPromise = null;
    }).catch(() => {});
  }
  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status !== 401 || !originalRequest) return Promise.reject(error);
    if (sessionExpired) return Promise.reject(error); // loop stops here

    const url = originalRequest.url ?? "";
    if (AUTH_PATHS.some((p) => url.includes(p))) return Promise.reject(error);

    if (originalRequest._retry) {
      // Segundo 401 con un access token recién emitido: el token es válido y
      // aun así el backend rechaza, o sea que el problema es la cuenta (p.ej.
      // desactivada). Antes esto se rechazaba en silencio y la app quedaba
      // congelada fallando todo, sin mandar nunca al login.
      // Seguro porque las rutas de admin responden 403, no 401.
      handleSessionExpired();
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    try {
      const newAccessToken = await performRefresh();
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      // Solo un "no" explícito del servidor cierra la sesión; lo transitorio se
      // propaga como error normal y el siguiente 401 lo volverá a intentar.
      if (isDefinitiveAuthFailure(refreshError)) handleSessionExpired();
      return Promise.reject(refreshError);
    }
  }
);
