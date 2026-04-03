// =============================================================================
// Docker Compose Skeleton API — TypeScript Interfaces
// Maps to all 24 REST API endpoint response shapes
// =============================================================================

// Electron IPC bridge
export interface ElectronAPI {
  getSettings: () => Promise<Record<string, unknown>>
  getSetting: (key: string) => Promise<unknown>
  setSetting: (key: string, value: unknown) => Promise<boolean>
  getVersion: () => Promise<string>
  /** Combined server check: connectivity + setup status in one call (Node.js http, no CORS) */
  checkServer: (serverUrl: string) => Promise<{ reachable: boolean; initialized: boolean; error?: string }>
  /** Generic JSON fetch via Node.js http (bypasses all browser security) */
  netFetchJson: (url: string) => Promise<{ ok: boolean; status: number; data: unknown; error?: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

// GET /version
export interface APIVersion {
  api_version: string
  framework_version: string
  docker_version: string
  compose_version: string
  compose_command: string
}

// GET /status
export interface ServerStatus {
  timestamp: string
  hostname: string
  uptime_seconds: number
  docker: {
    containers: {
      total: number
      running: number
      stopped: number
    }
    images: number
    volumes: number
    networks: number
  }
  stacks: {
    total: number
    running: number
  }
  system: {
    load_average: [number, number, number]
    memory_mb: {
      total: number
      available: number
    }
    disk: {
      total: string
      used: string
      available: string
      percent: string
    }
    cpu_count: number
  }
}

// GET /health
export interface HealthReport {
  status: 'healthy' | 'degraded' | 'critical'
  summary: {
    total: number
    healthy: number
    unhealthy: number
    stopped: number
  }
  containers: HealthContainer[]
  api?: ApiHealthMetrics
}

export interface HealthContainer {
  name: string
  state: string
  health: string
}

// GET /stacks
export interface StackListResponse {
  total: number
  stacks: StackInfo[]
}

export interface StackInfo {
  name: string
  status: 'running' | 'stopped'
  running_containers: number
  has_env: boolean
  compose_file: string
}

// GET /stacks/:name
export interface StackDetail {
  name: string
  status: 'running' | 'stopped'
  running_containers: number
  has_env: boolean
  services: string[]
  containers: ContainerInfo[]
  images: StackImage[]
}

export interface StackImage {
  name: string
  id: string
  size: number
}

// GET /stacks/:name/containers
export interface StackContainersResponse {
  stack: string
  containers: ContainerInfo[]
}

// GET /stacks/:name/logs
export interface StackLogsResponse {
  stack: string
  lines: number
  logs: string
}

// POST /stacks/:name/(start|stop|restart)
export interface StackActionResponse {
  stack: string
  action: string
  success: boolean
  output: string
}

// POST /stacks/:name/update
export interface StackUpdateResponse {
  stack: string
  action: 'update'
  success: boolean
  changes_detected: boolean
  changed_images: string[]
  output: string
}

// GET /containers, /stacks/:name/containers
export interface ContainerInfo {
  name: string
  state: string
  health: string
  image: string
  image_id: string
  created: string
  uptime_seconds: number
  ports: string
  restart_count: number
  cpu_percent?: number | null
  mem_percent?: number | null
}

// GET /containers/:name
export interface ContainerDetail extends ContainerInfo {
  environment: string
  mounts: string
  networks: string
  ip_addresses?: string
  platform?: string
  hostname?: string
  working_dir?: string
  restart_policy?: string
}

// POST /containers/:name/(start|stop|restart)
export interface ContainerActionResponse {
  container: string
  action: string
  success: boolean
  output: string
}

// GET /containers/:name/logs
export interface ContainerLogsResponse {
  container: string
  lines: number
  logs: string
}

// POST /maintenance/prune, /maintenance/image-prune
export interface MaintenanceResponse {
  action: string
  success: boolean
  output: string
}

// GET /containers/:name/stats
export interface ContainerStats {
  container: string
  cpu_percent: string
  memory_usage: string
  memory_percent: string
  network_io: string
  block_io: string
  pids: string
}

// GET /images
export interface ImageListResponse {
  total: number
  images: ImageInfo[]
}

export interface ImageInfo {
  repository: string
  tag: string
  id: string
  created: string
  size: string
  age_days: number
  staleness: 'current' | 'aging' | 'stale' | 'unknown'
  update_available?: boolean | null
}

// GET /config
export interface ServerConfig {
  environment: string
  log_level: string
  compose_dir: string
  app_data_dir: string
  base_dir: string
  compose_command: string
  skip_healthcheck_wait: boolean
  continue_on_failure: boolean
  remove_volumes_on_stop: boolean
  aggressive_image_prune: boolean
  update_notification: boolean
  show_banners: boolean
  api_port: number
  api_bind: string
  ntfy_configured: boolean
  ntfy_url: string
  ntfy_topic: string
  ntfy_priority: string
  notification_stacks: string
  enable_colors: boolean
  color_mode: string
  color_theme: string
  force_color: boolean
  verbose_mode: boolean
  show_system_info: boolean
  progress_bar_width: number
  enable_log_date: boolean
  enable_milliseconds: boolean
  log_date_format: string
  enable_log_mood: boolean
  enable_log_pid: boolean
  enable_log_hostname: boolean
  api_enabled: boolean
  server_name: string
  server_subtitle: string
  timezone: string
  proxy_domain: string
  puid: number
  pgid: number
  // Traefik/DNS
  traefik_domain: string
  traefik_acme_email: string
  cf_dns_api_token_set: boolean
  ddns_enabled: boolean
  ddns_interval: number
  // Health/Monitoring
  enable_post_startup_health_check: boolean
  health_check_delay: number
  critical_containers: string
  important_containers: string
  health_score_enabled: boolean
  // Metrics/Features
  metrics_enabled: boolean
  metrics_collect_interval: number
  rollback_enabled: boolean
  scheduler_enabled: boolean
  plugins_enabled: boolean
  plugins_hooks_enabled: boolean
  // Backup
  backup_source_dir: string
  backup_dest_dir: string
  backup_retention_count: number
  // Docker
  docker_timeout: number
  force_recreate: boolean
  remove_orphaned_containers: boolean
  service_start_delay: number
  docker_stacks: string
  max_parallel_operations: number
  stack_start_timeout: number
  service_stop_delay: number
  // API extended
  api_auth_enabled: boolean
  api_rate_limit: number
  api_rate_window: number
  api_token_expiry: number
  api_single_session: boolean
  api_cors_origins: string
  api_ip_whitelist: string
  // Log extended
  log_max_size: string
  log_backup_count: number
  log_retention_days: number
  enable_structured_logging: boolean
  // Metrics extended
  metrics_retention_days: number
  include_resource_metrics: boolean
  // Features extended
  rollback_max_snapshots: number
  secrets_encryption: boolean
  scheduler_check_interval: number
}

// POST /stacks (create)
export interface StackCreateResponse {
  success: boolean
  name: string
  message: string
}

// DELETE /stacks/:name
export interface StackDeleteResponse {
  success: boolean
  name: string
  message: string
}

// POST /config
export interface ConfigUpdateResponse {
  success: boolean
  updated: number
  message: string
}

// GET /system
export interface SystemInfo {
  hostname: string
  kernel: string
  cpu_count: number
  memory_total_mb: number
  swap_total_mb: number
  docker_version: string
  docker_disk_usage: DockerDiskUsage[]
}

export interface DockerDiskUsage {
  type: string
  total: string
  active: string
  size: string
  reclaimable: string
}

// GET /networks
export interface NetworkListResponse {
  total: number
  networks: NetworkInfo[]
}

export interface NetworkInfo {
  id: string
  name: string
  driver: string
  scope: string
  containers: string[]
}

// GET /networks/:name
export interface NetworkDetail {
  id: string
  name: string
  driver: string
  scope: string
  internal: boolean
  subnet: string
  gateway: string
  containers: NetworkContainer[]
}

export interface NetworkContainer {
  id: string
  name: string
  ipv4: string
}

// POST /networks (create)
export interface NetworkCreateResponse {
  success: boolean
  name: string
  driver: string
  message: string
}

// POST /networks/:name/delete
export interface NetworkDeleteResponse {
  success: boolean
  name: string
  message: string
}

// POST /networks/:name/connect, /networks/:name/disconnect
export interface NetworkActionResponse {
  success: boolean
  network: string
  container: string
  message: string
}

// POST /volumes/:name/delete
export interface VolumeDeleteResponse {
  success: boolean
  name: string
  message: string
}

// GET /volumes
export interface VolumeListResponse {
  total: number
  volumes: VolumeInfo[]
}

export interface VolumeInfo {
  name: string
  driver: string
  mountpoint: string
  size_bytes: number
}

// GET /disks
export interface DiskListResponse {
  total: number
  disks: DiskInfo[]
}

export interface DiskInfo {
  device: string
  mount: string
  total: string
  used: string
  available: string
  percent: string
}

/** A user-defined custom disk location (stored locally, not from the API) */
export interface CustomDiskEntry {
  /** Mount path, e.g. /mnt/external */
  mount: string
  /** Friendly label */
  label: string
}

// GET /logs
export interface LogsResponse {
  log_file: string
  lines: number
  logs: string
}

export interface LogEntry {
  timestamp: string
  level: string
  message: string
}

// GET /events
export interface EventsResponse {
  total: number
  events: EventEntry[]
}

export interface EventEntry {
  timestamp: number
  type: string
  action: string
  name: string
}

// GET /containers/:name/processes
export interface ContainerProcessesResponse {
  container: string
  processes: ContainerProcess[]
}

export interface ContainerProcess {
  uid: string
  pid: string
  ppid: string
  cpu: string
  time: string
  cmd: string
}

// GET /stacks/:name/compose
export interface StackComposeResponse {
  stack: string
  content: string
}

// Auth responses
export interface AuthResponse {
  success: boolean
  token: string
  username: string
  role: 'admin' | 'user'
}

export interface AuthVerifyResponse {
  valid: boolean
  username: string
  role: string
}

export interface AuthLogoutResponse {
  success: boolean
  message: string
}

export interface InviteResponse {
  success: boolean
  code: string
  role: string
  expires_at: string
}

export interface InviteListResponse {
  invites: InviteCode[]
}

export interface InviteCode {
  code: string
  role: string
  created_by?: string
  created_at: string
  expires_at: string
  expired?: boolean
  used: boolean
  used_by?: string
}

export interface UserListResponse {
  users: ApiUser[]
}

export interface ApiUser {
  username: string
  role: string
  created_at: string
}

// GET /auth/sessions
export interface SessionInfo {
  id: string
  username: string
  role: string
  created_at: string
  expires_at: number
  remaining_seconds: number
  ip: string
}

export interface SessionListResponse {
  sessions: SessionInfo[]
  total: number
}

// GET /health — extended API metrics
export interface ApiHealthMetrics {
  uptime_seconds: number
  requests_total: number
  errors_total: number
  memory_kb: number
  pid: number
}

// GET /
export interface APIRoot {
  name: string
  version: string
  endpoints: APIEndpoint[]
}

export interface APIEndpoint {
  method: string
  path: string
  description: string
}

// Connection state
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

// Stack annotation (local metadata, persisted via settings)
export interface StackAnnotation {
  label?: string
  priority?: 'critical' | 'high' | 'normal' | 'low'
  notes?: string
  color?: string
}

// Connection profiles
export interface ConnectionProfile {
  id: string
  name: string
  url: string
  isDefault: boolean
  lastConnected?: number
}

// App settings (local, persisted via electron-store)
export interface AppSettings {
  serverUrl: string
  pollingInterval: number
  containerPollingInterval: number
  imagePollingInterval: number
  logPollingInterval: number
  theme: 'dark' | 'light'
  sidebarCollapsed: boolean
  /** Custom labels for disk mount points — e.g., { "/mnt/plex": "Plex Drive" } */
  diskLabels: Record<string, string>
  /** Mount points to show on dashboard — empty means show all */
  pinnedDisks: string[]
  /** User-added custom disk mount paths (not auto-detected by the server) */
  customDisks: CustomDiskEntry[]
  /** Per-stack annotations (labels, priority, notes) */
  stackAnnotations: Record<string, StackAnnotation>
  /** Optional background image URL */
  backgroundImage: string
  /** Auto-lock screen after N minutes of inactivity (0 = disabled) */
  autoLockMinutes: number
  /** Auto-check for system/image updates (0 = off, ms interval) */
  autoCheckUpdates: number
  /** Number of available DCS framework updates (for sidebar badge) */
  updatesAvailable: number
  /** Show desktop notifications for critical events */
  notificationsEnabled: boolean
  /** Customizable project/app name displayed in sidebar and login */
  projectName: string
  /** Subtitle shown below the project name */
  projectSubtitle: string
  /** Connection profiles for multi-server management */
  connectionProfiles: ConnectionProfile[]
  /** User-defined custom CSS injected into the app */
  customCSS: string
  /** Remember the last username across sessions */
  rememberUsername: boolean
  /** Last successfully authenticated username */
  lastUsername: string
  /** Session duration in minutes (0 = indefinite) */
  sessionDurationMinutes: number
}

// ---------------------------------------------------------------------------
// Phase 1: Compose Editor
// ---------------------------------------------------------------------------

// POST /stacks/:name/compose/validate
export interface ComposeValidateResponse {
  valid: boolean
  stack: string
  output: string
}

// POST /stacks/:name/compose
export interface ComposeSaveResponse {
  success: boolean
  stack: string
  message: string
  validated: boolean
  validation_errors?: string
}

// GET /stacks/:name/env
export interface StackEnvVariable {
  key: string
  value: string
  line: number
  comment: string
}

export interface StackEnvResponse {
  stack: string
  raw: string
  variables: StackEnvVariable[]
}

// POST /stacks/:name/env
export interface StackEnvSaveResponse {
  success: boolean
  stack: string
  message: string
}

// ---------------------------------------------------------------------------
// Phase 2: Maintenance
// ---------------------------------------------------------------------------

export interface MaintenanceReport {
  containers: { total: number; running: number; stopped: number }
  images: { total: number; dangling: number }
  volumes: { total: number; dangling: number }
  networks: { total: number; custom: number }
  docker_df: string
  app_data_size: string
  log_size: string
}

export interface OrphanContainer {
  name: string
  image: string
  status: string
}

export interface DanglingImage {
  id: string
  size: string
  created: string
}

export interface DanglingVolume {
  name: string
  driver: string
}

export interface OrphanReport {
  containers: OrphanContainer[]
  images: DanglingImage[]
  volumes: DanglingVolume[]
}

export interface DiskStackSize {
  name: string
  size: string
}

export interface DiskDfEntry {
  type: string
  total: string
  active: string
  size: string
  reclaimable: string
}

export interface DiskVolumeSize {
  name: string
  size: string
}

export interface DiskAnalysis {
  stack_sizes: DiskStackSize[]
  docker_df: DiskDfEntry[]
  total_app_data: string
  host_disk?: {
    total: string
    used: string
    available: string
    percent: string
  }
  volumes?: DiskVolumeSize[]
}

export interface LogRotateResponse {
  success: boolean
  message: string
  archived_as?: string
  previous_size?: string
  previous_lines?: number
  purged_archives?: number
}

// ---------------------------------------------------------------------------
// Phase 3: Enhanced Logs
// ---------------------------------------------------------------------------

export interface LogLevelCounts {
  error: number
  critical: number
  warning: number
  success: number
  info: number
  debug: number
  step: number
  timing: number
}

export interface LogStatsResponse {
  total_lines: number
  file_size: string
  levels: LogLevelCounts
  sessions: number
  archives: { count: number; total_size: string }
}

export interface LogArchiveEntry {
  filename: string
  size: string
  date: string
}

export interface LogArchivesResponse {
  archives: LogArchiveEntry[]
  total_size: string
}

// ---------------------------------------------------------------------------
// Phase 4: Batch Operations
// ---------------------------------------------------------------------------

export interface BatchStackResult {
  stack: string
  success: boolean
  message: string
  changes_detected?: boolean
}

export interface BatchStackResponse {
  action: string
  total: number
  results: BatchStackResult[]
}

// ---------------------------------------------------------------------------
// Phase 5: Environment Manager
// ---------------------------------------------------------------------------

export interface EnvVariable {
  key: string
  value: string
  line: number
  comment: string
}

export interface RootEnvResponse {
  raw: string
  variables: EnvVariable[]
}

export interface EnvValidationError {
  line: number
  message: string
}

export interface EnvValidateResponse {
  valid: boolean
  errors: EnvValidationError[]
  warnings: EnvValidationError[]
}

// ---------------------------------------------------------------------------
// Phase 6: Backup & Restore
// ---------------------------------------------------------------------------

export interface BackupEntry {
  filename: string
  size: string
  timestamp: number
}

export interface BackupListResponse {
  backups: BackupEntry[]
  total: number
}

export interface BackupStatusResponse {
  status: 'idle' | 'running' | 'error' | 'restoring'
  last_backup?: { filename: string; size: string; timestamp: string } | null
  last_restore?: { filename: string; timestamp: string } | null
  progress?: string | null
  percent?: number
  stage?: string
  error?: string
  started_at?: string
  filename?: string
}

export interface BackupConfigResponse {
  configured: boolean
  destination: string
  source: string
  retention_count: number
}

export interface BackupTriggerResponse {
  success: boolean
  message: string
  filename: string
}

export interface BackupRestoreResponse {
  success: boolean
  message: string
  filename: string
}

// POST /containers/:name/exec
export interface ContainerExecResponse {
  container: string
  command: string
  exit_code: number
  output: string
  success: boolean
}

// System Update Check
export interface SystemUpdateCheckResponse {
  available: boolean
  current_version: string
  latest_version: string
  commits_behind: number
  changelog: { hash: string; message: string; author: string; date: string }[]
  has_local_changes: boolean
  branch: string
  last_backup_tag?: string
}

export interface SystemUpdateApplyResponse {
  success?: boolean
  updated?: boolean
  previous_version: string
  updated_to?: string
  new_version?: string
  changelog: { hash: string; message: string }[]
  backup_tag: string
  commits_applied?: number
  restart_required?: boolean
  message?: string
}

export interface SystemUpdateRollbackResponse {
  success?: boolean
  rolled_back?: boolean
  restored_version?: string
  previous_version?: string
  backup_tag?: string
  branch?: string
  message?: string
}

export interface OsUpdateCheckResponse {
  available: boolean
  count: number
  package_manager: string
  packages: { package: string; version: string }[]
  checked_as: string
}

export interface OsUpdateApplyResponse {
  success: boolean
  status?: string
  package_manager: string
  exit_code?: number
  summary?: string
  output?: string
  applied_as?: string
  message: string
}

export interface OsUpdateStatusResponse {
  status: 'idle' | 'running' | 'complete'
  success?: boolean
  package_manager?: string
  exit_code?: number
  summary?: string
  output?: string
  applied_as?: string
  message?: string
  started_at?: string
  completed_at?: string
}

export interface UIUpdateCheckResponse {
  available: boolean
  current_version: string
  latest_version: string
  release_url: string
  changelog: string
  published_at: string
  download_url?: string
}

// Navigation
export type PageId =
  | 'dashboard'
  | 'stacks'
  | 'containers'
  | 'images'
  | 'health'
  | 'uptime'
  | 'networks'
  | 'logs'
  | 'system'
  | 'diagnostics'
  | 'config'
  | 'settings'
  | 'bookmarks'
  | 'activity'
  | 'users'
  | 'volumes'
  | 'maintenance'
  | 'environment'
  | 'backup'
  | 'terminal'
  | 'cronjobs'
  | 'trends'
  | 'updates'
  | 'notifications'
  | 'snapshots'
  | 'templates'
  | 'automations'
  | 'topology'
  | 'file-browser'
  | 'disk-analysis'
  | 'secrets'
  | 'schedules'
  | 'plugins'
  | 'event-feed'
  | 'export'
  | 'dns'
  | 'setup'

/**
 * Pages restricted to admin users only.
 * Used by Sidebar (hide nav items), CommandPalette (hide commands),
 * and settingsStore (navigation guard).
 */
export const ADMIN_ONLY_PAGES: ReadonlySet<PageId> = new Set([
  'secrets',
  'file-browser',
  'plugins',
  'terminal',
  'environment',
  'config',
  'maintenance',
  'backup',
  'cronjobs',
  'users',
  'automations',
  'snapshots',
  'export',
  'dns',
])

// ---------------------------------------------------------------------------
// v3.1: Terminal, Image Delete, Container Rename, Stack Services, System Metrics
// ---------------------------------------------------------------------------

// POST /terminal/exec
export interface TerminalExecResponse {
  command: string
  cwd: string
  exit_code: number
  output: string
  success: boolean
  timestamp: string
}

// GET /terminal/history
export interface TerminalHistoryResponse {
  commands: string[]
  total: number
}

// POST /images/*/delete
export interface ImageDeleteResponse {
  success: boolean
  image: string
  message: string
}

// POST /containers/:name/rename
export interface ContainerRenameResponse {
  success: boolean
  old_name: string
  new_name: string
  message: string
}

// GET /stacks/:name/services
export interface StackServiceInfo {
  name: string
  state: string
  health: string
  image: string
  container: string
}

export interface StackServicesResponse {
  stack: string
  services: StackServiceInfo[]
}

// GET /system/metrics
export interface SystemMetricsResponse {
  cpu: {
    count: number
    load_average: [number, number, number]
  }
  memory: {
    total_mb: number
    used_mb: number
    available_mb: number
    cached_mb: number
    swap_total_mb: number
    swap_used_mb: number
  }
  disks: Array<{
    device: string
    mount: string
    total: string
    used: string
    available: string
    percent: string
  }>
}

// ---------------------------------------------------------------------------
// v3.2: Terminal Auth, Container Files, Alerts, Cron, Live Logs
// ---------------------------------------------------------------------------

// POST /terminal/auth
export interface TerminalAuthResponse {
  success: boolean
  token: string
  username: string
  expires_in: number
  auth_method: string
  message?: string
}

// POST /terminal/auth/verify
export interface TerminalAuthVerifyResponse {
  valid: boolean
  username: string
  expires_at: number
}

// POST /terminal/auth/logout
export interface TerminalLogoutResponse {
  success: boolean
  message: string
}

// GET /containers/:name/files
export interface ContainerFileEntry {
  name: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  permissions: string
  modified: string
}

export interface ContainerFilesResponse {
  container: string
  path: string
  entries: ContainerFileEntry[]
}

// GET /containers/:name/files/content
export interface ContainerFileContentResponse {
  container: string
  path: string
  content: string
  size: number
}

// GET/POST /alerts/config
export interface AlertThresholds {
  cpu_warning: number
  cpu_critical: number
  memory_warning: number
  memory_critical: number
  disk_warning: number
  disk_critical: number
  restart_threshold: number
}

export interface AlertConfigResponse {
  thresholds: AlertThresholds
}

// GET /system/crontab
export interface CronEntry {
  schedule: string
  command: string
  user?: string
  source: 'user' | 'system' | 'cron.d'
  human_readable: string
}

export interface CrontabResponse {
  entries: CronEntry[]
  raw: string
}

// GET /containers/:name/logs/live, GET /logs/live
export interface LogStreamEntry {
  timestamp: string
  line: string
  level?: string
}

export interface LiveLogsResponse {
  entries: LogStreamEntry[]
  count: number
  container?: string
}

// ---------------------------------------------------------------------------
// v4.0: Resource Trends, Image Updates, Notifications, Snapshots,
//       Compose History, Templates, Automations, Network Topology
// ---------------------------------------------------------------------------

// GET /metrics/trends
export interface MetricsPoint {
  ts: string
  epoch: number
  cpu_pct: number
  load1: number
  load5: number
  load15: number
  mem_used_mb: number
  mem_total_mb: number
  mem_pct: number
  disk_pct: number
}

export interface MetricsSnapshotResponse {
  success: boolean
  timestamp: string
  cpu_pct: number
  mem_pct: number
  disk_pct: number
}

export interface MetricsTrendsResponse {
  range: string
  points: MetricsPoint[]
  count: number
}

// GET/POST /images/check-updates
export interface ImageUpdateInfo {
  image: string
  repository?: string
  tag?: string
  age_days: number
  staleness: 'current' | 'aging' | 'stale' | 'unknown'
  containers: string
  stack: string
  size: string
  old_id?: string
  new_id?: string
  update_available?: boolean
}

export interface ImageCheckResponse {
  images: ImageUpdateInfo[]
  total: number
  stale: number
  aging: number
  current: number
  updates_available?: number
}

export interface ImageRegistryCheckResponse {
  images: { image: string; old_id: string; new_id: string; update_available: boolean }[]
  total: number
  updates_available: number
  checked_at: string
}

export interface ImageUpdateResponse {
  success: boolean
  image: string
  containers_restarted: string[]
  timestamp: string
}

// Notification Rules
export interface NotificationRule {
  id: string
  name: string
  enabled: boolean
  trigger: string
  target: string
  priority: string
  tags: string[]
  title_template?: string
  message_template?: string
  created_at: string
}

export interface NotificationRulesResponse {
  rules: NotificationRule[]
}

export interface NotificationHistoryEntry {
  timestamp: string
  type: string
  title: string
  priority: string
  status_code: number
}

export interface NotificationHistoryResponse {
  history: NotificationHistoryEntry[]
}

export interface NotificationTestResponse {
  success: boolean
  message: string
  status_code: number
  timestamp: string
}

// Snapshots
export interface SnapshotEntry {
  filename: string
  label: string
  size: string
  timestamp: string
  epoch: number
}

export interface SnapshotListResponse {
  snapshots: SnapshotEntry[]
  total: number
}

export interface SnapshotCreateResponse {
  success: boolean
  filename: string
  label: string
  size: string
  timestamp: string
}

export interface SnapshotRestoreResponse {
  success: boolean
  message: string
  filename: string
}

// Compose History
export interface ComposeVersion {
  version_id: string
  timestamp: string
  size: number
}

export interface ComposeHistoryResponse {
  stack: string
  versions: ComposeVersion[]
  count: number
}

export interface ComposeVersionContentResponse {
  stack: string
  version_id: string
  content: string
  size: number
}

export interface ComposeRollbackResponse {
  success: boolean
  stack: string
  restored_version: string
  message: string
}

// Templates
export interface TemplateOptionalService {
  service: string
  label: string
  description?: string
  default_enabled: boolean
}

export interface TemplateInfo {
  name: string
  title?: string
  description: string
  category: string
  target_stack?: string
  tags: string[]
  icon?: string
  variables?: TemplateVariable[]
  optional_services?: TemplateOptionalService[]
  singleton?: boolean
}

export interface TemplateVariable {
  name: string
  label: string
  description?: string
  default?: string
  required?: boolean
  type?: string
}

export interface TemplateListResponse {
  templates: TemplateInfo[]
  total: number
}

export interface TemplateDetailResponse {
  template: TemplateInfo
  compose: string
  env?: string
}

export interface TemplateUpdateResponse {
  success: boolean
  name: string
  message: string
}

export interface TemplateDeleteResponse {
  success: boolean
  name: string
  message: string
}

export interface TemplateDeployResponse {
  success: boolean
  target_stack: string
  services_added: string[]
  started: boolean
  message: string
  backup_file?: string
}

export interface TemplateImportResponse {
  success: boolean
  name: string
  message: string
}

// Deploy History / Audit Log
export interface DeployHistoryEntry {
  id: string
  action: 'deploy' | 'undeploy'
  template: string
  target_stack: string
  services: string[]
  backup_file?: string
  timestamp: string
  epoch: number
}

export interface DeployHistoryResponse {
  history: DeployHistoryEntry[]
  total: number
}

// Template Undeploy
export interface TemplateUndeployResponse {
  success: boolean
  template: string
  target_stack: string
  services_removed: string[]
  containers_removed: string[]
  backup_file: string
  stack_deleted: boolean
  data_removed: boolean
  message: string
}

// Template Dry Run / Preview
export interface TemplateDryRunResponse {
  success: boolean
  template: string
  target_stack: string
  services: string[]
  service_conflicts: string
  has_service_conflicts: boolean
  port_conflicts: string
  has_port_conflicts: boolean
  port_conflicts_detail?: { port: number; owner: string; type: 'stack' | 'container'; service?: string }[]
  env_additions: { key: string; value: string }[]
  env_existing?: { key: string; current_value: string; new_value: string }[]
  lines_added: number
  compose_preview: string
}

// Automations
export interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  trigger_type: 'schedule' | 'condition'
  trigger_value: string
  action_type: string
  action_target: string
  created_at: string
  run_count: number
  last_run: string | null
  history: AutomationHistoryEntry[]
}

export interface AutomationHistoryEntry {
  timestamp: string
  success: boolean
  message: string
}

export interface AutomationListResponse {
  automations: AutomationRule[]
  total: number
}

export interface AutomationHistoryResponse {
  automation_id: string
  history: AutomationHistoryEntry[]
}

// Network Topology
export interface TopologyNodeIP {
  network: string
  ip: string
}

export interface TopologyNode {
  id: string
  state: string
  health: string
  image: string
  stack: string
  networks: string[]
  ports: string
  ip_addresses?: TopologyNodeIP[]
}

export interface TopologyEdge {
  source: string
  target: string
  network: string
}

export interface TopologyNetwork {
  name: string
  driver: string
  subnet: string
  container_count: number
}

export interface TopologyResponse {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  networks: TopologyNetwork[]
}

// ---------------------------------------------------------------------------
// Setup Wizard
// ---------------------------------------------------------------------------

// GET /setup/status
export interface SetupStatusResponse {
  initialized: boolean
  needs_admin?: boolean
  needs_config?: boolean
}

// GET /setup/defaults
export interface SetupDefaultsResponse {
  defaults: Record<string, string>
  stacks: string[]
  system: {
    hostname: string
    timezone: string
    puid: number
    pgid: number
    docker_version: string
    compose_version: string
    docker_available: boolean
  }
}

// POST /auth/factory-reset
export interface FactoryResetResponse {
  success: boolean
  files_removed: string[]
  compose_reset: boolean
  stacks_removed: string[]
}

// POST /setup/configure
export interface SetupConfigureRequest {
  env_vars: Record<string, string>
  stacks: string[]
}

export interface SetupConfigureResponse {
  success: boolean
  stacks_created: string[]
  stacks_removed: string[]
  stacks_warned: string[]
  env_updated: number
}

// POST /setup/complete
export interface SetupCompleteResponse {
  initialized: boolean
  message: string
}

// POST /stacks/rename
export interface StackRenameRequest {
  old_name: string
  new_name: string
}

export interface StackRenameResponse {
  success: boolean
  old_name: string
  new_name: string
}

// POST /stacks/reorder
export interface StackReorderRequest {
  stacks: string[]
}

export interface StackReorderResponse {
  success: boolean
  order: string[]
}

// ---------------------------------------------------------------------------
// v4.0: SSE, Metrics History, Rollback, Secrets, Scheduler, Health Scoring, Plugins, Multi-Server
// ---------------------------------------------------------------------------

export interface SSEMetricsEvent {
  cpu_percent: number
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
  load_average: [number, number, number]
  disk_percent: number
  container_count: number
  container_running: number
}

export interface MetricsHistoryResponse {
  range: string
  count: number
  metrics: MetricsDataPoint[]
}

export interface MetricsDataPoint {
  ts: string
  cpu_percent: number
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
  load_1m: number
  load_5m: number
  load_15m: number
  disk_percent: number
  disk_used_gb: number
  disk_total_gb: number
  containers_total: number
  containers_running: number
  containers_stopped: number
  images_count: number
  networks_count: number
  volumes_count: number
}

export interface MetricsSummaryResponse {
  range: string
  cpu: { min: number; max: number; avg: number }
  memory: { min: number; max: number; avg: number }
  disk: { min: number; max: number; avg: number }
}

export interface RollbackSnapshotsResponse {
  stack: string
  snapshots: RollbackSnapshot[]
}

export interface RollbackSnapshot {
  id: string
  timestamp: string
  operation: string
  images_count: number
}

export interface RollbackSnapshotDetail extends RollbackSnapshot {
  compose_file: string
  env_file: string | null
  images: { name: string; digest: string }[]
  metadata: { user: string; stack_status: string; created_at: string }
}

export interface RollbackRestoreResponse {
  success: boolean
  stack: string
  snapshot_id: string
  output: string
}

export interface RollbackDiffResponse {
  stack: string
  snapshot_id: string
  compose_diff: string
  env_diff: string
  image_changes: { image: string; from: string; to: string }[]
}

export interface SecretsListResponse {
  secrets: string[]
  total: number
}

export interface SecretSetResponse {
  success: boolean
  key: string
}

export interface SecretDeleteResponse {
  success: boolean
  key: string
}

export interface SecretExistsResponse {
  key: string
  exists: boolean
}

export interface ScheduleListResponse {
  schedules: Schedule[]
  total: number
}

export interface Schedule {
  id: string
  name: string
  schedule: string
  action: string
  target: string
  enabled: boolean
  created_at: string
  last_run: string | null
  next_run: string
  run_count: number
}

export interface ScheduleCreateResponse {
  success: boolean
  schedule: Schedule
}

export interface ScheduleHistoryResponse {
  schedule_id: string
  history: ScheduleExecution[]
}

export interface ScheduleExecution {
  timestamp: string
  schedule_id: string
  action: string
  target: string
  success: boolean
  duration_ms: number
  output: string
}

export interface HealthScoreResponse {
  score: number
  grade: string
  factors: {
    stacks: { score: number; weight: number; healthy: number; unhealthy: number; total: number }
    resources: { score: number; weight: number; cpu_pct: number; mem_pct: number }
    images: { score: number; weight: number; total: number; stale: number }
    uptime: { score: number; weight: number; seconds: number }
  }
  stacks: StackHealthScore[]
}

export interface StackHealthScore {
  stack: string
  score: number
  grade: string
  container_count: number
  healthy_count: number
  container_scores: ContainerHealthScore[]
}

export interface ContainerHealthScore {
  container: string
  score: number
  grade: string
  factors: { health: number; uptime: number; restarts: number; resources: number; image_age: number }
}

export interface HealthScoreHistoryResponse {
  range: string
  history: { ts: string; score: number }[]
}

export interface PluginListResponse {
  plugins: Plugin[]
  total: number
}

export interface Plugin {
  name: string
  version: string
  description: string
  author?: string
  templates: string[]
  hooks: string[]
  enabled: boolean
}

export interface PluginInstallResponse {
  success: boolean
  plugin: Plugin
  message: string
}

export interface PluginDeleteResponse {
  success: boolean
  name: string
}

// Plugin hooks & execution
export interface PluginHookInfo {
  name: string
  size: number
  executable: boolean
  modified: number
  lines: number
}

export interface PluginHooksListResponse {
  plugin: string
  hooks: PluginHookInfo[]
}

export interface PluginHookContentResponse {
  plugin: string
  hook: string
  content: string
  executable: boolean
  size: number
}

export interface PluginHookUpdateResponse {
  success: boolean
  plugin: string
  hook: string
  message: string
}

export interface PluginHookTestResponse {
  success: boolean
  plugin: string
  hook: string
  exit_code: number
  output: string
}

export interface PluginLogEntry {
  timestamp: string
  hook: string
  status: string
  message: string
  exit_code?: number
}

export interface PluginLogsResponse {
  plugin: string
  entries: PluginLogEntry[]
  total: number
}

export interface PluginConfigUpdateResponse {
  success: boolean
  plugin: string
  message: string
}

export interface ConfigSchemaResponse {
  sections: Record<string, {
    title: string
    properties: Record<string, {
      type: string
      default: unknown
      description: string
      enum?: string[]
      minimum?: number
      maximum?: number
      pattern?: string
    }>
  }>
}

export interface DependencyGraphResponse {
  nodes: { id: string; status: string }[]
  edges: { from: string; to: string }[]
}

export interface ServerProfile {
  id: string
  name: string
  url: string
  apiToken?: string
  lastConnected?: number
  color?: string
  isDefault?: boolean
}

// ---------------------------------------------------------------------------
// v4.1: URL Import, Gallery, Stack Clone, Image Search, Compose Validate,
//       Export, Audit Log, Webhooks
// ---------------------------------------------------------------------------

export interface TemplateImportUrlResponse {
  success: boolean
  name: string
  source_url: string
  message: string
}

export interface GalleryTemplate {
  name: string
  description: string
  category: string
  url: string
  services: string[]
  icon?: string
}

export interface TemplateGalleryResponse {
  templates: GalleryTemplate[]
  total: number
}

export interface StackCloneResponse {
  success: boolean
  source: string
  name: string
  message: string
}

export interface ImageSearchResult {
  name: string
  description: string
  stars: number
  official: string
  automated: string
}

export interface ImageSearchResponse {
  results: ImageSearchResult[]
  total: number
  query: string
}

export interface ComposeValidateFullResponse {
  valid: boolean
  errors: string[]
  warnings: string[]
  services: string[]
  output: string
}

export interface ExportResponse {
  type: string
  data: Record<string, unknown>
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: string
}

export interface AuditLogResponse {
  entries: AuditEntry[]
  total: number
}

export interface Webhook {
  id: string
  url: string
  events: string[]
  enabled: boolean
  created_at: string
}

export interface WebhookListResponse {
  webhooks: Webhook[]
  total: number
}

export interface WebhookCreateResponse {
  success: boolean
  webhook: Webhook
}

export interface WebhookDeleteResponse {
  success: boolean
  deleted: string
}

export interface WebhookTestResponse {
  success: boolean
  status_code: number
  url: string
  timestamp: string
}

// POST /images/pull
export interface ImagePullResponse {
  success: boolean
  image: string
  message: string
}

// Dashboard Layout (24-column free-placement grid, 50px row height)
export interface DashboardCard {
  id: string
  visible: boolean
  x: number   // column start (0-based, 0-23)
  y: number   // row start (0-based, each row = 50px)
  w: number   // width in columns
  h: number   // height in row units (× 50px)
}

export interface DashboardLayout {
  cards: DashboardCard[]
  labels: Record<string, string>  // card ID → custom title (for dividers)
  version: number
}

// Keep DashboardCardSize for backwards compat with any references
export type DashboardCardSize = 'small' | 'medium' | 'large' | 'full'

// Plugin Cards
export interface PluginCardMeta {
  id: string
  title: string
  icon: string
  defaultW: number
  defaultH: number
  description: string
  plugin: string
  author?: string
  version?: string
  // Size constraints (omit for free resizing)
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  // Behavior
  isScrollable?: boolean
  refreshInterval?: number
  dataEndpoint?: string | null
}

export interface PluginCardsResponse {
  cards: PluginCardMeta[]
  total: number
}

export interface DashboardLayoutResponse {
  layout: DashboardLayout
}

// TOTP Two-Factor Authentication
export interface TotpSetupResponse { secret: string; uri: string; message: string }
export interface TotpVerifyResponse { success: boolean; message: string }
export interface TotpValidateResponse { success: boolean; token?: string; username?: string; role?: string }

