import { create } from 'zustand';
import { NotificationApi } from '../services/api/notificationApi.js';
import type { InAppNotificationItem, NotificationCategory } from '@ai-companion/types';

interface NotificationState {
  unreadCount: number;
  notifications: InAppNotificationItem[];
  loading: boolean;
  activeCategory?: NotificationCategory;
  page: number;
  hasMore: boolean;

  fetchUnreadCount: () => Promise<void>;
  fetchInbox: (category?: NotificationCategory, reset?: boolean) => Promise<void>;
  markAsRead: (notificationIds: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  notifications: [],
  loading: false,
  activeCategory: undefined,
  page: 1,
  hasMore: true,

  fetchUnreadCount: async () => {
    try {
      const unreadCount = await NotificationApi.getUnreadCount();
      set({ unreadCount });
    } catch {
      // Non-fatal unread count fetch
    }
  },

  fetchInbox: async (category?: NotificationCategory, reset = false) => {
    set({ loading: true });
    const targetPage = reset ? 1 : get().page;
    try {
      const response = await NotificationApi.getInbox({
        page: targetPage,
        limit: 20,
        category,
      });

      set({
        notifications: reset ? response.items : [...get().notifications, ...response.items],
        unreadCount: response.unreadCount,
        activeCategory: category,
        page: targetPage + 1,
        hasMore: response.hasMore,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  markAsRead: async (notificationIds: string[]) => {
    // Optimistically mark locally
    set(state => ({
      notifications: state.notifications.map(n =>
        notificationIds.includes(n.id) ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
      ),
      unreadCount: Math.max(0, state.unreadCount - notificationIds.length),
    }));

    try {
      await NotificationApi.markRead({ notificationIds });
    } catch {
      // Fallback
    }
  },

  markAllAsRead: async () => {
    set(state => ({
      notifications: state.notifications.map(n => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      })),
      unreadCount: 0,
    }));

    try {
      await NotificationApi.markRead({ all: true });
    } catch {
      // Fallback
    }
  },

  deleteNotification: async (notificationId: string) => {
    const target = get().notifications.find(n => n.id === notificationId);
    const wasUnread = target && !target.isRead;

    set(state => ({
      notifications: state.notifications.filter(n => n.id !== notificationId),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));

    try {
      await NotificationApi.deleteNotification(notificationId);
    } catch {
      // Fallback
    }
  },
}));
