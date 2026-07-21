import { apiClient } from "./client";
import type { User } from "../types";

// Endpoints exclusivos de admin (requieren is_admin=True en el backend, ver
// app/auth/dependencies_admin.py). El rol de admin NO se otorga por API: solo
// via el script seed_admin.

export async function listUsers(includeInactive = false): Promise<User[]> {
  const { data } = await apiClient.get<User[]>("/users/", {
    params: { include_inactive: includeInactive },
  });
  return data;
}

export async function deactivateUser(userId: string) {
  const { data } = await apiClient.delete<{ message: string }>(`/users/${userId}/deactivate`);
  return data;
}

export async function reactivateUser(userId: string) {
  const { data } = await apiClient.post<{ message: string }>(`/users/${userId}/reactivate`);
  return data;
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const { data } = await apiClient.post<{ message: string }>(
    `/users/${userId}/reset-password`,
    { new_password: newPassword },
  );
  return data;
}
