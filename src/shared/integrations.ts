// =============================================================================
// Integrations that talk to other apps on the same server — Homarr:
//   GET /homarr/status, POST|DELETE /homarr/key, POST /homarr/sync
// =============================================================================

/** How DCS can put a deployed app on Homarr */
export type HomarrMode =
  /** the REST API with the stored key: the app and a tile on the home board */
  | 'board'
  /** sqlite only (no key): the app lands in the library and the owner drags it onto a board */
  | 'library'
  /** Homarr is not deployed here */
  | 'none'

/** GET /homarr/status */
export interface HomarrStatus {
  active: boolean
  has_api_key: boolean
  url: string
  /** Homarr's published host port ('' when unknown); an API older than the panel leaves it out */
  port?: string
  /** an API older than the panel leaves it out: homarrMode() derives it */
  mode?: HomarrMode
  /** boards the stored key can see */
  boards?: number
  /** one sentence the server wants the owner to read */
  hint?: string
}

/** POST /homarr/key — Homarr accepted the key and it is stored as the secret HOMARR_API_KEY */
export interface HomarrKeyResponse { success: boolean; boards: number }

/** POST /homarr/sync — every routed service Homarr did not have yet is being registered */
export interface HomarrSyncResponse { success: boolean; queued: number; skipped: number }
