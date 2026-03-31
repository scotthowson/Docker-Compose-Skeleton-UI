// =============================================================================
// Containers — Container management page
// =============================================================================

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useContainerStore } from '../stores/containerStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useAuthStore } from '../stores/authStore'
import { useApi } from '../hooks/useApi'
import { fetchContainers } from '../api/endpoints'
import { Box, RefreshCw, Loader2 } from 'lucide-react'
import ContainerList from '../components/containers/ContainerList'
import ContainerDetail from '../components/containers/ContainerDetail'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

const CONTAINER_POLL_INTERVAL = 10_000

const Containers: React.FC = () => {
  const setContainers = useContainerStore((s) => s.setContainers)
  const setLoading = useContainerStore((s) => s.setLoading)
  const loading = useContainerStore((s) => s.loading)
  const containers = useContainerStore((s) => s.containers)
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'

  const [selectedName, setSelectedName] = useState<string | null>(null)
  const navigationPayload = useSettingsStore((s) => s.navigationPayload)
  const pendingFocusRef = useRef<string | null>(null)

  const setStats = useContainerStore((s) => s.setStats)

  // Fetch containers via the connection-aware polling hook
  const handleFetch = useCallback(async () => {
    setLoading(true)
    const result = await fetchContainers()
    setContainers(result.containers)
    // Populate stats store from bulk cpu_percent/mem_percent in the response
    for (const c of result.containers) {
      if (c.cpu_percent != null || c.mem_percent != null) {
        setStats(c.name, {
          cpu_percent: c.cpu_percent != null ? `${c.cpu_percent}%` : '--',
          memory_percent: c.mem_percent != null ? `${c.mem_percent}%` : '--',
          memory_usage: '',
          network_io: '',
          block_io: '',
          pids: '',
        })
      }
    }
    setLoading(false)
    return result
  }, [setContainers, setLoading, setStats])

  const { refresh } = useApi(handleFetch, CONTAINER_POLL_INTERVAL, {
    enabled: isConnected,
  })

  // React to navigation payloads: resetView (sidebar re-click) or focusContainer (from Stacks)
  useEffect(() => {
    if (!navigationPayload) return
    const payload = useSettingsStore.getState().navigationPayload
    if (!payload) return

    if (payload.focusContainer || payload.resetView) {
      useSettingsStore.getState().consumeNavigationPayload()
      if (payload.resetView) {
        setSelectedName(null)
        pendingFocusRef.current = null
      } else if (payload.focusContainer && typeof payload.focusContainer === 'string') {
        setSelectedName(payload.focusContainer)
        pendingFocusRef.current = payload.focusContainer
        refresh()
      }
    }
  }, [navigationPayload, refresh])

  // Find the currently selected container info
  const selectedContainer = useMemo(
    () => containers.find((c) => c.name === selectedName || c.name.toLowerCase() === selectedName?.toLowerCase()) ?? null,
    [containers, selectedName],
  )

  // Retry counter for pending focus
  const retryCountRef = useRef(0)

  // When a name is selected but the container vanishes from the list, deselect.
  // If we're waiting for a just-deployed container, keep retrying.
  useEffect(() => {
    // Container found — clear pending state
    if (selectedContainer && pendingFocusRef.current) {
      pendingFocusRef.current = null
      retryCountRef.current = 0
      return
    }

    if (selectedName && !selectedContainer && containers.length > 0) {
      if (pendingFocusRef.current) {
        // Still waiting — retry every 2 seconds, give up after 10 tries (20s)
        if (retryCountRef.current >= 10) {
          pendingFocusRef.current = null
          retryCountRef.current = 0
          setSelectedName(null)
          return
        }
        const timer = setTimeout(() => {
          retryCountRef.current++
          refresh()
        }, 2000)
        return () => clearTimeout(timer)
      } else {
        setSelectedName(null)
      }
    }
  }, [selectedName, selectedContainer, containers, refresh])

  const handleSelect = useCallback((name: string) => {
    setSelectedName(name)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedName(null)
  }, [])

  // Escape key returns to container list from detail view
  useEffect(() => {
    if (!selectedName) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return
      // Check if a VISIBLE modal overlay is open (ignore hidden drawers with pointer-events-none)
      const hasVisibleOverlay = Array.from(document.querySelectorAll('.fixed.inset-0')).some(
        (el) => {
          const style = window.getComputedStyle(el)
          return style.pointerEvents !== 'none' && style.opacity !== '0' && style.display !== 'none'
        },
      )
      if (hasVisibleOverlay) return
      e.preventDefault()
      setSelectedName(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedName])

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-4 md:p-6 animate-fade-in">
      <DisconnectedBanner />
      {selectedName && selectedContainer ? (
        <ErrorBoundary key={selectedName} fallbackMessage="Failed to render container details">
          <ContainerDetail
            containerName={selectedContainer.name}
            containerInfo={selectedContainer}
            onBack={handleBack}
            onRefreshList={refresh}
            isAdmin={isAdmin}
          />
        </ErrorBoundary>
      ) : selectedName && !selectedContainer && pendingFocusRef.current ? (
        /* Waiting for just-deployed container to appear */
        <div className="flex flex-col items-center justify-center py-24 gap-4 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Loader2 size={28} className="text-cyan-400 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-200">Loading {selectedName}</p>
            <p className="text-xs text-slate-400 mt-1">Container is starting up — this may take a moment</p>
          </div>
        </div>
      ) : (
        <ContainerList
          selectedName={selectedName}
          onSelect={handleSelect}
          isAdmin={isAdmin}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}

export default Containers
