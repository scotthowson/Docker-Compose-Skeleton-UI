// =============================================================================
// SSE Client — EventSource wrapper for real-time server push
// =============================================================================

import { useConnectionStore } from '../stores/connectionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { apiClient } from '../api/client'

export type SSEEventType = 'docker-event' | 'metrics' | 'log-line' | 'health-score' | 'keepalive'

export interface SSEMessage {
  type: SSEEventType
  data: unknown
  timestamp: string
}

type SSEListener = (event: SSEMessage) => void

class SSEClient {
  private eventSource: EventSource | null = null
  private listeners: Map<SSEEventType | '*', Set<SSEListener>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 20
  private _connected = false
  private _authFailed = false

  connect(): void {
    this.disconnect()
    this._authFailed = false

    const { serverUrl } = useSettingsStore.getState()
    // Pass auth token as query parameter since EventSource can't set headers
    const token = apiClient.getAuthToken()
    const url = token
      ? `${serverUrl}/stream?token=${encodeURIComponent(token)}`
      : `${serverUrl}/stream`

    try {
      this.eventSource = new EventSource(url)

      this.eventSource.onopen = () => {
        this._connected = true
        this._authFailed = false
        this.reconnectAttempts = 0
      }

      const eventTypes: SSEEventType[] = ['docker-event', 'metrics', 'log-line', 'health-score']
      for (const type of eventTypes) {
        this.eventSource.addEventListener(type, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            const msg: SSEMessage = { type, data, timestamp: new Date().toISOString() }
            this.emit(type, msg)
            this.emit('*', msg)
          } catch {
            // ignore parse errors
          }
        })
      }

      this.eventSource.onerror = () => {
        this._connected = false
        // Check if this was an auth failure (EventSource fires onerror for HTTP errors)
        // If readyState is CLOSED and we never connected, likely 401
        if (this.eventSource?.readyState === EventSource.CLOSED && this.reconnectAttempts === 0) {
          this._authFailed = true
        }
        this.eventSource?.close()
        this.eventSource = null
        this.scheduleReconnect()
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this._connected = false
    this.reconnectAttempts = 0
  }

  isConnected(): boolean {
    return this._connected
  }

  on(type: SSEEventType | '*', listener: SSEListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener)
    return () => this.listeners.get(type)?.delete(listener)
  }

  off(type: SSEEventType | '*', listener: SSEListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  private emit(type: SSEEventType | '*', event: SSEMessage): void {
    this.listeners.get(type)?.forEach(fn => {
      try { fn(event) } catch { /* ignore listener errors */ }
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    const { status } = useConnectionStore.getState()
    if (status === 'disconnected') return

    // If auth failed, use long backoff (don't spam 401s) — retry every 60s max 5 times
    if (this._authFailed) {
      if (this.reconnectAttempts >= 5) return
      const delay = 60000
      this.reconnectAttempts++
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        this.connect()
      }, delay)
      return
    }

    const delay = Math.min(1000 * Math.pow(2, Math.min(this.reconnectAttempts, 5)), 30000)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }
}

export const sseClient = new SSEClient()
