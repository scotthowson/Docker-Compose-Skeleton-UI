// =============================================================================
// Types the fleet-scoped pages share (Containers, Logs, Uptime, Topology):
// what a hub answers when a list is asked for the whole fleet (?fleet=1), and
// where a row lives.
// =============================================================================

import type { ContainerInfo } from './types'

/**
 * GET /containers: on a hub the list carries its own rows (untagged) plus every
 * VM's (member = its id, with member_name and vmid); on a VM, through the hub's
 * proxy, that VM's own rows, untagged.
 */
export interface FleetContainerListResponse {
  total: number
  containers: ContainerInfo[]
}

/** Where a row lives: null or undefined = the hub (this server), otherwise a member id */
export type RowMember = string | null | undefined

/** The VM a scope points at, as the pages tag rows with it */
export interface ScopeMemberTag {
  id: string
  name: string
  vmid: number | null
}
