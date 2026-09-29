// =============================================================================
// nativeLook — the look outside the page. Electron: the window colour shown
// before the page paints and nativeTheme (title bar, native menus and dialogs)
// follow the mode setting. Android: the status bar icons suit the look.
// Called by themeStore.syncDocumentTheme after every change of look.
// =============================================================================

import { type Theme, type ThemeMode, themeLook } from '../../shared/themes'
import { isNative } from '../hooks/useMobile'

let last = ''

/** Android: light icons on a dark look, dark icons on a light one */
export function setStatusBarLook(mode: ThemeMode, color: string): void {
  if (!isNative) return
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: mode === 'light' ? Style.Light : Style.Dark })
    StatusBar.setBackgroundColor({ color })
  }).catch(() => {})
}

export function syncNativeLook(theme: Theme, mode: ThemeMode, pref: string): void {
  const dark = themeLook(theme, 'dark')
  const light = themeLook(theme, 'light')
  const signature = [theme.name, mode, pref, dark.bg, light.bg, dark.surface, light.surface].join('|')
  if (signature === last) return
  last = signature
  if (window.electronAPI) {
    // main/index.ts: nativeTheme.themeSource = pref, window background = the bg of the look showing
    window.electronAPI.setSetting('appearance', { pref, bg: { dark: dark.bg, light: light.bg } }).catch(() => {})
  }
  setStatusBarLook(mode, (mode === 'light' ? light : dark).surface)
}
