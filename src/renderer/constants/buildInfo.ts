// Build-time constants injected by Vite (see vite.config.ts define)
// Falls back to hardcoded values if Vite defines are unavailable (e.g., test environment)
declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string

export const BUILD_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.19.0'
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '2026-04-03'
