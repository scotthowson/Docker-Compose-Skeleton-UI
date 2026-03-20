// =============================================================================
// GlobalPoller — keeps critical store data fresh regardless of active page
// =============================================================================

import { useEffect, useRef, useCallback } from 'react'
import { useConnectionStore } from '../stores/connectionStore'
import { useSystemStore } from '../stores/systemStore'
import { useHealthStore } from '../stores/healthStore'
import { useSettingsStore } from '../stores/settingsStore'
import { fetchServerStatus, fetchHealthReport, checkSystemUpdate } from '../api/endpoints'

const STATUS_INTERVAL = 5000
const HEALTH_INTERVAL = 10000
const UPDATE_CHECK_DELAY = 15000 // delay initial check to avoid competing with startup

export function GlobalPoller() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setSystemStatus = useSystemStore((s) => s.setStatus)
  const setHealthReport = useHealthStore((s) => s.setReport)
  const autoCheckUpdates = useSettingsStore((s) => s.autoCheckUpdates)

  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const healthTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const updateTimer = useRef<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null>(null)
  const fetchingStatus = useRef(false)
  const fetchingHealth = useRef(false)
  const fetchingUpdates = useRef(false)
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

  const pollUpdates = useCallback(async () => {
    if (fetchingUpdates.current || !mountedRef.current) return
    fetchingUpdates.current = true
    try {
      const result = await checkSystemUpdate()
      if (mountedRef.current) {
        useSettingsStore.getState().updateSetting(
          'updatesAvailable',
          result.available ? result.commits_behind : 0,
        )
      }
    } catch { /* silent — update check is best-effort */ }
    fetchingUpdates.current = false
  }, [])

  useEffect(() => {
    mountedRef.current = true

    const clearTimers = () => {
      if (statusTimer.current) { clearInterval(statusTimer.current); statusTimer.current = null }
      if (healthTimer.current) { clearInterval(healthTimer.current); healthTimer.current = null }
      if (updateTimer.current) { clearTimeout(updateTimer.current); clearInterval(updateTimer.current); updateTimer.current = null }
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

    // Delayed initial update check + periodic interval (if enabled)
    if (autoCheckUpdates > 0) {
      updateTimer.current = setTimeout(() => {
        pollUpdates()
        // After initial check, set up the recurring interval
        updateTimer.current = setInterval(pollUpdates, autoCheckUpdates)
      }, UPDATE_CHECK_DELAY)
    }

    // Pause when tab hidden, resume when visible
    const onVisibility = () => {
      if (document.hidden) {
        clearTimers()
      } else {
        pollStatus()
        pollHealth()
        statusTimer.current = setInterval(pollStatus, STATUS_INTERVAL)
        healthTimer.current = setInterval(pollHealth, HEALTH_INTERVAL)
        // Don't re-trigger update check on visibility — it's long-interval
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mountedRef.current = false
      clearTimers()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isConnected, autoCheckUpdates, pollStatus, pollHealth, pollUpdates])

  // Listen for Ctrl+R app-refresh events
  useEffect(() => {
    const handler = () => { pollStatus(); pollHealth() }
    window.addEventListener('app-refresh', handler)
    return () => window.removeEventListener('app-refresh', handler)
  }, [pollStatus, pollHealth])

  return null
}
