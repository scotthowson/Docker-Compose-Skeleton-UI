// =============================================================================
// colorMode — which look the person sees: dark, light, or whatever the device
// prefers (settings.theme = 'dark' | 'light' | 'system'). The header switch,
// Ctrl+D and the command palette flip the look that is showing and so always
// leave an explicit choice; "System" is picked in Settings → Appearance.
// =============================================================================

import { useSyncExternalStore } from 'react'
import type { ThemeMode, ThemeModePreference } from '../../shared/themes'
import { useSettingsStore } from '../stores/settingsStore'

const query: MediaQueryList | null = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-color-scheme: light)')
  : null

/** the device's preference (dark when it states none: the dashboard's own look) */
export function systemMode(): ThemeMode {
  return query?.matches ? 'light' : 'dark'
}

export function resolveMode(pref: ThemeModePreference | string | undefined): ThemeMode {
  if (pref === 'light' || pref === 'dark') return pref
  return systemMode()
}

/** the mode showing now */
export function currentMode(): ThemeMode {
  return resolveMode(useSettingsStore.getState().theme)
}

/** follow the device's preference as it changes; returns the unsubscribe */
export function onSystemModeChange(fn: () => void): () => void {
  if (!query) return () => {}
  query.addEventListener('change', fn)
  return () => query.removeEventListener('change', fn)
}

export function useSystemMode(): ThemeMode {
  return useSyncExternalStore(onSystemModeChange, systemMode, () => 'dark')
}

/** the mode showing now, re-rendering when the setting or the device's preference changes */
export function useResolvedMode(): ThemeMode {
  const pref = useSettingsStore((s) => s.theme)
  const system = useSystemMode()
  return pref === 'light' || pref === 'dark' ? pref : system
}

/** the header switch: the other look, as an explicit choice */
export function toggleMode(): void {
  const { theme, updateSetting } = useSettingsStore.getState()
  updateSetting('theme', resolveMode(theme) === 'dark' ? 'light' : 'dark')
}
