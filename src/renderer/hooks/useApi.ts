// =============================================================================
// useApi — connection-aware polling hook for API endpoints
// =============================================================================

import { useMemo } from 'react'
import { usePolling, UsePollingOptions, UsePollingResult } from './usePolling'
import { useConnectionStore } from '../stores/connectionStore'

export interface UseApiOptions extends UsePollingOptions {
  /**
   * Additional enabled condition. Polling only runs when this AND
   * the connection status is 'connected' are both true.
   * Defaults to true.
   */
  enabled?: boolean
}

/**
 * Combines usePolling with connection awareness.
 *
 * Polling is automatically paused when the API connection is not established
 * (status !== 'connected') and resumes once connectivity is restored.
 *
 * @param endpointFn - Async function that calls an API endpoint (e.g. fetchStacks)
 * @param intervalMs - Polling interval in milliseconds
 * @param options    - Optional enabled flag and error handler
 */
export function useApi<T>(
  endpointFn: () => Promise<T>,
  intervalMs: number,
  options?: UseApiOptions,
): UsePollingResult<T> {
  const { enabled = true, onError } = options ?? {}

  const isConnected = useConnectionStore((s) => s.status === 'connected')

  // Polling is only active when we have a live connection AND the caller
  // has not explicitly disabled it.
  const effectiveEnabled = enabled && isConnected

  const pollingOptions = useMemo<UsePollingOptions>(
    () => ({ enabled: effectiveEnabled, onError }),
    [effectiveEnabled, onError],
  )

  return usePolling<T>(endpointFn, intervalMs, pollingOptions)
}
