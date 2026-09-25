// =============================================================================
// GlobalPoller — keeps critical store data fresh regardless of active page
// =============================================================================

import { useEffect, useRef, useCallback } from 'react'
import { useConnectionStore } from '../stores/connectionStore'
import { useSystemStore } from '../stores/systemStore'
import { useHealthStore } from '../stores/healthStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useContainerStore } from '../stores/containerStore'
import { fetchServerStatus, fetchHealthReport, fetchContainers, checkSystemUpdate } from '../api/endpoints'

const STATUS_INTERVAL = 5000
const HEALTH_INTERVAL = 10000
const CONTAINERS_INTERVAL = 10000
const UPDATE_CHECK_DELAY = 15000 // delay initial check to avoid competing with startup

export function GlobalPoller() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setSystemStatus = useSystemStore((s) => s.setStatus)
  const setHealthReport = useHealthStore((s) => s.setReport)
  const setContainers = useContainerStore((s) => s.setContainers)
  const setContainerStats = useContainerStore((s) => s.setStats)
  const setContainersLoading = useContainerStore((s) => s.setLoading)
  const autoCheckUpdates = useSettingsStore((s) => s.autoCheckUpdates)

  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const healthTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const containersTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchingContainers = useRef(false)
  const containersQueued = useRef(false)
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

  // The container list lives here so the Containers page (and the dashboard's
  // container card) open with current data instead of fetching after they
  // mount. A refresh asked for while a fetch is in flight runs right after it.
  const pollContainers = useCallback(async function poll(): Promise<void> {
    if (!mountedRef.current) return
    if (fetchingContainers.current) { containersQueued.current = true; return }
    fetchingContainers.current = true
    try {
      const data = await fetchContainers()
      if (mountedRef.current) {
        setContainers(data.containers)
        for (const c of data.containers) {
          if (c.cpu_percent != null || c.mem_percent != null) {
            setContainerStats(c.name, {
              container: c.name,
              cpu_percent: c.cpu_percent != null ? `${c.cpu_percent}%` : '--',
              memory_percent: c.mem_percent != null ? `${c.mem_percent}%` : '--',
              memory_usage: '',
              network_io: '',
              block_io: '',
              pids: '',
            })
          }
        }
      }
    } catch {
      if (mountedRef.current) setContainersLoading(false)
    } finally {
      fetchingContainers.current = false
      if (containersQueued.current && mountedRef.current) {
        containersQueued.current = false
        void poll()
      }
    }
  }, [setContainers, setContainerStats, setContainersLoading])

  // Pages ask for a fresh list through the store (after actions, on open)
  useEffect(() => {
    useContainerStore.getState().setRefresher(pollContainers)
    return () => useContainerStore.getState().setRefresher(null)
  }, [pollContainers])

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
      if (containersTimer.current) { clearInterval(containersTimer.current); containersTimer.current = null }
      if (updateTimer.current) { clearTimeout(updateTimer.current); clearInterval(updateTimer.current); updateTimer.current = null }
    }

    if (!isConnected) {
      clearTimers()
      return
    }

    // Immediate fetch on connect
    pollStatus()
    pollHealth()
    void pollContainers()

    statusTimer.current = setInterval(pollStatus, STATUS_INTERVAL)
    healthTimer.current = setInterval(pollHealth, HEALTH_INTERVAL)
    containersTimer.current = setInterval(pollContainers, CONTAINERS_INTERVAL)

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
        void pollContainers()
        statusTimer.current = setInterval(pollStatus, STATUS_INTERVAL)
        healthTimer.current = setInterval(pollHealth, HEALTH_INTERVAL)
        containersTimer.current = setInterval(pollContainers, CONTAINERS_INTERVAL)
        // Don't re-trigger update check on visibility — it's long-interval
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mountedRef.current = false
      clearTimers()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isConnected, autoCheckUpdates, pollStatus, pollHealth, pollContainers, pollUpdates])

  // Listen for Ctrl+R app-refresh events
  useEffect(() => {
    const handler = () => { pollStatus(); pollHealth(); void pollContainers() }
    window.addEventListener('app-refresh', handler)
    return () => window.removeEventListener('app-refresh', handler)
  }, [pollStatus, pollHealth, pollContainers])

  return null
}
