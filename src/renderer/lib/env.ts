// =============================================================================
// Environment Detection — Electron vs Docker/Web mode
// =============================================================================

/**
 * Returns true when the SPA is served by a web server (nginx in Docker)
 * rather than running inside Electron. In web mode, the API is proxied
 * through nginx at /api/ on the same origin — no CORS, no mixed content.
 */
export function isWebMode(): boolean {
  return (
    typeof window !== 'undefined' &&
    !window.electronAPI &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:')
  )
}

/**
 * Default API base URL based on the runtime environment.
 * - Electron: direct connection to localhost API server
 * - Web/Docker: same-origin proxy via nginx /api/ location
 */
export function getDefaultServerUrl(): string {
  return isWebMode() ? '/api' : 'http://127.0.0.1:9876'
}
