import { apiClient } from "./client";
import type { Goal, GoalProgress, GoalType } from "../types";

export interface GoalPayload {
  name: string;
  description?: string;
  goal_type: GoalType;
  target_amount: number;
  start_date: string;
  end_date: string;
  wallet_id?: string | null;
  category_id?: string | null;
}

// Devuelve las metas con su progreso ya calculado por el servidor (ver
// list_goals en routes/goals.py). Antes había que encadenar un
// getGoalProgress() por meta; ahora viene inline en una sola petición.
export async function listGoals(): Promise<GoalProgress[]> {
  const { data } = await apiClient.get<GoalProgress[]>("/goals/");
  return data;
}

export async function getGoal(id: string): Promise<Goal> {
  const { data } = await apiClient.get<Goal>(`/goals/${id}`);
  return data;
}

export async function getGoalProgress(id: string): Promise<GoalProgress> {
  const { data } = await apiClient.get<GoalProgress>(`/goals/${id}/progress`);
  return data;
}

export async function createGoal(payload: GoalPayload) {
  const { data } = await apiClient.post<Goal>("/goals/", payload);
  return data;
}

export async function updateGoal(id: string, payload: Partial<GoalPayload>) {
  const { data } = await apiClient.patch<Goal>(`/goals/${id}`, payload);
  return data;
}

export async function cancelGoal(id: string) {
  const { data } = await apiClient.post<Goal>(`/goals/${id}/cancel`);
  return data;
}

export async function deleteGoal(id: string) {
  await apiClient.delete(`/goals/${id}`);
}
