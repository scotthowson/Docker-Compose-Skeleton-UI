// =============================================================================
// Fleet-scoped operations — the shapes the Backup, File Browser, Environment,
// System and Maintenance pages need when a hub manages VMs: rows tagged with
// the DCS they belong to, and the outcome of one action run on many servers.
// =============================================================================

import type {
  BackupEntry,
  BackupListResponse,
  FleetListMember,
  MaintenanceReport,
  OrphanReport,
  DiskAnalysis,
} from './types'

/** one DCS an action or a query is addressed to: the hub (id null) or a VM */
export interface FleetTarget {
  id: string | null
  name: string
  vmid: number | null
}

/** what one server answered when the same call went to several */
export interface MemberOutcome<T> extends FleetTarget {
  ok: boolean
  value?: T
  error?: string
}

/** a row of a merged list with the DCS it came from (null = the hub) */
export type Placed<T> = T & { member: string | null; member_name: string; vmid: number | null }

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------

/** GET /backups?fleet=1 tags every row; a single server's rows carry no member */
export interface FleetBackupEntry extends BackupEntry {
  member?: string | null
  member_name?: string
  vmid?: number | null
}

export interface FleetBackupListResponse extends BackupListResponse {
  backups: FleetBackupEntry[]
  fleet?: boolean
  members?: FleetListMember[]
}

/** a stack the backup drop-down can name, with the DCS it lives on */
export interface BackupStackChoice {
  name: string
  member: string | null
  member_name: string
  vmid: number | null
  reachable: boolean
}

// ---------------------------------------------------------------------------
// Maintenance on Everywhere
// ---------------------------------------------------------------------------

/** the hub's and every VM's report added up; members says who answered */
export interface FleetMaintenanceReport {
  totals: MaintenanceReport
  members: MemberOutcome<MaintenanceReport>[]
}

export interface FleetOrphanReport {
  containers: Placed<OrphanReport['containers'][number]>[]
  images: Placed<OrphanReport['images'][number]>[]
  volumes: Placed<OrphanReport['volumes'][number]>[]
  members: MemberOutcome<OrphanReport>[]
}

export interface FleetDiskAnalysis {
  stack_sizes: Placed<DiskAnalysis['stack_sizes'][number]>[]
  docker_df: Placed<DiskAnalysis['docker_df'][number]>[]
  total_app_data: string
  members: MemberOutcome<DiskAnalysis>[]
}
