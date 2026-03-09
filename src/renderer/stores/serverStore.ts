// =============================================================================
// Server Store — Multi-server profile management
// =============================================================================

import { create } from 'zustand'
import type { ServerProfile } from '../../shared/types'
import { apiClient } from '../api/client'
import { useConnectionStore } from './connectionStore'
import { useSettingsStore } from './settingsStore'

const STORAGE_KEY = 'dcs-servers'

interface ServerState {
  servers: ServerProfile[]
  activeServerId: string | null
  loading: boolean
  loadServers: () => void
  addServer: (server: Omit<ServerProfile, 'id'>) => ServerProfile
  removeServer: (id: string) => void
  updateServer: (id: string, updates: Partial<ServerProfile>) => void
  switchServer: (id: string) => Promise<boolean>
  getActiveServer: () => ServerProfile | null
  setDefaultServer: (id: string) => void
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function persistServers(servers: ServerProfile[], activeId: string | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ servers, activeServerId: activeId }))
  } catch { /* ignore */ }
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  activeServerId: null,
  loading: false,

  loadServers: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        set({ servers: data.servers || [], activeServerId: data.activeServerId || null })
      }
      if (get().servers.length === 0) {
        const { serverUrl } = useSettingsStore.getState()
        const defaultServer: ServerProfile = {
          id: generateId(),
          name: 'Local Server',
          url: serverUrl || 'http://127.0.0.1:9876',
          isDefault: true,
        }
        set({ servers: [defaultServer], activeServerId: defaultServer.id })
        persistServers([defaultServer], defaultServer.id)
      }
    } catch { /* ignore */ }
  },

  addServer: (server) => {
    const newServer: ServerProfile = { ...server, id: generateId() }
    const servers = [...get().servers, newServer]
    set({ servers })
    persistServers(servers, get().activeServerId)
    return newServer
  },

  removeServer: (id) => {
    const servers = get().servers.filter(s => s.id !== id)
    let activeId = get().activeServerId
    if (activeId === id) {
      activeId = servers[0]?.id || null
      if (activeId) get().switchServer(activeId)
    }
    set({ servers, activeServerId: activeId })
    persistServers(servers, activeId)
  },

  updateServer: (id, updates) => {
    const servers = get().servers.map(s => s.id === id ? { ...s, ...updates } : s)
    set({ servers })
    persistServers(servers, get().activeServerId)
  },

  switchServer: async (id) => {
    const server = get().servers.find(s => s.id === id)
    if (!server) return false

    set({ loading: true, activeServerId: id })

    apiClient.setBaseUrl(server.url)
    if (server.apiToken) {
      apiClient.setAuthToken(server.apiToken)
    } else {
      apiClient.setAuthToken(null)
    }

    useConnectionStore.getState().setServerUrl(server.url)
    useSettingsStore.getState().updateSetting('serverUrl', server.url)

    const connected = await useConnectionStore.getState().connect()
    if (connected) {
      get().updateServer(id, { lastConnected: Date.now() })
    }

    set({ loading: false })
    persistServers(get().servers, id)
    return connected
  },

  getActiveServer: () => {
    const { servers, activeServerId } = get()
    return servers.find(s => s.id === activeServerId) || null
  },

  setDefaultServer: (id) => {
    const servers = get().servers.map(s => ({ ...s, isDefault: s.id === id }))
    set({ servers })
    persistServers(servers, get().activeServerId)
  },
}))
