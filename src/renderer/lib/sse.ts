// =============================================================================
// SSE Client — EventSource wrapper for real-time server push
// =============================================================================

import { useConnectionStore } from '../stores/connectionStore'
import { useSettingsStore } from '../stores/settingsStore'

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

  connect(): void {
    this.disconnect()

    const { serverUrl } = useSettingsStore.getState()
    const url = `${serverUrl}/stream`

    try {
      this.eventSource = new EventSource(url)

      this.eventSource.onopen = () => {
        this._connected = true
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

    const delay = Math.min(1000 * Math.pow(2, Math.min(this.reconnectAttempts, 5)), 30000)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }
}

export const sseClient = new SSEClient()
