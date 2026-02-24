// =============================================================================
// API Endpoints — typed wrappers for all 24 REST API routes
// =============================================================================

import { apiClient } from './client'
import type {
  APIRoot,
  APIVersion,
  ServerStatus,
  HealthReport,
  StackListResponse,
  StackDetail,
  StackContainersResponse,
  StackLogsResponse,
  StackActionResponse,
  StackUpdateResponse,
  StackCreateResponse,
  StackDeleteResponse,
  ImageListResponse,
  ContainerInfo,
  ContainerDetail,
  ContainerStats,
  ContainerActionResponse,
  ContainerLogsResponse,
  ServerConfig,
  ConfigUpdateResponse,
  SystemInfo,
  NetworkListResponse,
  NetworkDetail,
  NetworkCreateResponse,
  NetworkDeleteResponse,
  NetworkActionResponse,
  VolumeListResponse,
  VolumeDeleteResponse,
  DiskListResponse,
  LogsResponse,
  EventsResponse,
  MaintenanceResponse,
  ContainerProcessesResponse,
  StackComposeResponse,
  AuthResponse,
  AuthVerifyResponse,
  InviteResponse,
  InviteListResponse,
  UserListResponse,
  ComposeValidateResponse,
  ComposeSaveResponse,
  StackEnvResponse,
  StackEnvSaveResponse,
  MaintenanceReport,
  OrphanReport,
  DiskAnalysis,
  LogRotateResponse,
  LogStatsResponse,
  LogArchivesResponse,
  BatchStackResponse,
  RootEnvResponse,
  EnvValidateResponse,
  BackupListResponse,
  BackupStatusResponse,
  BackupConfigResponse,
  BackupTriggerResponse,
  BackupRestoreResponse,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/** GET / — API root with endpoint listing */
export function fetchApiRoot(): Promise<APIRoot> {
  return apiClient.get<APIRoot>('/')
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

/** GET /status — Server status overview */
export function fetchServerStatus(): Promise<ServerStatus> {
  return apiClient.get<ServerStatus>('/status')
}

/** GET /health — Container health report */
export function fetchHealthReport(): Promise<HealthReport> {
  return apiClient.get<HealthReport>('/health')
}

/** GET /version — API and Docker version info */
export function fetchVersion(): Promise<APIVersion> {
  return apiClient.get<APIVersion>('/version')
}

/** GET /config — Server configuration */
export function fetchConfig(): Promise<ServerConfig> {
  return apiClient.get<ServerConfig>('/config')
}

/** POST /config — Update server configuration */
export function updateConfig(updates: Record<string, string | boolean | number>): Promise<ConfigUpdateResponse> {
  return apiClient.post<ConfigUpdateResponse>('/config', updates)
}

/** GET /system — System information */
export function fetchSystemInfo(): Promise<SystemInfo> {
  return apiClient.get<SystemInfo>('/system')
}

// ---------------------------------------------------------------------------
// Stacks
// ---------------------------------------------------------------------------

/** GET /stacks — List all stacks */
export function fetchStacks(): Promise<StackListResponse> {
  return apiClient.get<StackListResponse>('/stacks')
}

/** GET /stacks/:name — Stack detail */
export function fetchStack(name: string): Promise<StackDetail> {
  return apiClient.get<StackDetail>(`/stacks/${encodeURIComponent(name)}`)
}

/** GET /stacks/:name/containers — Containers in a stack */
export function fetchStackContainers(name: string): Promise<StackContainersResponse> {
  return apiClient.get<StackContainersResponse>(
    `/stacks/${encodeURIComponent(name)}/containers`,
  )
}

/** GET /stacks/:name/logs — Stack logs */
export function fetchStackLogs(name: string): Promise<StackLogsResponse> {
  return apiClient.get<StackLogsResponse>(
    `/stacks/${encodeURIComponent(name)}/logs`,
  )
}

/** POST /stacks/:name/start — Start a stack */
export function startStack(name: string): Promise<StackActionResponse> {
  return apiClient.post<StackActionResponse>(
    `/stacks/${encodeURIComponent(name)}/start`,
  )
}

/** POST /stacks/:name/stop — Stop a stack */
export function stopStack(name: string): Promise<StackActionResponse> {
  return apiClient.post<StackActionResponse>(
    `/stacks/${encodeURIComponent(name)}/stop`,
  )
}

/** POST /stacks/:name/restart — Restart a stack */
export function restartStack(name: string): Promise<StackActionResponse> {
  return apiClient.post<StackActionResponse>(
    `/stacks/${encodeURIComponent(name)}/restart`,
  )
}

/** POST /stacks/:name/update — Pull and rolling-update a stack */
export function updateStack(name: string): Promise<StackUpdateResponse> {
  return apiClient.post<StackUpdateResponse>(
    `/stacks/${encodeURIComponent(name)}/update`,
  )
}

/** POST /stacks — Create a new stack */
export function createStack(name: string): Promise<StackCreateResponse> {
  return apiClient.post<StackCreateResponse>('/stacks', { name })
}

/** POST /stacks/:name/delete — Delete a stack */
export function deleteStack(name: string): Promise<StackDeleteResponse> {
  return apiClient.post<StackDeleteResponse>(
    `/stacks/${encodeURIComponent(name)}/delete`,
  )
}

/** GET /stacks/:name/compose — Fetch raw docker-compose.yml content */
export function fetchStackCompose(name: string): Promise<StackComposeResponse> {
  return apiClient.get<StackComposeResponse>(
    `/stacks/${encodeURIComponent(name)}/compose`,
  )
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** GET /images — All images */
export function fetchImages(): Promise<ImageListResponse> {
  return apiClient.get<ImageListResponse>('/images')
}

/** GET /images/stale — Stale images only */
export function fetchStaleImages(): Promise<ImageListResponse> {
  return apiClient.get<ImageListResponse>('/images/stale')
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

export interface ContainerListResponse {
  total: number
  containers: ContainerInfo[]
}

/** GET /containers — All containers */
export function fetchContainers(): Promise<ContainerListResponse> {
  return apiClient.get<ContainerListResponse>('/containers')
}

/** GET /containers/:name — Container detail */
export function fetchContainer(name: string): Promise<ContainerDetail> {
  return apiClient.get<ContainerDetail>(
    `/containers/${encodeURIComponent(name)}`,
  )
}

/** GET /containers/:name/stats — Container resource stats */
export function fetchContainerStats(name: string): Promise<ContainerStats> {
  return apiClient.get<ContainerStats>(
    `/containers/${encodeURIComponent(name)}/stats`,
  )
}

/** GET /containers/:name/logs — Container logs */
export function fetchContainerLogs(name: string): Promise<ContainerLogsResponse> {
  return apiClient.get<ContainerLogsResponse>(
    `/containers/${encodeURIComponent(name)}/logs`,
  )
}

/** POST /containers/:name/start — Start a container */
export function startContainer(name: string): Promise<ContainerActionResponse> {
  return apiClient.post<ContainerActionResponse>(
    `/containers/${encodeURIComponent(name)}/start`,
  )
}

/** POST /containers/:name/stop — Stop a container */
export function stopContainer(name: string): Promise<ContainerActionResponse> {
  return apiClient.post<ContainerActionResponse>(
    `/containers/${encodeURIComponent(name)}/stop`,
  )
}

/** POST /containers/:name/restart — Restart a container */
export function restartContainer(name: string): Promise<ContainerActionResponse> {
  return apiClient.post<ContainerActionResponse>(
    `/containers/${encodeURIComponent(name)}/restart`,
  )
}

/** GET /containers/:name/processes — Running processes in a container */
export function fetchContainerProcesses(name: string): Promise<ContainerProcessesResponse> {
  return apiClient.get<ContainerProcessesResponse>(
    `/containers/${encodeURIComponent(name)}/processes`,
  )
}

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

/** GET /networks — Docker networks */
export function fetchNetworks(): Promise<NetworkListResponse> {
  return apiClient.get<NetworkListResponse>('/networks')
}

/** GET /networks/:name — Network detail with containers and IPAM */
export function fetchNetworkDetail(name: string): Promise<NetworkDetail> {
  return apiClient.get<NetworkDetail>(`/networks/${encodeURIComponent(name)}`)
}

/** POST /networks — Create a new Docker network */
export function createNetwork(opts: {
  name: string
  driver?: string
  subnet?: string
  gateway?: string
  internal?: boolean
}): Promise<NetworkCreateResponse> {
  return apiClient.post<NetworkCreateResponse>('/networks', opts)
}

/** POST /networks/:name/delete — Remove a Docker network */
export function deleteNetwork(name: string): Promise<NetworkDeleteResponse> {
  return apiClient.post<NetworkDeleteResponse>(
    `/networks/${encodeURIComponent(name)}/delete`,
  )
}

/** POST /networks/:name/connect — Connect a container to a network */
export function connectToNetwork(
  networkName: string,
  containerName: string,
): Promise<NetworkActionResponse> {
  return apiClient.post<NetworkActionResponse>(
    `/networks/${encodeURIComponent(networkName)}/connect`,
    { container: containerName },
  )
}

/** POST /networks/:name/disconnect — Disconnect a container from a network */
export function disconnectFromNetwork(
  networkName: string,
  containerName: string,
): Promise<NetworkActionResponse> {
  return apiClient.post<NetworkActionResponse>(
    `/networks/${encodeURIComponent(networkName)}/disconnect`,
    { container: containerName },
  )
}

/** GET /volumes — Docker volumes */
export function fetchVolumes(): Promise<VolumeListResponse> {
  return apiClient.get<VolumeListResponse>('/volumes')
}

/** POST /volumes/:name/delete — Remove a Docker volume */
export function deleteVolume(name: string): Promise<VolumeDeleteResponse> {
  return apiClient.post<VolumeDeleteResponse>(
    `/volumes/${encodeURIComponent(name)}/delete`,
  )
}

/** GET /disks — Mounted filesystems */
export function fetchDisks(): Promise<DiskListResponse> {
  return apiClient.get<DiskListResponse>('/disks')
}

// ---------------------------------------------------------------------------
// Logs & Events
// ---------------------------------------------------------------------------

/** GET /logs — Application logs */
export function fetchLogs(): Promise<LogsResponse> {
  return apiClient.get<LogsResponse>('/logs')
}

/** GET /events — Docker events */
export function fetchEvents(): Promise<EventsResponse> {
  return apiClient.get<EventsResponse>('/events')
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/** POST /maintenance/prune — Docker system prune */
export function runDockerPrune(): Promise<MaintenanceResponse> {
  return apiClient.post<MaintenanceResponse>('/maintenance/prune')
}

/** POST /maintenance/image-prune — Docker image prune */
export function runImagePrune(): Promise<MaintenanceResponse> {
  return apiClient.post<MaintenanceResponse>('/maintenance/image-prune')
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/** POST /auth/setup — Initial admin account setup */
export function authSetup(username: string, password: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/setup', { username, password })
}

/** POST /auth/login — Authenticate and receive token */
export function authLogin(username: string, password: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/login', { username, password })
}

/** POST /auth/register — Register with invite code */
export function authRegister(username: string, password: string, invite_code: string): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/register', { username, password, invite_code })
}

/** GET /auth/verify — Verify current token validity */
export function authVerify(): Promise<AuthVerifyResponse> {
  return apiClient.get<AuthVerifyResponse>('/auth/verify')
}

/** POST /auth/invite — Create an invite code */
export function authCreateInvite(role?: string): Promise<InviteResponse> {
  return apiClient.post<InviteResponse>('/auth/invite', { role: role || 'user' })
}

/** GET /auth/users — List all registered users */
export function authListUsers(): Promise<UserListResponse> {
  return apiClient.get<UserListResponse>('/auth/users')
}

/** GET /auth/invites — List all invite codes */
export function authListInvites(): Promise<InviteListResponse> {
  return apiClient.get<InviteListResponse>('/auth/invites')
}

/** POST /auth/revoke — Revoke a user's access */
export function authRevokeUser(username: string): Promise<{ success: boolean; message: string }> {
  return apiClient.post<{ success: boolean; message: string }>('/auth/revoke', { username })
}

// ---------------------------------------------------------------------------
// Phase 1: Compose Editor & Stack Env
// ---------------------------------------------------------------------------

/** POST /stacks/:name/compose/validate — Validate compose YAML */
export function validateStackCompose(name: string, content: string): Promise<ComposeValidateResponse> {
  return apiClient.post<ComposeValidateResponse>(
    `/stacks/${encodeURIComponent(name)}/compose/validate`,
    { content },
  )
}

/** POST /stacks/:name/compose — Save compose file */
export function saveStackCompose(name: string, content: string): Promise<ComposeSaveResponse> {
  return apiClient.post<ComposeSaveResponse>(
    `/stacks/${encodeURIComponent(name)}/compose`,
    { content },
  )
}

/** GET /stacks/:name/env — Read stack .env */
export function fetchStackEnv(name: string): Promise<StackEnvResponse> {
  return apiClient.get<StackEnvResponse>(
    `/stacks/${encodeURIComponent(name)}/env`,
  )
}

/** POST /stacks/:name/env — Save stack .env */
export function saveStackEnv(name: string, content: string): Promise<StackEnvSaveResponse> {
  return apiClient.post<StackEnvSaveResponse>(
    `/stacks/${encodeURIComponent(name)}/env`,
    { content },
  )
}

// ---------------------------------------------------------------------------
// Phase 2: Advanced Maintenance
// ---------------------------------------------------------------------------

/** GET /maintenance/report — Full system report */
export function fetchMaintenanceReport(): Promise<MaintenanceReport> {
  return apiClient.get<MaintenanceReport>('/maintenance/report')
}

/** GET /maintenance/orphans — Orphaned resources */
export function fetchMaintenanceOrphans(): Promise<OrphanReport> {
  return apiClient.get<OrphanReport>('/maintenance/orphans')
}

/** GET /maintenance/disk — Disk analysis */
export function fetchMaintenanceDisk(): Promise<DiskAnalysis> {
  return apiClient.get<DiskAnalysis>('/maintenance/disk')
}

/** POST /maintenance/deep-prune — Aggressive docker prune */
export function triggerDeepPrune(): Promise<MaintenanceResponse> {
  return apiClient.post<MaintenanceResponse>('/maintenance/deep-prune', { confirm: 'CONFIRM' })
}

/** POST /maintenance/log-rotate — Rotate logs */
export function triggerLogRotate(): Promise<LogRotateResponse> {
  return apiClient.post<LogRotateResponse>('/maintenance/log-rotate')
}

// ---------------------------------------------------------------------------
// Phase 3: Enhanced Log Viewer
// ---------------------------------------------------------------------------

/** GET /logs — Application logs (with optional server-side filtering) */
export function fetchLogsFiltered(params?: {
  level?: string
  search?: string
  lines?: number
}): Promise<LogsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.level) searchParams.set('level', params.level)
  if (params?.search) searchParams.set('search', params.search)
  if (params?.lines) searchParams.set('lines', String(params.lines))
  const qs = searchParams.toString()
  return apiClient.get<LogsResponse>(qs ? `/logs?${qs}` : '/logs')
}

/** GET /logs/stats — Log statistics */
export function fetchLogStats(): Promise<LogStatsResponse> {
  return apiClient.get<LogStatsResponse>('/logs/stats')
}

/** GET /logs/archives — Archived log files */
export function fetchLogArchives(): Promise<LogArchivesResponse> {
  return apiClient.get<LogArchivesResponse>('/logs/archives')
}

// ---------------------------------------------------------------------------
// Phase 4: Batch Operations
// ---------------------------------------------------------------------------

/** POST /batch/stacks — Start/stop/restart multiple stacks */
export function batchStackAction(
  action: 'start' | 'stop' | 'restart',
  stacks: string[] | 'all',
): Promise<BatchStackResponse> {
  return apiClient.post<BatchStackResponse>('/batch/stacks', { action, stacks })
}

/** POST /batch/update — Pull + rolling update multiple stacks */
export function batchStackUpdate(stacks: string[] | 'all'): Promise<BatchStackResponse> {
  return apiClient.post<BatchStackResponse>('/batch/update', { stacks })
}

// ---------------------------------------------------------------------------
// Phase 5: Environment Variable Manager
// ---------------------------------------------------------------------------

/** GET /env — Root .env as raw + parsed */
export function fetchRootEnv(): Promise<RootEnvResponse> {
  return apiClient.get<RootEnvResponse>('/env')
}

/** POST /env — Save root .env */
export function saveRootEnv(content: string): Promise<{ success: boolean; message: string }> {
  return apiClient.post<{ success: boolean; message: string }>('/env', { content })
}

/** POST /env/validate — Validate .env content */
export function validateEnv(content: string): Promise<EnvValidateResponse> {
  return apiClient.post<EnvValidateResponse>('/env/validate', { content })
}

// ---------------------------------------------------------------------------
// Phase 6: Backup & Restore
// ---------------------------------------------------------------------------

/** GET /backups — List backup archives */
export function fetchBackups(): Promise<BackupListResponse> {
  return apiClient.get<BackupListResponse>('/backups')
}

/** GET /backups/status — Current backup status */
export function fetchBackupStatus(): Promise<BackupStatusResponse> {
  return apiClient.get<BackupStatusResponse>('/backups/status')
}

/** GET /backups/config — Backup configuration */
export function fetchBackupConfig(): Promise<BackupConfigResponse> {
  return apiClient.get<BackupConfigResponse>('/backups/config')
}

/** POST /backups/trigger — Start a backup */
export function triggerBackup(stack?: string): Promise<BackupTriggerResponse> {
  return apiClient.post<BackupTriggerResponse>('/backups/trigger', stack ? { stack } : {})
}

/** POST /backups/restore — Restore from archive */
export function restoreBackup(filename: string): Promise<BackupRestoreResponse> {
  return apiClient.post<BackupRestoreResponse>('/backups/restore', { filename, confirm: 'RESTORE' })
}
