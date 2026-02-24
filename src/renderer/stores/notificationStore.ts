import { create } from 'zustand'

const MAX_NOTIFICATIONS = 100

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: number
  read: boolean
  icon?: string
  action?: { label: string; page: string }
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  drawerOpen: boolean

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
  toggleDrawer: () => void
  setDrawerOpen: (open: boolean) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  drawerOpen: false,

  addNotification: (notification) =>
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        timestamp: Date.now(),
        read: false,
      }
      const notifications = [newNotification, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      }
    }),

  markAsRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      }
    }),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  removeNotification: (id) =>
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id)
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      }
    }),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

  setDrawerOpen: (open) => set({ drawerOpen: open }),
}))
