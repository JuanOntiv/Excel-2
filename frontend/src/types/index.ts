export type TransactionType = "income" | "expense";
export type CategoryType = "income" | "expense" | "both";

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
