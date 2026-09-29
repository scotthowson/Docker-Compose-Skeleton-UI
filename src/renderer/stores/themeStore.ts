// =============================================================================
// themeStore — the themes a dashboard can wear: the built-ins, the ones stored
// on the server (GET /themes, cached so the look is right before the first
// answer), and the ones made on this device. Resolves the effective theme
// (personal choice, else the server's active one, else DCS Emerald) and the
// mode (settings.theme), and dresses the document in that look of that theme.
// =============================================================================

import { create } from 'zustand'
import {
  type Theme,
  type ThemeMeta,
  type ThemeMode,
  type ThemeSaveResponse,
  BUILT_IN_BY_NAME,
  DEFAULT_THEME_NAME,
  isBuiltInCopy,
  resolveThemeAlias,
  themeFromMeta,
  themeLook,
  validateTheme,
} from '../../shared/themes'
import { fetchThemes, fetchTheme, saveTheme, deleteTheme, importTheme, setActiveTheme, isThemeApiMissing } from '../api/themes'
import { applyTheme, buildThemeCss, isThemePreviewing } from '../lib/themeEngine'
import { resolveMode } from '../lib/colorMode'
import { syncNativeLook } from '../lib/nativeLook'
import { useSettingsStore } from './settingsStore'

const CACHE_KEY = 'dcs-theme-cache'
const LOCAL_KEY = 'dcs-local-themes'
/** how often the list is re-read while connected */
export const THEME_POLL_MS = 5 * 60 * 1000

interface ThemeCache {
  metas: ThemeMeta[]
  docs: Record<string, Theme>
  active: string
  fetchedAt: number
}

function readCache(): ThemeCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { metas: [], docs: {}, active: '', fetchedAt: 0 }
    const parsed = JSON.parse(raw) as Partial<ThemeCache>
    return {
      metas: Array.isArray(parsed.metas) ? parsed.metas : [],
      docs: parsed.docs && typeof parsed.docs === 'object' ? parsed.docs : {},
      active: typeof parsed.active === 'string' ? parsed.active : '',
      fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0,
    }
  } catch {
    return { metas: [], docs: {}, active: '', fetchedAt: 0 }
  }
}

function writeCache(c: ThemeCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    // storage may be full or unavailable — the next fetch fills the store again
  }
}

function readLocal(): Theme[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list.map((t) => validateTheme(t).theme).filter((t): t is Theme => !!t)
  } catch {
    return []
  }
}

function writeLocal(list: Theme[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface ThemeStoreState {
  /** null until the first answer; false when the server has no theme endpoints (404) */
  supported: boolean | null
  /** GET /themes → themes (no css) */
  metas: ThemeMeta[]
  /** full documents fetched with GET /themes/{name} (or returned by a save) */
  docs: Record<string, Theme>
  /** GET /themes → active: the theme every dashboard follows ('' = none) */
  active: string
  /** themes made on this device (Theme Studio → Save on this device) */
  localThemes: Theme[]
  loading: boolean
  error: string | null
  fetchedAt: number
  refresh: () => Promise<void>
  /** the full document of a server theme, fetched when the listing says it carries css */
  ensureDoc: (name: string) => Promise<Theme | null>
  save: (theme: Theme) => Promise<ThemeSaveResponse>
  remove: (name: string) => Promise<void>
  importFromUrl: (url: string, replace?: boolean) => Promise<ThemeSaveResponse>
  setActive: (name: string) => Promise<string>
  saveLocal: (theme: Theme) => void
  removeLocal: (name: string) => void
}

const cached = readCache()

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  supported: null,
  metas: cached.metas,
  docs: cached.docs,
  active: cached.active,
  localThemes: readLocal(),
  loading: false,
  error: null,
  fetchedAt: cached.fetchedAt,

  refresh: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const res = await fetchThemes()
      const metas = Array.isArray(res.themes) ? res.themes.filter((m) => m && typeof m.name === 'string') : []
      const active = typeof res.active === 'string' ? res.active : ''
      // keep the documents the listing still vouches for (same name, same save time)
      const docs: Record<string, Theme> = {}
      for (const [name, doc] of Object.entries(get().docs)) {
        const m = metas.find((x) => x.name === name)
        if (m && (!m.updated_at || m.updated_at === doc.updated_at)) docs[name] = doc
      }
      const fetchedAt = Date.now()
      set({ supported: true, metas, docs, active, error: null, fetchedAt, loading: false })
      writeCache({ metas, docs, active, fetchedAt })
      const settings = useSettingsStore.getState()
      if (settings.serverThemeActive !== active) settings.updateSetting('serverThemeActive', active)
    } catch (err) {
      if (isThemeApiMissing(err)) {
        set({ supported: false, metas: [], docs: {}, active: '', error: null, loading: false })
        writeCache({ metas: [], docs: {}, active: '', fetchedAt: Date.now() })
        const settings = useSettingsStore.getState()
        if (settings.serverThemeActive) settings.updateSetting('serverThemeActive', '')
      } else {
        set({ loading: false, error: errorMessage(err) })
      }
    }
  },

  ensureDoc: async (name) => {
    const have = get().docs[name]
    if (have) return have
    try {
      const doc = await fetchTheme(name)
      const v = validateTheme(doc)
      if (!v.ok || !v.theme) return null
      const docs = { ...get().docs, [name]: v.theme }
      set({ docs })
      const { metas, active, fetchedAt } = get()
      writeCache({ metas, docs, active, fetchedAt })
      return v.theme
    } catch {
      return null
    }
  },

  save: async (theme) => {
    const res = await saveTheme(theme)
    const v = validateTheme(res.theme)
    const stored = v.theme ?? theme
    const metas = get().metas.filter((m) => m.name !== stored.name)
    const { css: _css, ...meta } = stored
    metas.push({ ...meta, has_css: !!_css })
    metas.sort((a, b) => a.name.localeCompare(b.name))
    const docs = { ...get().docs, [stored.name]: stored }
    set({ metas, docs, supported: true })
    writeCache({ metas, docs, active: get().active, fetchedAt: get().fetchedAt })
    return { ...res, theme: stored }
  },

  remove: async (name) => {
    await deleteTheme(name)
    const metas = get().metas.filter((m) => m.name !== name)
    const docs = { ...get().docs }
    delete docs[name]
    const active = get().active === name ? '' : get().active
    set({ metas, docs, active })
    writeCache({ metas, docs, active, fetchedAt: get().fetchedAt })
    const settings = useSettingsStore.getState()
    if (settings.serverThemeActive === name) settings.updateSetting('serverThemeActive', '')
  },

  importFromUrl: async (url, replace = false) => {
    const res = await importTheme(url, replace)
    const v = validateTheme(res.theme)
    const stored = v.theme ?? res.theme
    const metas = get().metas.filter((m) => m.name !== stored.name)
    const { css: _css, ...meta } = stored
    metas.push({ ...meta, has_css: !!_css })
    metas.sort((a, b) => a.name.localeCompare(b.name))
    const docs = { ...get().docs, [stored.name]: stored }
    set({ metas, docs, supported: true })
    writeCache({ metas, docs, active: get().active, fetchedAt: get().fetchedAt })
    return { ...res, theme: stored }
  },

  setActive: async (name) => {
    const res = await setActiveTheme(name)
    const active = typeof res.active === 'string' ? res.active : name
    set({ active })
    writeCache({ metas: get().metas, docs: get().docs, active, fetchedAt: get().fetchedAt })
    const settings = useSettingsStore.getState()
    if (settings.serverThemeActive !== active) settings.updateSetting('serverThemeActive', active)
    return active
  },

  saveLocal: (theme) => {
    const list = get().localThemes.filter((t) => t.name !== theme.name)
    list.push({ ...theme, updated_at: Math.floor(Date.now() / 1000) })
    list.sort((a, b) => a.name.localeCompare(b.name))
    set({ localThemes: list })
    writeLocal(list)
  },

  removeLocal: (name) => {
    const list = get().localThemes.filter((t) => t.name !== name)
    set({ localThemes: list })
    writeLocal(list)
  },
}))

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** where a theme of this name would come from: this device, the server, or the dashboard itself */
export type ThemeSource = 'local' | 'server' | 'built-in'

/** a listing entry as a theme, made once per entry (its derived look is computed once too) */
const metaThemes = new WeakMap<ThemeMeta, Theme>()
export function themeForMeta(meta: ThemeMeta): Theme {
  return fromMeta(meta)
}
function fromMeta(meta: ThemeMeta): Theme {
  let t = metaThemes.get(meta)
  if (!t) {
    t = themeFromMeta(meta)
    metaThemes.set(meta, t)
  }
  return t
}

/**
 * A theme by name: this device's copy first, then the server's, then the built-in.
 * A server copy of a built-in (what "Set for everyone" stores) is the built-in.
 */
export function resolveTheme(name: string): { theme: Theme; source: ThemeSource } | null {
  if (!name) return null
  const id = resolveThemeAlias(name)
  const { docs, metas, localThemes } = useThemeStore.getState()
  const local = localThemes.find((t) => t.name === id)
  if (local) return { theme: local, source: 'local' }
  const builtIn = BUILT_IN_BY_NAME[id]
  const doc = docs[id]
  if (doc) return builtIn && isBuiltInCopy(doc) ? { theme: builtIn, source: 'built-in' } : { theme: doc, source: 'server' }
  const meta = metas.find((m) => m.name === id)
  if (meta) {
    // the palette applies from the listing at once; ensureDoc brings the css if it has any
    const theme = fromMeta(meta)
    return builtIn && !meta.has_css && isBuiltInCopy(theme) ? { theme: builtIn, source: 'built-in' } : { theme, source: 'server' }
  }
  return builtIn ? { theme: builtIn, source: 'built-in' } : null
}

/** the name in effect: the person's choice, else what the server set for everyone */
export function effectiveThemeName(): string {
  const s = useSettingsStore.getState()
  return s.themeName || s.serverThemeActive || ''
}

/** the theme in effect; DCS Emerald when none is chosen or the chosen one cannot be found */
export function getEffectiveTheme(): Theme {
  return resolveTheme(effectiveThemeName())?.theme ?? BUILT_IN_BY_NAME[DEFAULT_THEME_NAME]
}

/** true when the effective theme is a server theme whose css has not been fetched yet */
export function effectiveThemeNeedsDoc(): string | null {
  const name = resolveThemeAlias(effectiveThemeName())
  if (!name) return null
  const { docs, metas, localThemes } = useThemeStore.getState()
  if (localThemes.some((t) => t.name === name) || docs[name]) return null
  const meta = metas.find((m) => m.name === name)
  return meta && meta.has_css ? name : null
}

/**
 * Before 4.0 a theme decided the mode itself and the dark/light switch did
 * nothing while one was on. The first time this dashboard runs, the person keeps
 * the look they had: the mode of the theme they wore becomes their choice.
 */
function settleModeOnce(): void {
  const s = useSettingsStore.getState()
  if (s.themeModeMigrated) return
  const name = effectiveThemeName()
  if (name) {
    const found = resolveTheme(name)
    // a server theme that is not cached yet: wait for the list (a later sync finishes this)
    if (!found && useThemeStore.getState().supported === null) return
    if (found && s.theme !== found.theme.mode) s.updateSetting('theme', found.theme.mode)
  }
  s.updateSetting('themeModeMigrated', true)
}

/** what the page shows before the first paint next time (index.html reads it): both looks of the theme and the mode setting */
const BOOT_KEY = 'dcs-boot-look'
let bootWritten = ''
function rememberBootLook(theme: Theme, pref: string): void {
  const look = (m: ThemeMode) => themeLook(theme, m)
  const boot = JSON.stringify({
    v: 1,
    pref,
    name: theme.name,
    css: { dark: buildThemeCss(theme, 'dark'), light: buildThemeCss(theme, 'light') },
    bg: { dark: look('dark').bg, light: look('light').bg },
    meta: { dark: look('dark').surface, light: look('light').surface },
  })
  if (boot === bootWritten) return
  bootWritten = boot
  try {
    localStorage.setItem(BOOT_KEY, boot)
  } catch {
    // storage full or unavailable: the next start shows the stock look for a moment
  }
}

/**
 * Dress the document in the effective theme, in the mode the person chose (or
 * their device prefers). The one place the look is decided; the studio's
 * preview is the only other caller of applyTheme.
 */
export function syncDocumentTheme(): void {
  const settings = useSettingsStore.getState()
  // until the saved settings are read, the look index.html put up stays
  if (!settings.settingsLoaded || isThemePreviewing()) return
  settleModeOnce()
  const pref = useSettingsStore.getState().theme
  const mode = resolveMode(pref)
  const theme = getEffectiveTheme()
  applyTheme(theme, mode)
  rememberBootLook(theme, pref)
  syncNativeLook(theme, mode, pref)
}
