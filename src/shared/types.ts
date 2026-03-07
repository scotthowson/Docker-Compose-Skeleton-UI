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
  | 'trends'
  | 'updates'
  | 'notifications'
  | 'snapshots'
  | 'templates'
  | 'automations'
  | 'topology'
  | 'file-browser'
  | 'disk-analysis'
  | 'setup'

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

export interface ComposeRollbackResponse {
  success: boolean
  stack: string
  restored_version: string
  message: string
}

// Templates
export interface TemplateInfo {
  name: string
  title?: string
  description: string
  category: string
  target_stack?: string
  tags: string[]
  icon?: string
  variables?: TemplateVariable[]
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
  port_conflicts_detail?: { port: number; owner: string; type: 'stack' | 'container' }[]
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
