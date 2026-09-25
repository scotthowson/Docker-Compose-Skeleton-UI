// =============================================================================
// Server Store — Multi-server profile management
// =============================================================================

import { create } from 'zustand'
import type { ServerProfile, ConnectionProfile } from '../../shared/types'
import { apiClient } from '../api/client'
import { useConnectionStore } from './connectionStore'
import { useSettingsStore } from './settingsStore'
import { useContainerStore } from './containerStore'
import { useStackStore } from './stackStore'
import { useHealthStore } from './healthStore'
import { useSystemStore } from './systemStore'
import { useImageStore } from './imageStore'
import { useLogStore } from './logStore'
import { useAuthStore } from './authStore'
import { getDefaultServerUrl } from '../lib/env'

const STORAGE_KEY = 'dcs-servers'

interface ServerState {
  servers: ServerProfile[]
  activeServerId: string | null
  loading: boolean
  loadServers: () => void
  /** One-time import of the profiles the Settings page used to keep on its own */
  importLegacyProfiles: () => void
  /** Keep the session obtained on the active server so switching back is seamless */
  rememberSession: (token: string, username: string) => void
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
          url: serverUrl || getDefaultServerUrl(),
          isDefault: true,
        }
        set({ servers: [defaultServer], activeServerId: defaultServer.id })
        persistServers([defaultServer], defaultServer.id)
      }
      get().importLegacyProfiles()
    } catch { /* ignore */ }
  },

  importLegacyProfiles: () => {
    const legacy = useSettingsStore.getState().connectionProfiles ?? []
    if (legacy.length === 0) return
    const known = new Set(get().servers.map((s) => s.url))
    const extra: ServerProfile[] = legacy
      .filter((p: ConnectionProfile) => p.url && !known.has(p.url))
      .map((p: ConnectionProfile) => ({ id: generateId(), name: p.name || p.url, url: p.url, isDefault: false, lastConnected: p.lastConnected }))
    if (extra.length > 0) {
      const servers = [...get().servers, ...extra]
      set({ servers })
      persistServers(servers, get().activeServerId)
    }
    useSettingsStore.getState().updateSetting('connectionProfiles', [])
  },

  rememberSession: (token, username) => {
    const id = get().activeServerId
    if (id) get().updateServer(id, { apiToken: token, username })
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

    // Disconnect from current server first
    useConnectionStore.getState().disconnect()

    // Clear all data stores so stale data from previous server doesn't display
    useContainerStore.getState().setContainers([])
    useStackStore.getState().setStacks([])
    useHealthStore.getState().setReport(null)
    useSystemStore.getState().setStatus(null)
    useImageStore.getState().setImages([])
    useLogStore.getState().setEvents([])

    apiClient.setBaseUrl(server.url)
    // Sessions are per server: continue with the one saved for this profile,
    // otherwise the login page for this server takes over
    const auth = useAuthStore.getState()
    if (server.apiToken) {
      auth.adoptSession(server.username || auth.currentUser || 'admin', server.apiToken)
    } else {
      auth.suspendSession()
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
