import { create } from 'zustand'
import { AppSettings, PageId } from '../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  serverUrl: 'http://127.0.0.1:9876',
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
  notificationsEnabled: true,
  projectName: 'DCS Manager',
  projectSubtitle: 'Docker Compose Skeleton',
  connectionProfiles: [],
  customCSS: '',
}

interface SettingsState extends AppSettings {
  currentPage: PageId
  setCurrentPage: (page: PageId) => void
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

  setCurrentPage: (page) => set({ currentPage: page }),

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
    set({ ...DEFAULT_SETTINGS, ...stored })
  },
}))
