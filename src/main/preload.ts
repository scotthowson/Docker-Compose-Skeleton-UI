import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  getSettings: () => Promise<Record<string, unknown>>
  getSetting: (key: string) => Promise<unknown>
  setSetting: (key: string, value: unknown) => Promise<boolean>
  getVersion: () => Promise<string>
  /** Combined server check: connectivity + setup status in one call (Node.js http, no CORS) */
  checkServer: (serverUrl: string) => Promise<{ reachable: boolean; initialized: boolean; error?: string }>
  /** Generic JSON fetch via Node.js http (bypasses all browser security) */
  netFetchJson: (url: string) => Promise<{ ok: boolean; status: number; data: unknown; error?: string }>
}

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getSetting: (key: string) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('set-setting', key, value),
  getVersion: () => ipcRenderer.invoke('get-version'),
  checkServer: (serverUrl: string) => ipcRenderer.invoke('check-server', serverUrl),
  netFetchJson: (url: string) => ipcRenderer.invoke('net-fetch-json', url),
} satisfies ElectronAPI)
