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
