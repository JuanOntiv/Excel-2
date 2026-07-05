import { apiClient } from "./client";
import type { TokenResponse } from "../types";

export async function loginRequest(mail: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.append("username", mail); // el backend espera "username" aunque sea el mail
  body.append("password", password);

  const { data } = await apiClient.post<TokenResponse>("/auth/login", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data;
}

export async function refreshRequest(refresh_token: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/refresh", { refresh_token });
  return data;
}

export async function logoutRequest(refresh_token: string): Promise<void> {
  await apiClient.post("/auth/logout", { refresh_token });
}

export async function registerRequest(name: string, mail: string, password: string) {
  const { data } = await apiClient.post("/users/register", { name, mail, password });
  return data;
}
