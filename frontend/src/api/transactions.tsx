import { apiClient } from "./client";
import type { Transaction, TransactionType } from "../types";

interface ListTransactionsParams {
  type?: TransactionType;
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

export interface TransactionsSummary {
  wallet_id: string | null;
  wallet_name: string | null;
  total_income: number;
  total_expenses: number;
  balance: number;
  count: number;
}

interface TransactionsSummaryParams {
  start_date?: string;
  end_date?: string;
}

export async function getTransactionsSummary(
  params: TransactionsSummaryParams = {}
): Promise<TransactionsSummary> {
  const { data } = await apiClient.get<TransactionsSummary>("/transactions/summary", { params });
  return data;
}

interface ExportTransactionsParams {
  format: "csv" | "xlsx";
  type?: TransactionType;
  start_date?: string;
  end_date?: string;
  category_id?: string;
  wallet_id?: string;
}

// Descarga el export generado por el backend (mismo filtrado que /transactions)
// y dispara la descarga en el navegador usando el filename del Content-Disposition.
export async function exportTransactions(params: ExportTransactionsParams): Promise<void> {
  const response = await apiClient.get("/transactions/export", {
    params,
    responseType: "blob",
  });

  const disposition: string = response.headers["content-disposition"] ?? "";
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : `transacciones.${params.format}`;

  const url = window.URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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
