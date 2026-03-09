import { create } from 'zustand'

const MAX_NOTIFICATIONS = 100
const PERSIST_KEY = 'app-notifications'
const PREFS_KEY = 'notification-preferences'
const PERSIST_COUNT = 50

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: number
  read: boolean
  persist?: boolean
  icon?: string
  action?: { label: string; page: string }
  /** Server ID this notification belongs to. Null/undefined = global (shown for all servers). */
  serverId?: string | null
}

export interface NotificationPreferences {
  healthAlerts: boolean
  connectionAlerts: boolean
  containerCrashAlerts: boolean
  desktopNotifications: boolean
  diskWarningThreshold: number
}

const DEFAULT_PREFS: NotificationPreferences = {
  healthAlerts: true,
  connectionAlerts: true,
  containerCrashAlerts: true,
  desktopNotifications: false,
  diskWarningThreshold: 85,
}

function loadPersistedNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, PERSIST_COUNT) : []
  } catch {
    return []
  }
}

function persistNotifications(notifications: Notification[]) {
  try {
    const toPersist = notifications.filter((n) => n.persist !== false).slice(0, PERSIST_COUNT)
    localStorage.setItem(PERSIST_KEY, JSON.stringify(toPersist))
  } catch {}
}

function loadPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

function persistPreferences(prefs: NotificationPreferences) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {}
}

/** Attempt to show a desktop notification (Web Notification API) */
function showDesktopNotification(notification: Notification) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (document.hasFocus()) return

  try {
    new Notification(notification.title, {
      body: notification.message,
      icon: undefined,
      tag: notification.id,
    })
  } catch {}
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  drawerOpen: boolean
  preferences: NotificationPreferences

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  /** Get notifications filtered to the active server (includes global + server-specific) */
  getServerNotifications: () => Notification[]
  /** Get unread count for the active server */
  getServerUnreadCount: () => number
  markAsRead: (id: string) => void
  markAllRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
  toggleDrawer: () => void
  setDrawerOpen: (open: boolean) => void
  setPreference: <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => void
  requestDesktopPermission: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => {
  const initial = loadPersistedNotifications()

  return {
    notifications: initial,
    unreadCount: initial.filter((n) => !n.read).length,
    drawerOpen: false,
    preferences: loadPreferences(),

    getServerNotifications: () => {
      const { notifications } = get()
      let activeServerId: string | null = null
      try {
        const raw = localStorage.getItem('dcs-servers')
        if (raw) activeServerId = JSON.parse(raw).activeServerId || null
      } catch { /* ignore */ }

      // Show global notifications (no serverId) + notifications for the active server
      return notifications.filter(n => !n.serverId || n.serverId === activeServerId)
    },

    getServerUnreadCount: () => {
      return get().getServerNotifications().filter(n => !n.read).length
    },

    addNotification: (notification) =>
      set((state) => {
        // Auto-tag with active server ID if not explicitly set
        let serverId = notification.serverId
        if (serverId === undefined) {
          try {
            const raw = localStorage.getItem('dcs-servers')
            if (raw) {
              const data = JSON.parse(raw)
              serverId = data.activeServerId || null
            }
          } catch { /* ignore */ }
        }
        const newNotification: Notification = {
          ...notification,
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          timestamp: Date.now(),
          read: false,
          serverId: serverId ?? null,
        }
        const notifications = [newNotification, ...state.notifications].slice(0, MAX_NOTIFICATIONS)

        // Desktop notification
        if (state.preferences.desktopNotifications) {
          showDesktopNotification(newNotification)
        }

        persistNotifications(notifications)
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
        persistNotifications(notifications)
        return {
          notifications,
          unreadCount: notifications.filter((n) => !n.read).length,
        }
      }),

    markAllRead: () =>
      set((state) => {
        const notifications = state.notifications.map((n) => ({ ...n, read: true }))
        persistNotifications(notifications)
        return { notifications, unreadCount: 0 }
      }),

    removeNotification: (id) =>
      set((state) => {
        const notifications = state.notifications.filter((n) => n.id !== id)
        persistNotifications(notifications)
        return {
          notifications,
          unreadCount: notifications.filter((n) => !n.read).length,
        }
      }),

    clearAll: () => {
      try { localStorage.removeItem(PERSIST_KEY) } catch {}
      set({ notifications: [], unreadCount: 0 })
    },

    toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

    setDrawerOpen: (open) => set({ drawerOpen: open }),

    setPreference: (key, value) =>
      set((state) => {
        const preferences = { ...state.preferences, [key]: value }
        persistPreferences(preferences)
        return { preferences }
      }),

    requestDesktopPermission: () => {
      if (!('Notification' in window)) return
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            get().setPreference('desktopNotifications', true)
          }
        })
      }
    },
  }
})
