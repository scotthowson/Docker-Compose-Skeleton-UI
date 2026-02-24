import Store from 'electron-store'

export interface AppSettings {
  serverUrl: string
  pollingInterval: number
  containerPollingInterval: number
  imagePollingInterval: number
  logPollingInterval: number
  theme: 'dark' | 'light'
  sidebarCollapsed: boolean
  windowBounds: { width: number; height: number }
}

export const appStore = new Store<AppSettings>({
  defaults: {
    serverUrl: 'http://127.0.0.1:9876',
    pollingInterval: 5000,
    containerPollingInterval: 10000,
    imagePollingInterval: 60000,
    logPollingInterval: 3000,
    theme: 'dark',
    sidebarCollapsed: false,
    windowBounds: { width: 1400, height: 900 },
  },
})
