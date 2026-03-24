// =============================================================================
// Environment Detection — Electron vs Docker/Web vs Vite Dev
// =============================================================================

/**
 * Returns true ONLY when served by Docker nginx (not Electron, not Vite dev).
 * Docker nginx proxies /api/ to the host API server.
 * Vite dev server does NOT have this proxy, so we must NOT use /api there.
 */
export function isWebMode(): boolean {
  if (typeof window === 'undefined') return false
  if (window.electronAPI) return false
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return false
  // Vite dev server runs on port 5173+ — NOT web mode (no /api proxy)
  // Docker nginx runs on port 3000 (or custom) — IS web mode
  if (import.meta.env?.DEV) return false
  return true
}

/**
 * Default API base URL based on the runtime environment.
 * - Electron: direct connection to localhost API server
 * - Vite dev: direct connection to localhost API server (same as Electron)
 * - Docker/nginx: same-origin proxy via /api/ location
 */
export function getDefaultServerUrl(): string {
  return isWebMode() ? '/api' : 'http://127.0.0.1:9876'
}
