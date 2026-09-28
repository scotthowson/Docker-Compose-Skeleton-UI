// =============================================================================
// themeStore — the themes a dashboard can wear: the built-ins, the ones stored
// on the server (GET /themes, cached so the look is right before the first
// answer), and the ones made on this device. Resolves the effective theme
// (personal choice, else the server's active one) and dresses the document.
// =============================================================================

import { create } from 'zustand'
import {
  type Theme,
  type ThemeMeta,
  type ThemeSaveResponse,
  BUILT_IN_BY_NAME,
  themeFromMeta,
  validateTheme,
} from '../../shared/themes'
import { fetchThemes, fetchTheme, saveTheme, deleteTheme, importTheme, setActiveTheme, isThemeApiMissing } from '../api/themes'
import { applyTheme, isThemePreviewing } from '../lib/themeEngine'
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

/** a theme by name: this device's copy first, then the server's, then the built-in */
export function resolveTheme(name: string): { theme: Theme; source: ThemeSource } | null {
  if (!name) return null
  const { docs, metas, localThemes } = useThemeStore.getState()
  const local = localThemes.find((t) => t.name === name)
  if (local) return { theme: local, source: 'local' }
  const doc = docs[name]
  if (doc) return { theme: doc, source: 'server' }
  const meta = metas.find((m) => m.name === name)
  if (meta) {
    // the palette applies from the listing at once; ensureDoc brings the css if it has any
    return { theme: themeFromMeta(meta), source: 'server' }
  }
  const builtIn = BUILT_IN_BY_NAME[name]
  return builtIn ? { theme: builtIn, source: 'built-in' } : null
}

/** the name in effect: the person's choice, else what the server set for everyone */
export function effectiveThemeName(): string {
  const s = useSettingsStore.getState()
  return s.themeName || s.serverThemeActive || ''
}

export function getEffectiveTheme(): Theme | null {
  return resolveTheme(effectiveThemeName())?.theme ?? null
}

/** true when the effective theme is a server theme whose css has not been fetched yet */
export function effectiveThemeNeedsDoc(): string | null {
  const name = effectiveThemeName()
  if (!name) return null
  const { docs, metas, localThemes } = useThemeStore.getState()
  if (localThemes.some((t) => t.name === name) || docs[name]) return null
  const meta = metas.find((m) => m.name === name)
  return meta && meta.has_css ? name : null
}

/**
 * Dress the document in the effective theme. With none chosen, the theme
 * stylesheet goes and the dark/light setting decides the mode, as before.
 */
export function syncDocumentTheme(): void {
  if (isThemePreviewing()) return
  const theme = getEffectiveTheme()
  if (theme) {
    applyTheme(theme)
    return
  }
  applyTheme(null)
  const mode = useSettingsStore.getState().theme
  document.documentElement.classList.toggle('light', mode === 'light')
  document.documentElement.classList.toggle('dark', mode === 'dark')
}
