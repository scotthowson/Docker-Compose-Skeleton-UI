// =============================================================================
// usePolling — generic data-fetching hook with interval polling
// =============================================================================

import { useEffect, useRef, useCallback, useState } from 'react'

export interface UsePollingOptions {
  /** Whether polling is active. Defaults to true. */
  enabled?: boolean
  /** Called when the fetch function throws. */
  onError?: (err: Error) => void
}

export interface UsePollingResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  /** Trigger an immediate refetch outside the regular interval. */
  refresh: () => void
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number,
  options?: UsePollingOptions,
): UsePollingResult<T> {
  const { enabled = true, onError } = options ?? {}

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  // Refs to keep callback identities stable across renders
  const fetchFnRef = useRef(fetchFn)
  const onErrorRef = useRef(onError)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const fetchingRef = useRef(false)

  // Keep refs in sync with latest props
  useEffect(() => {
    fetchFnRef.current = fetchFn
  }, [fetchFn])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  // Core fetch logic
  const doFetch = useCallback(async () => {
    // Prevent overlapping requests
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      const result = await fetchFnRef.current()
      if (mountedRef.current) {
        setData(result)
        setError(null)
        setLoading(false)
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const wrapped = err instanceof Error ? err : new Error(String(err))
        setError(wrapped)
        setLoading(false)
        onErrorRef.current?.(wrapped)
      }
    } finally {
      fetchingRef.current = false
    }
  }, [])

  // Manual refresh
  const refresh = useCallback(() => {
    doFetch()
  }, [doFetch])

  // Start/stop polling based on enabled flag and visibility
  useEffect(() => {
    mountedRef.current = true

    if (!enabled) {
      setLoading(false)
      return
    }

    // Initial fetch
    setLoading(true)
    doFetch()

    // Set up interval
    const startInterval = () => {
      stopInterval()
      intervalRef.current = setInterval(doFetch, intervalMs)
    }

    const stopInterval = () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    startInterval()

    // Pause polling when the tab/window is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        stopInterval()
      } else {
        // Fetch immediately on return, then resume interval
        doFetch()
        startInterval()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      mountedRef.current = false
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, intervalMs, doFetch])

  return { data, loading, error, refresh }
}
