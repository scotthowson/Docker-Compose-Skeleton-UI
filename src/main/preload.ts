import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  getSettings: () => Promise<Record<string, unknown>>
  getSetting: (key: string) => Promise<unknown>
  setSetting: (key: string, value: unknown) => Promise<boolean>
  getVersion: () => Promise<string>
  /** Fetch a URL via the main process (bypasses CORS/CSP/PNA restrictions) */
  netFetchJson: (url: string) => Promise<{ ok: boolean; status: number; data: unknown }>
}

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getSetting: (key: string) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('set-setting', key, value),
  getVersion: () => ipcRenderer.invoke('get-version'),
  netFetchJson: (url: string) => ipcRenderer.invoke('net-fetch-json', url),
} satisfies ElectronAPI)
