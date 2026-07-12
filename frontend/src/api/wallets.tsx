import { apiClient } from "./client";
import type { Wallet } from "../types";

export async function listWallets(): Promise<Wallet[]> {
  const { data } = await apiClient.get<Wallet[]>("/wallets");
  return data;
}

export async function createWallet(payload: { name: string; description?: string; is_default?: boolean }) {
  const { data } = await apiClient.post<Wallet>("/wallets", payload);
  return data;
}

export async function updateWallet(
  id: string,
  payload: Partial<{ name: string; description: string; is_default: boolean }>
) {
  const { data } = await apiClient.patch<Wallet>(`/wallets/${id}`, payload);
  return data;
}

export async function deleteWallet(id: string) {
  await apiClient.delete(`/wallets/${id}`);
}
