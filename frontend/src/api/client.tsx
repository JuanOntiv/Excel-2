import axios from "axios";
import type { TokenResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const apiClient = axios.create({ baseURL: API_BASE_URL });

// Shared in-flight refresh: concurrent 401s await ONE /auth/refresh instead of
// stampeding the rotating refresh token and self-invalidating the session.
let refreshPromise: Promise<string> | null = null;

// Definitive-death guard. Once refresh fails for real, every later interceptor
// invocation short-circuits here — THIS is what stops the loop, not the redirect.
let sessionExpired = false;

// Endpoints that must never trigger a refresh on 401.
const AUTH_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

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
    window.location.replace("/login"); // UX only; guard flag already stops retries
  }
}

// Single-flight refresh. Raw axios bypasses this interceptor (no recursion).
function performRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) throw new Error("no_refresh_token");
      const { data } = await axios.post<TokenResponse>(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken }
      );
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return data.access_token;
    })();
    refreshPromise.finally(() => {
      refreshPromise = null;
    });
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

    if (originalRequest._retry) return Promise.reject(error);
    originalRequest._retry = true;

    try {
      const newAccessToken = await performRefresh();
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      handleSessionExpired();
      return Promise.reject(refreshError);
    }
  }
);
