export type TransactionType = "income" | "expense";
export type CategoryType = "income" | "expense" | "both";
export type WalletRuleType = "Category" | "TransactionType" | "Keyword" | "DateRange" | "AmountRange";
export type RecurringFrequency = "Daily" | "Weekly" | "Biweekly" | "Monthly" | "Yearly";
export type RecurringStatus = "active" | "paused" | "cancelled";


export interface User {
  id: string; // UUID
  name: string;
  mail: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  amount: number;
  type: TransactionType;
  date: string; // ISO date
  category_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  amount: number;
  type: TransactionType;
  frequency: RecurringFrequency;
  start_date: string;
  next_execution: string;
  last_executed: string | null;
  status: RecurringStatus;
  auto_execute: boolean;
  category_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  is_active: boolean;
  is_hidden: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
}


export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletRule {
  id: string;
  user_id: string;
  wallet_id: string;
  rule_type: WalletRuleType;
  category_id: string | null;
  transaction_type: TransactionType | null;
  keyword: string | null;
  date_from: string | null;
  date_to: string | null;
  amount_from: number | null;
  amount_to: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
