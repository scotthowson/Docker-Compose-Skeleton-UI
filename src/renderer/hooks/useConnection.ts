// =============================================================================
// useConnection — monitors API connectivity with auto-reconnect
// =============================================================================

import { useEffect, useRef, useCallback } from 'react'
import { useConnectionStore } from '../stores/connectionStore'
import type { ConnectionStatus } from '../../shared/types'

export interface UseConnectionResult {
  status: ConnectionStatus
  serverUrl: string
  error: string | null
  /** Manually trigger a connection test. */
  testConnection: () => Promise<boolean>
}

/**
 * Manages API connection lifecycle:
 * - Initiates connection on mount
 * - Monitors document visibility (reconnects when tab regains focus)
 * - The store handles exponential backoff internally via connect()
 */
export function useConnection(): UseConnectionResult {
  const status = useConnectionStore((s) => s.status)
  const serverUrl = useConnectionStore((s) => s.serverUrl)
  const lastError = useConnectionStore((s) => s.lastError)
  const connect = useConnectionStore((s) => s.connect)
  const disconnect = useConnectionStore((s) => s.disconnect)

  const mountedRef = useRef(true)

  // Initiate connection on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [connect, disconnect])

  // Reconnect when the tab regains focus and we are not already connected
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && mountedRef.current) {
        const currentStatus = useConnectionStore.getState().status
        if (currentStatus !== 'connected' && currentStatus !== 'connecting') {
          connect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [connect])

  const testConnection = useCallback(async (): Promise<boolean> => {
    return connect()
  }, [connect])

  return {
    status,
    serverUrl,
    error: lastError,
    testConnection,
  }
}
