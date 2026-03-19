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
  AuthLogoutResponse,
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
  ContainerExecResponse,
  TerminalExecResponse,
  TerminalHistoryResponse,
  ImageDeleteResponse,
  ContainerRenameResponse,
  StackServicesResponse,
  SystemMetricsResponse,
  TerminalAuthResponse,
  TerminalAuthVerifyResponse,
  TerminalLogoutResponse,
  ContainerFilesResponse,
  ContainerFileContentResponse,
  AlertConfigResponse,
  CrontabResponse,
  LiveLogsResponse,
  MetricsSnapshotResponse,
  MetricsTrendsResponse,
  ImageCheckResponse,
  ImageRegistryCheckResponse,
  ImageUpdateResponse,
  NotificationRule,
  NotificationRulesResponse,
  NotificationHistoryResponse,
  NotificationTestResponse,
  SnapshotListResponse,
  SnapshotCreateResponse,
  SnapshotRestoreResponse,
  ComposeHistoryResponse,
  ComposeRollbackResponse,
  TemplateListResponse,
  TemplateDetailResponse,
  TemplateDeployResponse,
  TemplateImportResponse,
  TemplateUpdateResponse,
  TemplateDeleteResponse,
  DeployHistoryResponse,
  TemplateUndeployResponse,
  TemplateDryRunResponse,
  AutomationRule,
  AutomationListResponse,
  AutomationHistoryResponse,
  TopologyResponse,
  SetupStatusResponse,
  SetupDefaultsResponse,
  SetupConfigureRequest,
  SetupConfigureResponse,
  SetupCompleteResponse,
  StackRenameResponse,
  StackReorderResponse,
  FactoryResetResponse,
  MetricsHistoryResponse,
  MetricsSummaryResponse,
  RollbackSnapshotsResponse,
  RollbackSnapshotDetail,
  RollbackRestoreResponse,
  RollbackDiffResponse,
  SecretsListResponse,
  SecretSetResponse,
  SecretDeleteResponse,
  SecretExistsResponse,
  ScheduleListResponse,
  ScheduleCreateResponse,
  Schedule,
  ScheduleHistoryResponse,
  HealthScoreResponse,
  StackHealthScore,
  HealthScoreHistoryResponse,
  PluginListResponse,
  PluginInstallResponse,
  PluginDeleteResponse,
  PluginHooksListResponse,
  PluginHookContentResponse,
  PluginHookUpdateResponse,
  PluginHookTestResponse,
  PluginLogsResponse,
  PluginConfigUpdateResponse,
  Plugin,
  ConfigSchemaResponse,
  DependencyGraphResponse,
  TemplateImportUrlResponse,
  TemplateGalleryResponse,
  StackCloneResponse,
  ImageSearchResponse,
  ComposeValidateFullResponse,
  ExportResponse,
  AuditLogResponse,
  WebhookListResponse,
  WebhookCreateResponse,
  WebhookDeleteResponse,
  WebhookTestResponse,
  ImagePullResponse,
  SessionListResponse,
  SystemUpdateCheckResponse,
  SystemUpdateApplyResponse,
  SystemUpdateRollbackResponse,
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
    `/stacks/${encodeURIComponent(name)}/update`, undefined, 120000,
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

/** POST /containers/:name/remove — Force-remove a container */
export function removeContainer(name: string): Promise<ContainerActionResponse> {
  return apiClient.post<ContainerActionResponse>(
    `/containers/${encodeURIComponent(name)}/remove`,
  )
}

/** GET /containers/:name/processes — Running processes in a container */
export function fetchContainerProcesses(name: string): Promise<ContainerProcessesResponse> {
  return apiClient.get<ContainerProcessesResponse>(
    `/containers/${encodeURIComponent(name)}/processes`,
  )
}

/** POST /containers/:name/exec — Execute a command inside a container */
export function execContainerCommand(name: string, command: string): Promise<ContainerExecResponse> {
  return apiClient.post<ContainerExecResponse>(
    `/containers/${encodeURIComponent(name)}/exec`,
    { command },
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

/** POST /auth/logout — Invalidate current session token on server */
export function authLogout(): Promise<AuthLogoutResponse> {
  return apiClient.post<AuthLogoutResponse>('/auth/logout')
}

/** POST /auth/logout-all — Invalidate all sessions for a user (admin) */
export function authLogoutAll(username: string): Promise<AuthLogoutResponse> {
  return apiClient.post<AuthLogoutResponse>('/auth/logout-all', { username })
}

/** POST /auth/refresh — Refresh current session token */
export function authRefresh(): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/refresh')
}

/** GET /auth/sessions — List active sessions (admin only) */
export function authListSessions(): Promise<SessionListResponse> {
  return apiClient.get<SessionListResponse>('/auth/sessions')
}

/** DELETE /auth/sessions/:prefix — Revoke a session by token prefix (admin only) */
export function authRevokeSession(tokenPrefix: string): Promise<{ success: boolean; revoked: number; message: string }> {
  return apiClient.delete<{ success: boolean; revoked: number; message: string }>(`/auth/sessions/${encodeURIComponent(tokenPrefix)}`)
}

/** POST /auth/factory-reset — Wipe auth state and return to setup wizard */
export function authFactoryReset(opts: { confirm: string; reset_compose?: boolean }): Promise<FactoryResetResponse> {
  return apiClient.post<FactoryResetResponse>('/auth/factory-reset', opts, 120000)
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
  return apiClient.post<MaintenanceResponse>('/maintenance/deep-prune', { confirm: 'CONFIRM' }, 120000)
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
  return apiClient.post<BatchStackResponse>('/batch/stacks', { action, stacks }, 120000)
}

/** POST /batch/update — Pull + rolling update multiple stacks */
export function batchStackUpdate(stacks: string[] | 'all'): Promise<BatchStackResponse> {
  return apiClient.post<BatchStackResponse>('/batch/update', { stacks }, 120000)
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
  return apiClient.post<BackupRestoreResponse>('/backups/restore', { filename, confirm: 'RESTORE' }, 120000)
}

// ---------------------------------------------------------------------------
// v3.1: Terminal, Image Delete, Container Rename, Stack Services, System Metrics
// ---------------------------------------------------------------------------

/** POST /terminal/exec — Execute a command on the host */
export function execTerminalCommand(command: string, cwd?: string): Promise<TerminalExecResponse> {
  return apiClient.post<TerminalExecResponse>('/terminal/exec', { command, cwd })
}

/** GET /terminal/history — Recent command audit log */
export function fetchTerminalHistory(): Promise<TerminalHistoryResponse> {
  return apiClient.get<TerminalHistoryResponse>('/terminal/history')
}

/** POST /images/:id/delete — Remove a Docker image */
export function deleteImage(id: string): Promise<ImageDeleteResponse> {
  return apiClient.post<ImageDeleteResponse>(`/images/${encodeURIComponent(id)}/delete`, undefined, 120000)
}

/** POST /containers/:name/rename — Rename a container */
export function renameContainer(name: string, newName: string): Promise<ContainerRenameResponse> {
  return apiClient.post<ContainerRenameResponse>(
    `/containers/${encodeURIComponent(name)}/rename`,
    { new_name: newName },
  )
}

/** GET /stacks/:name/services — Per-service status within a stack */
export function fetchStackServices(name: string): Promise<StackServicesResponse> {
  return apiClient.get<StackServicesResponse>(
    `/stacks/${encodeURIComponent(name)}/services`,
  )
}

/** GET /system/metrics — Lightweight CPU/memory/disk snapshot */
export function fetchSystemMetrics(): Promise<SystemMetricsResponse> {
  return apiClient.get<SystemMetricsResponse>('/system/metrics')
}

// ---------------------------------------------------------------------------
// v3.2: Terminal Auth, Container Files, Alerts, Cron, Live Logs
// ---------------------------------------------------------------------------

/** POST /terminal/auth — Authenticate with Linux credentials for terminal access */
export function terminalAuth(username: string, password: string): Promise<TerminalAuthResponse> {
  return apiClient.post<TerminalAuthResponse>('/terminal/auth', { username, password })
}

/** POST /terminal/auth/verify — Verify a terminal session token */
export function terminalAuthVerify(token: string): Promise<TerminalAuthVerifyResponse> {
  return apiClient.post<TerminalAuthVerifyResponse>('/terminal/auth/verify', { token })
}

/** POST /terminal/auth/logout — End a terminal session */
export function terminalLogout(token: string): Promise<TerminalLogoutResponse> {
  return apiClient.post<TerminalLogoutResponse>('/terminal/auth/logout', { token })
}

/** POST /terminal/exec — Execute a command (with terminal token) */
export function execTerminalCommandAuth(
  command: string,
  terminalToken: string,
  cwd?: string,
): Promise<TerminalExecResponse> {
  return apiClient.post<TerminalExecResponse>('/terminal/exec', {
    command,
    cwd,
    terminal_token: terminalToken,
  })
}

/** GET /containers/:name/files — List directory contents inside a container */
export function fetchContainerFiles(name: string, path = '/'): Promise<ContainerFilesResponse> {
  return apiClient.get<ContainerFilesResponse>(
    `/containers/${encodeURIComponent(name)}/files?path=${encodeURIComponent(path)}`,
  )
}

/** GET /containers/:name/files/content — Read file contents inside a container */
export function fetchContainerFileContent(
  name: string,
  path: string,
): Promise<ContainerFileContentResponse> {
  return apiClient.get<ContainerFileContentResponse>(
    `/containers/${encodeURIComponent(name)}/files/content?path=${encodeURIComponent(path)}`,
  )
}

/** GET /alerts/config — Read alert thresholds */
export function fetchAlertConfig(): Promise<AlertConfigResponse> {
  return apiClient.get<AlertConfigResponse>('/alerts/config')
}

/** POST /alerts/config — Update alert thresholds */
export function updateAlertConfig(thresholds: AlertConfigResponse['thresholds']): Promise<AlertConfigResponse> {
  return apiClient.post<AlertConfigResponse>('/alerts/config', { thresholds })
}

/** GET /system/crontab — User crontab entries */
export function fetchCrontab(): Promise<CrontabResponse> {
  return apiClient.get<CrontabResponse>('/system/crontab')
}

/** GET /system/crontab/system — System-level cron entries */
export function fetchSystemCrontab(): Promise<CrontabResponse> {
  return apiClient.get<CrontabResponse>('/system/crontab/system')
}

/** POST /system/crontab — Update user crontab */
export function updateCrontab(content: string): Promise<{ success: boolean; message: string }> {
  return apiClient.post('/system/crontab', { content })
}

/** GET /containers/:name/logs/live — Live log polling for a container */
export function fetchContainerLogsLive(
  name: string,
  lines = 100,
  since?: string,
): Promise<LiveLogsResponse> {
  let url = `/containers/${encodeURIComponent(name)}/logs/live?lines=${lines}`
  if (since) url += `&since=${encodeURIComponent(since)}`
  return apiClient.get<LiveLogsResponse>(url)
}

/** GET /logs/live — Live log polling for DCS application log */
export function fetchAppLogsLive(lines = 100, since?: string): Promise<LiveLogsResponse> {
  let url = `/logs/live?lines=${lines}`
  if (since) url += `&since=${encodeURIComponent(since)}`
  return apiClient.get<LiveLogsResponse>(url)
}

// ---------------------------------------------------------------------------
// v4.0: Resource Trends, Image Updates, Notifications, Snapshots,
//       Compose History, Templates, Automations, Network Topology
// ---------------------------------------------------------------------------

/** POST /metrics/snapshot — Capture and persist current metrics */
export function captureMetricsSnapshot(): Promise<MetricsSnapshotResponse> {
  return apiClient.post<MetricsSnapshotResponse>('/metrics/snapshot')
}

/** GET /metrics/trends — Query historical metrics */
export function fetchMetricsTrends(range: '1h' | '6h' | '24h' | '7d' = '1h'): Promise<MetricsTrendsResponse> {
  return apiClient.get<MetricsTrendsResponse>(`/metrics/trends?range=${range}`)
}

/** GET /images/check-updates — Quick local staleness check */
export function fetchImageUpdates(): Promise<ImageCheckResponse> {
  return apiClient.get<ImageCheckResponse>('/images/check-updates')
}

/** POST /images/check-updates — Registry check for updates (slow) */
export function checkImageRegistry(): Promise<ImageRegistryCheckResponse> {
  return apiClient.post<ImageRegistryCheckResponse>('/images/check-updates', undefined, 120000)
}

/** POST /images/:name/update — Pull image and restart containers */
export function updateImage(name: string): Promise<ImageUpdateResponse> {
  return apiClient.post<ImageUpdateResponse>(`/images/${encodeURIComponent(name)}/update`, undefined, 120000)
}

/** GET /notifications/rules — List notification rules */
export function fetchNotificationRules(): Promise<NotificationRulesResponse> {
  return apiClient.get<NotificationRulesResponse>('/notifications/rules')
}

/** POST /notifications/rules — Create/update a notification rule */
export function createNotificationRule(rule: Partial<NotificationRule>): Promise<NotificationRule> {
  return apiClient.post<NotificationRule>('/notifications/rules', rule)
}

/** DELETE /notifications/rules/:id — Delete a notification rule */
export function deleteNotificationRule(id: string): Promise<{ success: boolean; deleted: string }> {
  return apiClient.delete<{ success: boolean; deleted: string }>(`/notifications/rules/${encodeURIComponent(id)}`)
}

/** GET /notifications/history — Notification send history */
export function fetchNotificationHistory(): Promise<NotificationHistoryResponse> {
  return apiClient.get<NotificationHistoryResponse>('/notifications/history')
}

/** POST /notifications/test — Send a test notification */
export function sendTestNotification(opts?: {
  message?: string
  priority?: string
  title?: string
  tags?: string
}): Promise<NotificationTestResponse> {
  return apiClient.post<NotificationTestResponse>('/notifications/test', opts || {})
}

/** GET /snapshots — List all snapshots */
export function fetchSnapshots(): Promise<SnapshotListResponse> {
  return apiClient.get<SnapshotListResponse>('/snapshots')
}

/** POST /snapshots/create — Create a new snapshot */
export function createSnapshot(label?: string): Promise<SnapshotCreateResponse> {
  return apiClient.post<SnapshotCreateResponse>('/snapshots/create', { label: label || '' })
}

/** POST /snapshots/:id/restore — Restore from a snapshot */
export function restoreSnapshot(id: string): Promise<SnapshotRestoreResponse> {
  return apiClient.post<SnapshotRestoreResponse>(`/snapshots/${encodeURIComponent(id)}/restore`, { confirm: 'RESTORE' }, 120000)
}

/** DELETE /snapshots/:id — Delete a snapshot */
export function deleteSnapshot(id: string): Promise<{ success: boolean; deleted: string }> {
  return apiClient.delete<{ success: boolean; deleted: string }>(`/snapshots/${encodeURIComponent(id)}`)
}

/** GET /stacks/:name/compose/history — Compose version history */
export function fetchComposeHistory(name: string): Promise<ComposeHistoryResponse> {
  return apiClient.get<ComposeHistoryResponse>(`/stacks/${encodeURIComponent(name)}/compose/history`)
}

/** POST /stacks/:name/compose/rollback — Rollback compose file */
export function rollbackCompose(name: string, versionId: string): Promise<ComposeRollbackResponse> {
  return apiClient.post<ComposeRollbackResponse>(
    `/stacks/${encodeURIComponent(name)}/compose/rollback`,
    { version_id: versionId },
  )
}

/** GET /templates — List available templates */
export function fetchTemplates(): Promise<TemplateListResponse> {
  return apiClient.get<TemplateListResponse>('/templates')
}

/** GET /templates/:name — Template detail */
export function fetchTemplateDetail(name: string): Promise<TemplateDetailResponse> {
  return apiClient.get<TemplateDetailResponse>(`/templates/${encodeURIComponent(name)}`)
}

/** POST /templates/:name/deploy — Deploy (merge) a template into an existing stack */
export function deployTemplate(name: string, opts: {
  target_stack: string
  variables?: Record<string, string>
  auto_start?: boolean
  replace_services?: boolean
  exclude_services?: string[]
}): Promise<TemplateDeployResponse> {
  return apiClient.post<TemplateDeployResponse>(`/templates/${encodeURIComponent(name)}/deploy`, opts, 120000)
}

/** POST /templates/import — Import a custom template */
export function importTemplate(opts: {
  name: string
  compose: string
  metadata?: Record<string, unknown>
  env?: string
}): Promise<TemplateImportResponse> {
  return apiClient.post<TemplateImportResponse>('/templates/import', opts)
}

/** POST /templates/:name/update — Update an existing template */
export function updateTemplate(name: string, opts: {
  compose?: string
  metadata?: Record<string, unknown>
  env?: string
}): Promise<TemplateUpdateResponse> {
  return apiClient.post<TemplateUpdateResponse>(
    `/templates/${encodeURIComponent(name)}/update`,
    opts,
  )
}

/** DELETE /templates/:name — Delete a template */
export function deleteTemplate(name: string): Promise<TemplateDeleteResponse> {
  return apiClient.delete<TemplateDeleteResponse>(
    `/templates/${encodeURIComponent(name)}`,
  )
}

/** GET /templates/deploy-history — Deployment audit log */
export function fetchDeployHistory(): Promise<DeployHistoryResponse> {
  return apiClient.get<DeployHistoryResponse>('/templates/deploy-history')
}

/** POST /templates/:name/undeploy — Remove deployed services from a stack */
export function undeployTemplate(name: string, opts: {
  target_stack: string; services: string[]; remove_containers?: boolean; remove_data?: boolean
}): Promise<TemplateUndeployResponse> {
  return apiClient.post<TemplateUndeployResponse>(`/templates/${encodeURIComponent(name)}/undeploy`, opts, 120000)
}

/** POST /templates/:name/dry-run — Preview deployment without writing */
export function dryRunTemplate(name: string, opts: {
  target_stack: string; variables?: Record<string, string>; exclude_services?: string[]
}): Promise<TemplateDryRunResponse> {
  return apiClient.post<TemplateDryRunResponse>(`/templates/${encodeURIComponent(name)}/dry-run`, opts)
}

/** GET /automations — List automation rules */
export function fetchAutomations(): Promise<AutomationListResponse> {
  return apiClient.get<AutomationListResponse>('/automations')
}

/** POST /automations — Create an automation rule */
export function createAutomation(rule: {
  name: string
  trigger_type: string
  trigger_value?: string
  action_type: string
  action_target?: string
  enabled?: boolean
}): Promise<AutomationRule> {
  return apiClient.post<AutomationRule>('/automations', rule)
}

/** POST /automations/:id/update — Update an automation rule */
export function updateAutomation(id: string, updates: Partial<AutomationRule>): Promise<AutomationRule> {
  return apiClient.post<AutomationRule>(`/automations/${encodeURIComponent(id)}/update`, updates)
}

/** DELETE /automations/:id — Delete an automation rule */
export function deleteAutomation(id: string): Promise<{ success: boolean; deleted: string }> {
  return apiClient.delete<{ success: boolean; deleted: string }>(`/automations/${encodeURIComponent(id)}`)
}

/** GET /automations/:id/history — Automation run history */
export function fetchAutomationHistory(id: string): Promise<AutomationHistoryResponse> {
  return apiClient.get<AutomationHistoryResponse>(`/automations/${encodeURIComponent(id)}/history`)
}

/** GET /topology — Network topology graph data */
export function fetchTopology(): Promise<TopologyResponse> {
  return apiClient.get<TopologyResponse>('/topology')
}

// ---------------------------------------------------------------------------
// Setup Wizard
// ---------------------------------------------------------------------------

/** GET /setup/status — Check if server needs first-run setup (no auth) */
export function fetchSetupStatus(): Promise<SetupStatusResponse> {
  return apiClient.get<SetupStatusResponse>('/setup/status')
}

/** GET /setup/defaults — Get setup defaults and system info (no auth, setup mode only) */
export function fetchSetupDefaults(): Promise<SetupDefaultsResponse> {
  return apiClient.get<SetupDefaultsResponse>('/setup/defaults')
}

/** POST /setup/configure — Apply setup configuration (auth required, setup mode only) */
export function setupConfigure(data: SetupConfigureRequest): Promise<SetupConfigureResponse> {
  return apiClient.post<SetupConfigureResponse>('/setup/configure', data)
}

/** POST /setup/complete — Finalize first-run setup (auth required, setup mode only) */
export function setupComplete(): Promise<SetupCompleteResponse> {
  return apiClient.post<SetupCompleteResponse>('/setup/complete')
}

/** POST /stacks/rename — Rename a stack directory (admin only) */
export function renameStack(oldName: string, newName: string): Promise<StackRenameResponse> {
  return apiClient.post<StackRenameResponse>('/stacks/rename', { old_name: oldName, new_name: newName })
}

/** POST /stacks/reorder — Set stack startup order (admin only) */
export function reorderStacks(stacks: string[]): Promise<StackReorderResponse> {
  return apiClient.post<StackReorderResponse>('/stacks/reorder', { stacks })
}

// ---------------------------------------------------------------------------
// Metrics History
// ---------------------------------------------------------------------------

export function fetchMetricsHistory(range: string = '24h'): Promise<MetricsHistoryResponse> {
  return apiClient.get<MetricsHistoryResponse>(`/metrics/history?range=${encodeURIComponent(range)}`)
}

export function fetchMetricsSummary(range: string = '24h'): Promise<MetricsSummaryResponse> {
  return apiClient.get<MetricsSummaryResponse>(`/metrics/summary?range=${encodeURIComponent(range)}`)
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

export function fetchRollbackSnapshots(stack: string): Promise<RollbackSnapshotsResponse> {
  return apiClient.get<RollbackSnapshotsResponse>(`/rollback/${encodeURIComponent(stack)}/snapshots`)
}

export function fetchRollbackSnapshot(stack: string, id: string): Promise<RollbackSnapshotDetail> {
  return apiClient.get<RollbackSnapshotDetail>(`/rollback/${encodeURIComponent(stack)}/snapshots/${encodeURIComponent(id)}`)
}

export function restoreRollbackSnapshot(stack: string, snapshotId: string): Promise<RollbackRestoreResponse> {
  return apiClient.post<RollbackRestoreResponse>(`/rollback/${encodeURIComponent(stack)}/restore`, { snapshot_id: snapshotId }, 120000)
}

export function fetchRollbackDiff(stack: string, id: string): Promise<RollbackDiffResponse> {
  return apiClient.get<RollbackDiffResponse>(`/rollback/${encodeURIComponent(stack)}/diff/${encodeURIComponent(id)}`)
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

export function fetchSecrets(): Promise<SecretsListResponse> {
  return apiClient.get<SecretsListResponse>('/secrets')
}

export function setSecret(key: string, value: string): Promise<SecretSetResponse> {
  return apiClient.post<SecretSetResponse>(`/secrets/${encodeURIComponent(key)}`, { value })
}

export function deleteSecret(key: string): Promise<SecretDeleteResponse> {
  return apiClient.delete<SecretDeleteResponse>(`/secrets/${encodeURIComponent(key)}`)
}

export function checkSecretExists(key: string): Promise<SecretExistsResponse> {
  return apiClient.get<SecretExistsResponse>(`/secrets/${encodeURIComponent(key)}/exists`)
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export function fetchSchedules(): Promise<ScheduleListResponse> {
  return apiClient.get<ScheduleListResponse>('/schedules')
}

export function createSchedule(schedule: { name: string; schedule: string; action: string; target?: string }): Promise<ScheduleCreateResponse> {
  return apiClient.post<ScheduleCreateResponse>('/schedules', schedule)
}

export function updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
  return apiClient.post<Schedule>(`/schedules/${encodeURIComponent(id)}/update`, updates)
}

export function deleteSchedule(id: string): Promise<{ success: boolean; deleted: string }> {
  return apiClient.delete<{ success: boolean; deleted: string }>(`/schedules/${encodeURIComponent(id)}`)
}

export function toggleSchedule(id: string): Promise<Schedule> {
  return apiClient.post<Schedule>(`/schedules/${encodeURIComponent(id)}/toggle`)
}

export function fetchScheduleHistory(id: string): Promise<ScheduleHistoryResponse> {
  return apiClient.get<ScheduleHistoryResponse>(`/schedules/${encodeURIComponent(id)}/history`)
}

// ---------------------------------------------------------------------------
// Health Score
// ---------------------------------------------------------------------------

export function fetchHealthScore(): Promise<HealthScoreResponse> {
  return apiClient.get<HealthScoreResponse>('/health/score')
}

export function fetchStackHealthScore(stack: string): Promise<StackHealthScore> {
  return apiClient.get<StackHealthScore>(`/health/score/${encodeURIComponent(stack)}`)
}

export function fetchHealthScoreHistory(range: string = '24h'): Promise<HealthScoreHistoryResponse> {
  return apiClient.get<HealthScoreHistoryResponse>(`/health/score/history?range=${encodeURIComponent(range)}`)
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

export function fetchPlugins(): Promise<PluginListResponse> {
  return apiClient.get<PluginListResponse>('/plugins')
}

export function installPlugin(source: string): Promise<PluginInstallResponse> {
  return apiClient.post<PluginInstallResponse>('/plugins/install', { url: source })
}

export function scaffoldPlugin(definition: {
  name: string
  description?: string
  version?: string
  author?: string
  manifest?: Record<string, unknown>
  hooks?: Record<string, string>
}): Promise<PluginInstallResponse> {
  return apiClient.post<PluginInstallResponse>('/plugins/scaffold', definition)
}

export function removePlugin(name: string): Promise<PluginDeleteResponse> {
  return apiClient.delete<PluginDeleteResponse>(`/plugins/${encodeURIComponent(name)}`)
}

export function togglePlugin(name: string): Promise<Plugin> {
  return apiClient.post<Plugin>(`/plugins/${encodeURIComponent(name)}/toggle`)
}

/** GET /plugins/:name/hooks — List hooks with metadata */
export function fetchPluginHooks(name: string): Promise<PluginHooksListResponse> {
  return apiClient.get<PluginHooksListResponse>(`/plugins/${encodeURIComponent(name)}/hooks`)
}

/** GET /plugins/:name/hooks/:hook — Read hook script content */
export function fetchPluginHookContent(name: string, hook: string): Promise<PluginHookContentResponse> {
  return apiClient.get<PluginHookContentResponse>(`/plugins/${encodeURIComponent(name)}/hooks/${encodeURIComponent(hook)}`)
}

/** POST /plugins/:name/hooks/:hook/update — Update hook script */
export function updatePluginHook(name: string, hook: string, content: string): Promise<PluginHookUpdateResponse> {
  return apiClient.post<PluginHookUpdateResponse>(`/plugins/${encodeURIComponent(name)}/hooks/${encodeURIComponent(hook)}/update`, { content })
}

/** POST /plugins/:name/hooks/:hook/test — Dry-run a hook */
export function testPluginHook(name: string, hook: string, context?: Record<string, unknown>): Promise<PluginHookTestResponse> {
  return apiClient.post<PluginHookTestResponse>(`/plugins/${encodeURIComponent(name)}/hooks/${encodeURIComponent(hook)}/test`, { context }, 60000)
}

/** GET /plugins/:name/logs — Execution history */
export function fetchPluginLogs(name: string): Promise<PluginLogsResponse> {
  return apiClient.get<PluginLogsResponse>(`/plugins/${encodeURIComponent(name)}/logs`)
}

/** POST /plugins/:name/config — Update plugin configuration */
export function updatePluginConfig(name: string, config: Record<string, unknown>): Promise<PluginConfigUpdateResponse> {
  return apiClient.post<PluginConfigUpdateResponse>(`/plugins/${encodeURIComponent(name)}/config`, { config })
}

// ---------------------------------------------------------------------------
// Config Schema & Dependency Graph
// ---------------------------------------------------------------------------

export function fetchConfigSchema(): Promise<ConfigSchemaResponse> {
  return apiClient.get<ConfigSchemaResponse>('/config/schema')
}

export function fetchDependencyGraph(): Promise<DependencyGraphResponse> {
  return apiClient.get<DependencyGraphResponse>('/stacks/dependency-graph')
}

// ---------------------------------------------------------------------------
// v4.1: URL Import, Gallery, Clone, Image Search, Validation, Export, Audit, Webhooks
// ---------------------------------------------------------------------------

/** POST /templates/fetch-url — Fetch compose content from URL without saving */
export function fetchTemplateUrl(url: string): Promise<{ content: string; url: string }> {
  return apiClient.post<{ content: string; url: string }>('/templates/fetch-url', { url })
}

/** POST /templates/import-url — Import a template from a URL */
export function importTemplateFromUrl(url: string, name?: string): Promise<TemplateImportUrlResponse> {
  return apiClient.post<TemplateImportUrlResponse>('/templates/import-url', { url, name })
}

/** GET /templates/gallery — Browse curated template catalog */
export function fetchTemplateGallery(category?: string): Promise<TemplateGalleryResponse> {
  const params = category ? `?category=${encodeURIComponent(category)}` : ''
  return apiClient.get<TemplateGalleryResponse>(`/templates/gallery${params}`)
}

/** POST /stacks/:name/clone — Clone a stack */
export function cloneStack(name: string, newName: string): Promise<StackCloneResponse> {
  return apiClient.post<StackCloneResponse>(`/stacks/${encodeURIComponent(name)}/clone`, { new_name: newName })
}

/** GET /images/search — Search Docker Hub */
export function searchImages(query: string, limit?: number): Promise<ImageSearchResponse> {
  const params = new URLSearchParams({ q: query })
  if (limit) params.set('limit', String(limit))
  return apiClient.get<ImageSearchResponse>(`/images/search?${params}`)
}

/** POST /compose/validate — Validate compose YAML */
export function validateCompose(opts: { content?: string; stack?: string }): Promise<ComposeValidateFullResponse> {
  return apiClient.post<ComposeValidateFullResponse>('/compose/validate', opts)
}

/** GET /export/:type — Export system data */
export function exportData(type: 'health' | 'system' | 'config'): Promise<ExportResponse> {
  return apiClient.get<ExportResponse>(`/export/${type}`)
}

/** GET /audit — Fetch audit log */
export function fetchAuditLog(opts?: { limit?: number; action?: string }): Promise<AuditLogResponse> {
  const params = new URLSearchParams()
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.action) params.set('action', opts.action)
  const qs = params.toString()
  return apiClient.get<AuditLogResponse>(`/audit${qs ? `?${qs}` : ''}`)
}

/** GET /webhooks — List configured webhooks */
export function fetchWebhooks(): Promise<WebhookListResponse> {
  return apiClient.get<WebhookListResponse>('/webhooks')
}

/** POST /webhooks — Create a webhook */
export function createWebhook(config: { url: string; events?: string[]; enabled?: boolean }): Promise<WebhookCreateResponse> {
  return apiClient.post<WebhookCreateResponse>('/webhooks', config)
}

/** DELETE /webhooks/:id — Delete a webhook */
export function deleteWebhook(id: string): Promise<WebhookDeleteResponse> {
  return apiClient.delete<WebhookDeleteResponse>(`/webhooks/${encodeURIComponent(id)}`)
}

/** POST /webhooks/:id/test — Test a webhook */
export function testWebhook(id: string): Promise<WebhookTestResponse> {
  return apiClient.post<WebhookTestResponse>(`/webhooks/${encodeURIComponent(id)}/test`, {})
}

/** POST /images/pull — Pull an image from Docker Hub */
export function pullImage(image: string): Promise<ImagePullResponse> {
  return apiClient.post<ImagePullResponse>('/images/pull', { image })
}

// ---------------------------------------------------------------------------
// System Updates
// ---------------------------------------------------------------------------

/** GET /system/update/check — Check for DCS framework updates */
export function checkSystemUpdate(): Promise<SystemUpdateCheckResponse> {
  return apiClient.get<SystemUpdateCheckResponse>('/system/update/check')
}

/** POST /system/update/apply — Apply DCS framework update (git pull --ff-only) */
export function applySystemUpdate(): Promise<SystemUpdateApplyResponse> {
  return apiClient.post<SystemUpdateApplyResponse>('/system/update/apply', { confirm: 'UPDATE' }, 120000)
}

/** POST /system/update/rollback — Rollback to previous version */
export function rollbackSystemUpdate(backupTag: string): Promise<SystemUpdateRollbackResponse> {
  return apiClient.post<SystemUpdateRollbackResponse>('/system/update/rollback', { backup_tag: backupTag })
}
