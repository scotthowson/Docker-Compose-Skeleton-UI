// =============================================================================
// Containers — Container management page
// =============================================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useContainerStore } from '../stores/containerStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useAuthStore } from '../stores/authStore'
import { useApi } from '../hooks/useApi'
import { fetchContainers } from '../api/endpoints'
import ContainerList from '../components/containers/ContainerList'
import ContainerDetail from '../components/containers/ContainerDetail'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

const CONTAINER_POLL_INTERVAL = 10_000

const Containers: React.FC = () => {
  const setContainers = useContainerStore((s) => s.setContainers)
  const setLoading = useContainerStore((s) => s.setLoading)
  const containers = useContainerStore((s) => s.containers)
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'

  const [selectedName, setSelectedName] = useState<string | null>(null)
  const navigationPayload = useSettingsStore((s) => s.navigationPayload)

  // React to navigation payloads: resetView (sidebar re-click) or focusContainer (from Stacks)
  // Only consume if the payload has keys relevant to THIS page
  useEffect(() => {
    if (!navigationPayload) return
    const payload = useSettingsStore.getState().navigationPayload
    if (!payload) return

    if (payload.focusContainer || payload.resetView) {
      useSettingsStore.getState().consumeNavigationPayload()
      if (payload.resetView) {
        setSelectedName(null)
      } else if (payload.focusContainer && typeof payload.focusContainer === 'string') {
        setSelectedName(payload.focusContainer)
      }
    }
  }, [navigationPayload])

  // Fetch containers via the connection-aware polling hook
  const handleFetch = useCallback(async () => {
    setLoading(true)
    const result = await fetchContainers()
    setContainers(result.containers)
    setLoading(false)
    return result
  }, [setContainers, setLoading])

  const { refresh } = useApi(handleFetch, CONTAINER_POLL_INTERVAL, {
    enabled: isConnected,
  })

  // Find the currently selected container info
  const selectedContainer = useMemo(
    () => containers.find((c) => c.name === selectedName) ?? null,
    [containers, selectedName],
  )

  // When a name is selected but the container vanishes from the list, deselect.
  // Only deselect AFTER containers have loaded (not during initial load when list is empty).
  useEffect(() => {
    if (selectedName && !selectedContainer && containers.length > 0) {
      setSelectedName(null)
    }
  }, [selectedName, selectedContainer, containers.length])

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
            containerName={selectedName}
            containerInfo={selectedContainer}
            onBack={handleBack}
            onRefreshList={refresh}
            isAdmin={isAdmin}
          />
        </ErrorBoundary>
      ) : (
        <ContainerList
          selectedName={selectedName}
          onSelect={handleSelect}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}

export default Containers
