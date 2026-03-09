// =============================================================================
// GlobalPoller — keeps critical store data fresh regardless of active page
// =============================================================================

import { useEffect, useRef, useCallback } from 'react'
import { useConnectionStore } from '../stores/connectionStore'
import { useSystemStore } from '../stores/systemStore'
import { useHealthStore } from '../stores/healthStore'
import { fetchServerStatus, fetchHealthReport } from '../api/endpoints'

const STATUS_INTERVAL = 5000
const HEALTH_INTERVAL = 10000

export function GlobalPoller() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setSystemStatus = useSystemStore((s) => s.setStatus)
  const setHealthReport = useHealthStore((s) => s.setReport)

  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const healthTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchingStatus = useRef(false)
  const fetchingHealth = useRef(false)
  const mountedRef = useRef(true)

  const pollStatus = useCallback(async () => {
    if (fetchingStatus.current || !mountedRef.current) return
    fetchingStatus.current = true
    try {
      const data = await fetchServerStatus()
      if (mountedRef.current) setSystemStatus(data)
    } catch { /* silent — connection store handles errors */ }
    fetchingStatus.current = false
  }, [setSystemStatus])

  const pollHealth = useCallback(async () => {
    if (fetchingHealth.current || !mountedRef.current) return
    fetchingHealth.current = true
    try {
      const data = await fetchHealthReport()
      if (mountedRef.current) setHealthReport(data)
    } catch { /* silent */ }
    fetchingHealth.current = false
  }, [setHealthReport])

  useEffect(() => {
    mountedRef.current = true

    const clearTimers = () => {
      if (statusTimer.current) { clearInterval(statusTimer.current); statusTimer.current = null }
      if (healthTimer.current) { clearInterval(healthTimer.current); healthTimer.current = null }
    }

    if (!isConnected) {
      clearTimers()
      return
    }

    // Immediate fetch on connect
    pollStatus()
    pollHealth()

    statusTimer.current = setInterval(pollStatus, STATUS_INTERVAL)
    healthTimer.current = setInterval(pollHealth, HEALTH_INTERVAL)

    // Pause when tab hidden, resume when visible
    const onVisibility = () => {
      if (document.hidden) {
        clearTimers()
      } else {
        pollStatus()
        pollHealth()
        statusTimer.current = setInterval(pollStatus, STATUS_INTERVAL)
        healthTimer.current = setInterval(pollHealth, HEALTH_INTERVAL)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mountedRef.current = false
      clearTimers()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isConnected, pollStatus, pollHealth])

  // Listen for Ctrl+R app-refresh events
  useEffect(() => {
    const handler = () => { pollStatus(); pollHealth() }
    window.addEventListener('app-refresh', handler)
    return () => window.removeEventListener('app-refresh', handler)
  }, [pollStatus, pollHealth])

  return null
}
