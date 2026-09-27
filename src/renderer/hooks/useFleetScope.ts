// =============================================================================
// useFleetScope — one choice for every page of a hub: everywhere (the hub and
// every VM in one list), the hub alone, or one VM. Remembered in the browser
// so the Health, Images and Updates pages open on the same view.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePolling } from './usePolling'
import { useFleetRole } from './useFleetRole'
import { useConnectionStore } from '../stores/connectionStore'
import { fetchFleetMembers } from '../api/endpoints'
import type { FleetMember } from '../../shared/types'

/** 'all' | 'hub' | a member id */
export type FleetScope = string
export interface ScopeMember { id: string; name: string; vmid: number | null; reachable: boolean; version: string }

const KEY = 'dcs-fleet-scope'
let cached: FleetScope | null = null
function load(): FleetScope | null { try { return localStorage.getItem(KEY) || null } catch { return null } }
function save(s: FleetScope) { try { localStorage.setItem(KEY, s) } catch { /* storage unavailable */ } }

/** The member a scope points at (null for everywhere and the hub) */
export function scopeMember(scope: FleetScope): string | null { return scope === 'all' || scope === 'hub' ? null : scope }

export function useFleetScope() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { isHub } = useFleetRole()
  const list = usePolling(fetchFleetMembers, 30000, { enabled: isConnected && isHub })
  const members: ScopeMember[] = useMemo(
    () => (list.data?.members ?? []).map((m: FleetMember) => ({ id: m.id, name: m.name, vmid: m.vmid, reachable: m.reachable, version: m.version })),
    [list.data],
  )
  const [choice, setChoice] = useState<FleetScope | null>(() => cached ?? load())
  const setScope = useCallback((s: FleetScope) => { cached = s; save(s); setChoice(s) }, [])
  const hasFleet = isHub && members.length > 0
  // without a fleet there is only this server; with one, everywhere unless chosen otherwise
  const scope: FleetScope = hasFleet ? (choice ?? 'all') : 'hub'
  // a VM that vanished from the fleet: back to everywhere
  useEffect(() => {
    const m = choice ? scopeMember(choice) : null
    if (m && list.data && !members.some((x) => x.id === m)) setScope('all')
  }, [choice, list.data, members, setScope])
  const member = scopeMember(scope)
  const memberName = member ? (members.find((m) => m.id === member)?.name ?? member) : ''
  return { scope, setScope, member, memberName, members, hasFleet, isHub, refresh: list.refresh }
}
