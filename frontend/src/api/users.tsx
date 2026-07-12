import { apiClient } from "./client";
import type { User } from "../types";

export async function updateProfile(payload: Partial<{ name: string; mail: string; password: string }>) {
  const { data } = await apiClient.patch<User>("/users/me", payload);
  return data;
}

export async function deactivateAccount() {
  await apiClient.delete("/users/me");
}
