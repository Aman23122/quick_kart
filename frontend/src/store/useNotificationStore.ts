import { create } from "zustand";
import api from "@/lib/axios";

export interface Notification {
  id: string;
  type: string;
  message: string;
  variant_id?: string;
  extra?: Record<string, unknown>;
  created_at: string;
  read: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  fetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  fetch: async () => {
    try {
      const { data } = await api.get("/api/dashboard/notifications");
      const list: Notification[] = data.data || [];
      set({ notifications: list, unreadCount: list.filter((n) => !n.read).length });
    } catch {}
  },

  markRead: async (id: string) => {
    try {
      await api.post(`/api/dashboard/notifications/${id}/read`);
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch {}
  },
}));
