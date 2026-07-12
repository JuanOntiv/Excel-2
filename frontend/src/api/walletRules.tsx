import { apiClient } from "./client";
import type { WalletRule, WalletRuleType, TransactionType } from "../types";

export async function listWalletRules(walletId?: string): Promise<WalletRule[]> {
  const { data } = await apiClient.get<WalletRule[]>("/wallet-rules", {
    params: walletId ? { wallet_id: walletId } : {},
  });
  return data;
}

export interface WalletRulePayload {
  wallet_id: string;
  rule_type: WalletRuleType;
  category_id?: string;
  transaction_type?: TransactionType;
  keyword?: string;
  date_from?: string;
  date_to?: string;
  amount_from?: number;
  amount_to?: number;
}

export async function createWalletRule(payload: WalletRulePayload) {
  const { data } = await apiClient.post<WalletRule>("/wallet-rules", payload);
  return data;
}

export async function updateWalletRule(id: string, payload: Partial<WalletRulePayload>) {
  const { data } = await apiClient.patch<WalletRule>(`/wallet-rules/${id}`, payload);
  return data;
}

export async function deleteWalletRule(id: string) {
  await apiClient.delete(`/wallet-rules/${id}`);
}
