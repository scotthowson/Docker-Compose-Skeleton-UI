// =============================================================================
// API helpers for the integration panels (Server Config → Integrations)
// =============================================================================

import { apiClient } from './client'
import type { HomarrKeyResponse, HomarrMode, HomarrStatus, HomarrSyncResponse } from '../../shared/integrations'

/** GET /homarr/status — whether Homarr runs here, whether a key is stored, and what a deploy can do with it */
export function fetchHomarrIntegration(): Promise<HomarrStatus> {
  return apiClient.get<HomarrStatus>('/homarr/status')
}

/** POST /homarr/key — validates the key against Homarr and stores it as the secret HOMARR_API_KEY (400 when Homarr refuses it) */
export function saveHomarrKey(key: string): Promise<HomarrKeyResponse> {
  return apiClient.post<HomarrKeyResponse>('/homarr/key', { key }, 30000)
}

/** DELETE /homarr/key — forget the key; apps deployed from then on land in the library only */
export function removeHomarrKey(): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>('/homarr/key')
}

/** POST /homarr/sync — register every routed service (the hub's own and the VMs') that Homarr does not have yet */
export function syncHomarrRoutes(): Promise<HomarrSyncResponse> {
  return apiClient.post<HomarrSyncResponse>('/homarr/sync', undefined, 120000)
}

/** The mode of a status, derived for an API that predates the field */
export function homarrMode(s: HomarrStatus): HomarrMode {
  if (s.mode) return s.mode
  if (!s.active) return 'none'
  return s.has_api_key ? 'board' : 'library'
}
