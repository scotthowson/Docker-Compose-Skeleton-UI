// =============================================================================
// useFleetRole — is this DCS a hub (Proxmox mode: the VMs are the stacks), a
// member, or on its own? Polled gently and shared by every page that changes
// its face for a hub: the sidebar, the VMs page, the Proxmox page.
// =============================================================================

import { usePolling } from './usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { fetchFleetStatus } from '../api/endpoints'
import type { FleetStatus } from '../../shared/types'

// the last answer, kept across pages so a page mounts in the right mode at once (no standalone flicker)
let lastStatus: FleetStatus | null = null

/** the last known fleet status without subscribing (the document title, one-off checks) */
export function fleetRoleSnapshot(): FleetStatus | null { return lastStatus }

export function useFleetRole(): { role: FleetStatus['role'] | null; isHub: boolean; isMember: boolean; status: FleetStatus | null; refresh: () => void } {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const fleet = usePolling(fetchFleetStatus, 30000, { enabled: isConnected })
  if (fleet.data) lastStatus = fleet.data
  const status = fleet.data ?? lastStatus
  const role = status?.role ?? null
  return { role, isHub: role === 'hub', isMember: role === 'member', status, refresh: fleet.refresh }
}
