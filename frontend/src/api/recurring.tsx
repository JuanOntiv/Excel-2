import { apiClient } from "./client";
import type { RecurringTransaction, TransactionType, RecurringFrequency } from "../types";

export async function listRecurring(): Promise<RecurringTransaction[]> {
  const { data } = await apiClient.get<RecurringTransaction[]>("/recurring-transactions");
  return data;
}

export async function createRecurring(payload: {
  name: string;
  description?: string;
  amount: number;
  type: TransactionType;
  frequency: RecurringFrequency;
  start_date: string;
  auto_execute: boolean;
  category_id: string;
}) {
  const { data } = await apiClient.post<RecurringTransaction>("/recurring-transactions", payload);
  return data;
}

export async function updateRecurring(id: string, payload: Partial<{
  name: string;
  description: string;
  amount: number;
  frequency: RecurringFrequency;
  category_id: string;
  auto_execute: boolean;
}>) {
  const { data } = await apiClient.patch<RecurringTransaction>(`/recurring-transactions/${id}`, payload);
  return data;
}

export async function cancelRecurring(id: string) {
  await apiClient.delete(`/recurring-transactions/${id}`);
}

export async function pauseRecurring(id: string) {
  const { data } = await apiClient.post<RecurringTransaction>(`/recurring-transactions/${id}/pause`);
  return data;
}

export async function resumeRecurring(id: string) {
  const { data } = await apiClient.post<RecurringTransaction>(`/recurring-transactions/${id}/resume`);
  return data;
}

export async function executeRecurringNow(id: string) {
  const { data } = await apiClient.post<RecurringTransaction>(`/recurring-transactions/${id}/execute`);
  return data;
}

export async function listPendingConfirmation(): Promise<RecurringTransaction[]> {
  const { data } = await apiClient.get<RecurringTransaction[]>("/recurring-transactions/pending-confirmation/list");
  return data;
}

export async function executePending() {
  const { data } = await apiClient.post("/recurring-transactions/execute-pending");
  return data;
}
