// =============================================================================
// Containers — Container management page
// =============================================================================

import React, { useState, useCallback, useMemo } from 'react'
import { useContainerStore } from '../stores/containerStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useApi } from '../hooks/useApi'
import { fetchContainers } from '../api/endpoints'
import ContainerList from '../components/containers/ContainerList'
import ContainerDetail from '../components/containers/ContainerDetail'
import { ErrorBoundary } from '../components/common/ErrorBoundary'

const CONTAINER_POLL_INTERVAL = 10_000

const Containers: React.FC = () => {
  const setContainers = useContainerStore((s) => s.setContainers)
  const setLoading = useContainerStore((s) => s.setLoading)
  const containers = useContainerStore((s) => s.containers)
  const isConnected = useConnectionStore((s) => s.status === 'connected')

  const [selectedName, setSelectedName] = useState<string | null>(null)

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

  // When a name is selected but the container vanishes from the list, deselect
  if (selectedName && !selectedContainer) {
    // Use a microtask to avoid setState-during-render warnings
    queueMicrotask(() => setSelectedName(null))
  }

  const handleSelect = useCallback((name: string) => {
    setSelectedName(name)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedName(null)
  }, [])

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
      {selectedName && selectedContainer ? (
        <ErrorBoundary key={selectedName} fallbackMessage="Failed to render container details">
          <ContainerDetail
            containerName={selectedName}
            containerInfo={selectedContainer}
            onBack={handleBack}
            onRefreshList={refresh}
          />
        </ErrorBoundary>
      ) : (
        <ContainerList
          selectedName={selectedName}
          onSelect={handleSelect}
        />
      )}
    </div>
  )
}

export default Containers
