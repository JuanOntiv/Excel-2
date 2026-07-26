import { apiClient } from "./client";
import type { AppNotification } from "../types";

export async function listNotifications(isRead?: boolean): Promise<AppNotification[]> {
  const params = isRead === undefined ? {} : { is_read: isRead };
  const { data } = await apiClient.get<AppNotification[]>("/notifications/", { params });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>("/notifications/unread-count");
  return data.count;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const { data } = await apiClient.post<AppNotification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post("/notifications/read-all");
}

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}
