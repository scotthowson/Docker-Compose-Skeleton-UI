// Build-time constants injected by Vite (see vite.config.ts define)
// Falls back to hardcoded values if Vite defines are unavailable (e.g., test environment)
declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string
declare const __BUILD_ID__: string

export const BUILD_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.23.0'
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '2026-04-03'
/** Unique id of this build; empty outside a Vite build (tests) */
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : ''
