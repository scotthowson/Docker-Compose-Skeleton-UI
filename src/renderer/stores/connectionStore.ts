import { create } from 'zustand'
import { ConnectionStatus } from '../../shared/types'
import { apiClient } from '../api/client'
import { useNotificationStore } from './notificationStore'
import { useAuthStore } from './authStore'

const MAX_RECONNECT_ATTEMPTS = 50
const BASE_RECONNECT_DELAY_MS = 1000
const HEARTBEAT_INTERVAL_MS = 10000

interface ConnectionState {
  status: ConnectionStatus
  serverUrl: string
  lastError: string | null
  lastConnected: number | null
  reconnectAttempts: number
  consecutiveFailures: number
  setServerUrl: (url: string) => void
  setStatus: (status: ConnectionStatus) => void
  setError: (error: string | null) => void
  connect: () => Promise<boolean>
  disconnect: () => void
  reportPollSuccess: () => void
  reportPollFailure: () => void
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

/** Push a connection notification if the user has connection alerts enabled */
function pushConnectionNotification(type: 'success' | 'error' | 'warning', title: string, message: string) {
  const { preferences, addNotification } = useNotificationStore.getState()
  if (!preferences.connectionAlerts) return
  addNotification({ type, title, message, persist: true, action: { label: 'View Dashboard', page: 'dashboard' } })
}

function startHeartbeat(connectFn: () => Promise<boolean>) {
  stopHeartbeat()
  heartbeatTimer = setInterval(async () => {
    const ok = await apiClient.testConnection()
    if (!ok) {
      // Connection lost — trigger reconnect
      const store = useConnectionStore.getState()
      if (store.status === 'connected') {
        store.setStatus('error')
        store.setError('Lost connection to API server')
        pushConnectionNotification('error', 'Connection Lost', 'Lost connection to the API server. Attempting to reconnect...')
        connectFn()
      }
    }
  }, HEARTBEAT_INTERVAL_MS)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'disconnected',
  serverUrl: apiClient.getBaseUrl(),
  lastError: null,
  lastConnected: null,
  reconnectAttempts: 0,
  consecutiveFailures: 0,

  setServerUrl: (url) => {
    apiClient.setBaseUrl(url)
    set({ serverUrl: url })
  },

  setStatus: (status) => set({ status }),

  setError: (error) => set({ lastError: error }),

  connect: async () => {
    const { status, reconnectAttempts: prevAttempts } = get()
    if (status === 'connecting') return false

    // Restore API auth token from authStore before connecting
    const { apiToken } = useAuthStore.getState()
    if (apiToken && !apiClient.getAuthToken()) {
      apiClient.setAuthToken(apiToken)
    }

    const wasError = status === 'error'
    // Only show 'connecting' on first attempt or user-initiated retry.
    // During automatic reconnect retries, stay in 'error' to avoid UI flashing.
    if (prevAttempts === 0) {
      set({ status: 'connecting', lastError: null })
    }

    try {
      const ok = await apiClient.testConnection()
      if (ok) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
        set({
          status: 'connected',
          lastConnected: Date.now(),
          reconnectAttempts: 0,
          consecutiveFailures: 0,
          lastError: null,
        })

        // Notify on reconnection (only if we were in error state, not initial connect)
        if (wasError || prevAttempts > 0) {
          pushConnectionNotification('success', 'Connection Restored', 'Successfully reconnected to the API server.')
        }

        // Start heartbeat to detect disconnections
        startHeartbeat(() => get().connect())
        return true
      }
      throw new Error('Server returned unsuccessful response')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const attempts = get().reconnectAttempts + 1

      set({
        status: 'error',
        lastError: message,
        reconnectAttempts: attempts,
      })

      // Schedule reconnect with exponential backoff
      if (attempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          BASE_RECONNECT_DELAY_MS * Math.pow(2, Math.min(attempts - 1, 5)),
          30000,
        )
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          get().connect()
        }, delay)
      }

      return false
    }
  },

  disconnect: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    stopHeartbeat()
    set({
      status: 'disconnected',
      lastError: null,
      reconnectAttempts: 0,
      consecutiveFailures: 0,
    })
  },

  // Call this when a polling endpoint succeeds — resets failure counter
  reportPollSuccess: () => {
    const { consecutiveFailures, status } = get()
    if (consecutiveFailures > 0) {
      set({ consecutiveFailures: 0 })
    }
    // If we were in error state but a poll succeeded, we're actually connected
    if (status === 'error') {
      set({ status: 'connected', lastError: null, reconnectAttempts: 0 })
      pushConnectionNotification('success', 'Connection Restored', 'API connection recovered successfully.')
    }
  },

  // Call this when a polling endpoint fails — after N consecutive failures, mark disconnected
  reportPollFailure: () => {
    const failures = get().consecutiveFailures + 1
    set({ consecutiveFailures: failures })
    // After 3 consecutive poll failures, trigger reconnection
    if (failures >= 3 && get().status === 'connected') {
      set({ status: 'error', lastError: 'Multiple API requests failed' })
      pushConnectionNotification('error', 'Connection Unstable', 'Multiple API requests have failed. Attempting to reconnect...')
      get().connect()
    }
  },
}))
