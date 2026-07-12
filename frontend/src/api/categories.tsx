import { apiClient } from "./client";
import type { Category, CategoryType } from "../types";

export async function listCategories(includeHidden = false): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>("/categories/", {
    params: { include_hidden: includeHidden },
  });
  return data;
}

export async function createCategory(name: string, type: CategoryType) {
  const { data } = await apiClient.post<Category>("/categories/", { name, type });
  return data;
}

export async function updateCategory(
  id: string,
  payload: Partial<{ name: string; type: CategoryType; is_active: boolean }>
) {
  const { data } = await apiClient.patch<Category>(`/categories/${id}`, payload);
  return data;
}

export async function deleteCategory(id: string) {
  await apiClient.delete(`/categories/${id}`);
}

export async function updateCategoryPreference(
  categoryId: string,
  payload: Partial<{ is_hidden: boolean; color: string }>
) {
  const { data } = await apiClient.patch(`/categories/${categoryId}/preferences`, payload);
  return data;
}

export async function updateCategoryColor(categoryId: string, color: string) {
  return updateCategoryPreference(categoryId, { color });
}
