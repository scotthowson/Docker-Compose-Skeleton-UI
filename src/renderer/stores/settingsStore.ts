import { create } from 'zustand'
import { AppSettings, PageId, ADMIN_ONLY_PAGES } from '../../shared/types'
// Circular import with authStore is safe — both stores only reference each other
// inside function bodies (never at module evaluation time).
import { useAuthStore } from './authStore'
import { getDefaultServerUrl } from '../lib/env'

export const DEFAULT_SETTINGS: AppSettings = {
  serverUrl: getDefaultServerUrl(),
  pollingInterval: 10000,
  containerPollingInterval: 5000,
  imagePollingInterval: 60000,
  logPollingInterval: 3000,
  theme: 'dark',
  sidebarCollapsed: false,
  diskLabels: {},
  pinnedDisks: [],
  customDisks: [],
  stackAnnotations: {},
  backgroundImage: '',
  autoLockMinutes: 0,
  autoCheckUpdates: 0, // 0 = off, or interval in ms (3600000 = hourly, 86400000 = daily)
  updatesAvailable: 0, // number of available DCS framework updates
  notificationsEnabled: true,
  projectName: 'DCS Manager',
  projectSubtitle: 'Docker Compose Skeleton',
  connectionProfiles: [],
  customCSS: '',
  rememberUsername: true,
  lastUsername: '',
  sessionDurationMinutes: 240,
}

interface SettingsState extends AppSettings {
  currentPage: PageId
  navigationPayload: Record<string, unknown> | null
  setCurrentPage: (page: PageId, payload?: Record<string, unknown>) => void
  consumeNavigationPayload: () => Record<string, unknown> | null
  toggleSidebar: () => void
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  loadSettings: () => Promise<void>
}

/** Persist a single setting via electron-store IPC or localStorage fallback. */
async function persistSetting(key: string, value: unknown): Promise<void> {
  if (window.electronAPI) {
    await window.electronAPI.setSetting(key, value)
  } else {
    try {
      const raw = localStorage.getItem('app-settings')
      const obj = raw ? JSON.parse(raw) : {}
      obj[key] = value
      localStorage.setItem('app-settings', JSON.stringify(obj))
    } catch {
      // localStorage may be unavailable in some environments
    }
  }
}

/** Load all settings from electron-store IPC or localStorage fallback. */
async function loadPersistedSettings(): Promise<Partial<AppSettings>> {
  if (window.electronAPI) {
    const stored = await window.electronAPI.getSettings()
    return stored as Partial<AppSettings>
  }
  try {
    const raw = localStorage.getItem('app-settings')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  currentPage: 'dashboard',
  navigationPayload: null,

  setCurrentPage: (page, payload) => {
    // Navigation guard: block non-admin users from admin-only pages
    if (ADMIN_ONLY_PAGES.has(page)) {
      const role = useAuthStore.getState().userRole
      if (role !== 'admin') {
        set({ currentPage: 'dashboard', navigationPayload: null })
        return
      }
    }
    set({ currentPage: page, navigationPayload: payload ?? null })
    // Persist last page so F5/refresh restores it (skip transient pages)
    if (page !== 'setup' && page !== 'login') {
      persistSetting('lastPage', page)
    }
  },

  consumeNavigationPayload: () => {
    const { navigationPayload } = useSettingsStore.getState()
    if (navigationPayload) set({ navigationPayload: null })
    return navigationPayload
  },

  toggleSidebar: () =>
    set((state) => {
      const collapsed = !state.sidebarCollapsed
      persistSetting('sidebarCollapsed', collapsed)
      return { sidebarCollapsed: collapsed }
    }),

  updateSetting: (key, value) => {
    set({ [key]: value } as Partial<SettingsState>)
    persistSetting(key, value)
  },

  loadSettings: async () => {
    const stored = await loadPersistedSettings()
    const lastPage = (stored as Record<string, unknown>).lastPage as PageId | undefined
    // Don't restore admin-only pages for non-admin users
    let restoredPage: PageId | undefined
    if (lastPage && lastPage !== 'setup' && lastPage !== 'login') {
      if (ADMIN_ONLY_PAGES.has(lastPage)) {
        try {
          const role = useAuthStore.getState().userRole
          restoredPage = role === 'admin' ? lastPage : undefined
        } catch {
          restoredPage = undefined
        }
      } else {
        restoredPage = lastPage
      }
    }
    set({
      ...DEFAULT_SETTINGS,
      ...stored,
      ...(restoredPage ? { currentPage: restoredPage } : {}),
    })
  },
}))
