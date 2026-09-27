// =============================================================================
// useStackCounts — how many stacks run, for the chosen fleet scope: everywhere
// (the hub's /stacks already carries every VM's, tagged), the hub alone, or one
// VM. The Health page and the dashboard cards read the same numbers.
// =============================================================================

import { useMemo } from 'react'
import { usePolling } from './usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { fetchStacks } from '../api/endpoints'
import { scopeMember, type FleetScope } from './useFleetScope'

export function useStackCounts(scope: FleetScope): { total: number; running: number; loaded: boolean } {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { data } = usePolling(fetchStacks, 30000, { enabled: isConnected })
  return useMemo(() => {
    const all = data?.stacks ?? []
    const member = scopeMember(scope)
    const mine = scope === 'all' ? all : scope === 'hub' ? all.filter((st) => st.placement !== 'vm') : all.filter((st) => st.member === member)
    return { total: mine.length, running: mine.filter((st) => st.status === 'running').length, loaded: !!data }
  }, [data, scope])
}
