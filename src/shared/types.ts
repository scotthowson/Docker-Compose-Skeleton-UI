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
}

// GET /containers/:name
export interface ContainerDetail extends ContainerInfo {
  environment: string
  mounts: string
  networks: string
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
  timezone: string
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

export interface DiskAnalysis {
  stack_sizes: DiskStackSize[]
  docker_df: DiskDfEntry[]
  total_app_data: string
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
