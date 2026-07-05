import { apiClient } from "./client";
import type { Transaction, TransactionType } from "../types";

interface ListTransactionsParams {
  start_date?: string; // YYYY-MM-DD
  end_date?: string;
  category_id?: string;
  wallet_id?: string;
  skip?: number;
  limit?: number;
}

export async function listTransactions(params: ListTransactionsParams = {}): Promise<Transaction[]> {
  const { data } = await apiClient.get<Transaction[]>("/transactions", { params });
  return data;
}

export async function createTransaction(payload: {
  name: string;
  description?: string;
  amount: number;
  date: string;
  type: TransactionType;
  category_id: string;
  wallet_id?: string;
}) {
  const { data } = await apiClient.post<Transaction>("/transactions", payload);
  return data;
}


export async function deleteTransaction(id: string) {
  await apiClient.delete(`/transactions/${id}`);
}


export async function updateTransaction(
  id: string,
  payload: Partial<{
    name: string;
    description: string;
    amount: number;
    date: string;
    category_id: string;
    wallet_id: string;
  }>
) {
  const { data } = await apiClient.patch<Transaction>(`/transactions/${id}`, payload);
  return data;
}
