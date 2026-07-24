import { apiClient } from "./client";
import type { ActivityLog, LogAction, LogLevel } from "../types";

export interface LogFilters {
  skip?: number;
  limit?: number;
  action?: LogAction;
  level?: LogLevel;
}

export async function listLogs(filters: LogFilters = {}): Promise<ActivityLog[]> {
  const { data } = await apiClient.get<ActivityLog[]>("/logs/", { params: filters });
  return data;
}
