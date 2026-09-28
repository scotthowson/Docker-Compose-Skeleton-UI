// =============================================================================
// Themes — the document a dashboard theme is (schema 1), its validation, the
// palette helpers the engine and the studio share, and the built-in presets.
// The server stores exactly this document (.config/themes/<name>.json).
// =============================================================================

export const THEME_SCHEMA = 1 as const
export const THEME_NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
export const HEX_RE = /^#[0-9a-fA-F]{6}$/
export const THEME_CSS_MAX = 65536
/** a font-family name that is safe to drop into a stylesheet unquoted-or-quoted */
export const FONT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,62}$/

export type ThemeMode = 'dark' | 'light'
export type ThemeRadius = 'sm' | 'md' | 'lg' | 'xl'
export const THEME_RADII: ThemeRadius[] = ['sm', 'md', 'lg', 'xl']

export const PALETTE_KEYS = [
  'accent', 'accentSecondary',
  'bg', 'surface', 'surfaceRaised', 'border',
  'text', 'textMuted',
  'success', 'warning', 'danger', 'info',
] as const
export type PaletteKey = (typeof PALETTE_KEYS)[number]
export type ThemePalette = Record<PaletteKey, string>

/** the keys the server insists on; the rest are derived when missing */
export const PALETTE_REQUIRED: PaletteKey[] = ['accent', 'bg', 'surface', 'text']

export interface Theme {
  schema: 1
  /** ^[a-z0-9][a-z0-9-]{0,39}$ — the file name on the server and the value of data-theme */
  name: string
  title: string
  description: string
  author: string
  version: string
  mode: ThemeMode
  palette: ThemePalette
  /** a font-family that is already available on the device ('' = the dashboard's Inter stack) */
  font: string
  /** overall roundness ('' or 'lg' = as shipped) */
  radius: ThemeRadius | ''
  /** extra CSS, sanitised like custom CSS, at most 64 KB */
  css: string
  /** set by the server: epoch seconds of the last save */
  updated_at?: number
}

/** GET /themes lists the documents without their css */
export interface ThemeMeta extends Omit<Theme, 'css'> {
  has_css?: boolean
}

export interface ThemeListResponse {
  themes: ThemeMeta[]
  /** the theme every dashboard follows; "" = the default look */
  active: string
}

export interface ThemeSaveResponse {
  success: boolean
  theme: Theme
  /** [] or a one-line note that constructs which load or run something were cut out of the css */
  stripped: string[]
  replaced?: boolean
}

export interface ThemeActiveResponse {
  success: boolean
  active: string
}

export const PALETTE_LABELS: Record<PaletteKey, { label: string; hint: string }> = {
  accent: { label: 'Accent', hint: 'Logo gradient, sidebar indicator, text selection' },
  accentSecondary: { label: 'Accent (secondary)', hint: 'The other end of the brand gradient' },
  bg: { label: 'Background', hint: 'The page behind everything' },
  surface: { label: 'Surface', hint: 'Cards, header, sidebar, dialogs' },
  surfaceRaised: { label: 'Raised surface', hint: 'Menus, progress tracks, selected rows' },
  border: { label: 'Border', hint: 'Card edges and dividers' },
  text: { label: 'Text', hint: 'Headings and primary text' },
  textMuted: { label: 'Muted text', hint: 'Labels, captions, secondary text' },
  success: { label: 'Success', hint: 'Running, healthy, primary actions' },
  warning: { label: 'Warning', hint: 'Attention states and pending work' },
  danger: { label: 'Danger', hint: 'Errors and destructive actions' },
  info: { label: 'Info', hint: 'Informational badges and charts' },
}

// ---------------------------------------------------------------------------
// Colour helpers (pure; shared by the engine, the validator and the studio)
// ---------------------------------------------------------------------------

export type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n) || full.length !== 6) return [0, 0, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** "#rrggbb" → "r g b" (the form --color-accent uses) */
export function hexToTriplet(hex: string): string {
  return hexToRgb(hex).join(' ')
}

/** linear blend of two colours: t = 0 gives a, t = 1 gives b */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const k = Math.max(0, Math.min(1, t))
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k])
}

/** WCAG relative luminance */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two colours (1..21) */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** expand "#abc" to "#aabbcc", lowercase; anything else comes back unchanged */
export function normalizeHex(value: string): string {
  const v = value.trim()
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return `#${v.slice(1).split('').map((c) => c + c).join('')}`.toLowerCase()
  if (HEX_RE.test(v)) return v.toLowerCase()
  return v
}

// ---------------------------------------------------------------------------
// The stock palettes: what the dashboard renders with no theme applied. The
// engine diffs a theme against them so an unchanged colour emits no override
// (dcs-emerald is the dark stock palette, so applying it changes nothing).
// ---------------------------------------------------------------------------

export const STOCK_DARK_PALETTE: ThemePalette = {
  accent: '#34d399',          // emerald-400 — the default profile accent
  accentSecondary: '#22d3ee', // cyan-400
  bg: '#020617',              // slate-950
  surface: '#0f172a',         // slate-900
  surfaceRaised: '#1e293b',   // slate-800
  border: '#1e293b',          // what border-white/10 reads as over slate-950
  text: '#f1f5f9',            // slate-100
  textMuted: '#94a3b8',       // slate-400
  success: '#34d399',         // emerald-400
  warning: '#fbbf24',         // amber-400
  danger: '#fb7185',          // rose-400
  info: '#22d3ee',            // cyan-400 — the dashboard's informational hue (toasts, charts)
}

/** what the .light override block in index.css produces */
export const STOCK_LIGHT_PALETTE: ThemePalette = {
  accent: '#34d399',
  accentSecondary: '#22d3ee',
  bg: '#f1f5f9',
  surface: '#ffffff',
  surfaceRaised: '#e2e8f0',
  border: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#94a3b8',
  success: '#059669',
  warning: '#d97706',
  danger: '#e11d48',
  info: '#0891b2',
}

export function stockPalette(mode: ThemeMode): ThemePalette {
  return mode === 'light' ? STOCK_LIGHT_PALETTE : STOCK_DARK_PALETTE
}

// ---------------------------------------------------------------------------
// Validation — turns anything into a Theme or a list of plain-English errors
// ---------------------------------------------------------------------------

export interface ThemeValidation {
  ok: boolean
  errors: string[]
  theme: Theme | null
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/** fill the optional palette keys from the ones present (mirrors what the studio would pick) */
export function completePalette(partial: Partial<Record<PaletteKey, string>>, mode: ThemeMode): ThemePalette {
  const stock = stockPalette(mode)
  const accent = partial.accent ?? stock.accent
  const bg = partial.bg ?? stock.bg
  const surface = partial.surface ?? stock.surface
  const text = partial.text ?? stock.text
  return {
    accent,
    accentSecondary: partial.accentSecondary ?? accent,
    bg,
    surface,
    surfaceRaised: partial.surfaceRaised ?? mixHex(surface, text, 0.08),
    border: partial.border ?? mixHex(surface, text, 0.12),
    text,
    textMuted: partial.textMuted ?? mixHex(text, bg, 0.4),
    success: partial.success ?? stock.success,
    warning: partial.warning ?? stock.warning,
    danger: partial.danger ?? stock.danger,
    info: partial.info ?? stock.info,
  }
}

export function validateTheme(obj: unknown): ThemeValidation {
  const errors: string[] = []
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['A theme is a JSON object'], theme: null }
  }
  const o = obj as Record<string, unknown>

  if (o.schema !== undefined && o.schema !== 1 && o.schema !== '1') {
    errors.push(`schema ${String(o.schema)} is not supported (this dashboard reads schema 1)`)
  }

  const name = typeof o.name === 'string' ? o.name.trim() : ''
  if (!THEME_NAME_RE.test(name)) {
    errors.push('name must be like nord-night: lowercase letters, digits and dashes, up to 40')
  }

  const modeRaw = o.mode === undefined ? 'dark' : o.mode
  const mode: ThemeMode = modeRaw === 'light' ? 'light' : 'dark'
  if (modeRaw !== 'dark' && modeRaw !== 'light') errors.push('mode must be dark or light')

  const paletteIn = o.palette
  const partial: Partial<Record<PaletteKey, string>> = {}
  if (!paletteIn || typeof paletteIn !== 'object' || Array.isArray(paletteIn)) {
    errors.push('palette must be an object of colours')
  } else {
    const p = paletteIn as Record<string, unknown>
    for (const key of PALETTE_KEYS) {
      const v = p[key]
      if (v === undefined || v === null || v === '') continue
      if (typeof v !== 'string' || !HEX_RE.test(normalizeHex(v))) {
        errors.push(`palette.${key} must be a #rrggbb colour`)
        continue
      }
      partial[key] = normalizeHex(v)
    }
    const missing = PALETTE_REQUIRED.filter((k) => !partial[k])
    if (missing.length) errors.push(`palette needs at least accent, bg, surface and text (missing: ${missing.join(', ')})`)
  }

  const font = str(o.font, 64).trim()
  if (font && !FONT_NAME_RE.test(font)) errors.push('font must be a plain font-family name (letters, digits, spaces, dashes)')

  let radius: ThemeRadius | '' = ''
  if (o.radius !== undefined && o.radius !== null && o.radius !== '') {
    if (typeof o.radius === 'string' && (THEME_RADII as string[]).includes(o.radius)) radius = o.radius as ThemeRadius
    else errors.push('radius must be one of sm, md, lg, xl')
  }

  const css = typeof o.css === 'string' ? o.css : ''
  if (o.css !== undefined && o.css !== null && typeof o.css !== 'string') errors.push('css must be a string')
  if (css.length > THEME_CSS_MAX) errors.push('css is limited to 64 KB')

  if (errors.length) return { ok: false, errors, theme: null }

  const theme: Theme = {
    schema: 1,
    name,
    title: str(o.title, 80).trim() || name,
    description: str(o.description, 300).trim(),
    author: str(o.author, 80).trim(),
    version: str(o.version, 20).trim() || '1.0.0',
    mode,
    palette: completePalette(partial, mode),
    font,
    radius,
    css,
  }
  if (typeof o.updated_at === 'number') theme.updated_at = o.updated_at
  return { ok: true, errors: [], theme }
}

/** the document as it travels: pretty JSON without the server's timestamp */
export function themeToJson(theme: Theme): string {
  const { updated_at: _ts, ...doc } = theme
  void _ts
  return JSON.stringify(doc, null, 2)
}

/** a theme from a list entry (the css is not in the listing; '' until GET /themes/{name}) */
export function themeFromMeta(meta: ThemeMeta): Theme {
  const { has_css: _h, ...rest } = meta
  void _h
  return { ...rest, palette: completePalette(rest.palette ?? {}, rest.mode === 'light' ? 'light' : 'dark'), css: '' }
}

// ---------------------------------------------------------------------------
// Built-in presets
// ---------------------------------------------------------------------------

const BUILT_IN = 'DCS'

function preset(t: Omit<Theme, 'schema' | 'version' | 'author' | 'css' | 'font' | 'radius'> & Partial<Pick<Theme, 'version' | 'author' | 'css' | 'font' | 'radius'>>): Theme {
  return { schema: 1, version: '1.0.0', author: BUILT_IN, css: '', font: '', radius: '', ...t }
}

export const DEFAULT_THEME_NAME = 'dcs-emerald'

export const BUILT_IN_THEMES: Theme[] = [
  preset({
    name: 'dcs-emerald',
    title: 'DCS Emerald',
    description: 'The dashboard as shipped: deep slate glass with emerald and cyan.',
    mode: 'dark',
    palette: { ...STOCK_DARK_PALETTE },
  }),
  preset({
    name: 'nord-night',
    title: 'Nord Night',
    description: 'The arctic, bluish palette of the Nord project — calm and low-contrast.',
    mode: 'dark',
    palette: {
      accent: '#88c0d0', accentSecondary: '#81a1c1',
      bg: '#242933', surface: '#2e3440', surfaceRaised: '#3b4252', border: '#434c5e',
      text: '#eceff4', textMuted: '#aab4c5',
      success: '#a3be8c', warning: '#ebcb8b', danger: '#bf616a', info: '#88c0d0',
    },
  }),
  preset({
    name: 'dracula',
    title: 'Dracula',
    description: 'The classic: purple and pink on a deep grey-blue.',
    mode: 'dark',
    palette: {
      accent: '#bd93f9', accentSecondary: '#ff79c6',
      bg: '#1e1f29', surface: '#282a36', surfaceRaised: '#343746', border: '#44475a',
      text: '#f8f8f2', textMuted: '#a3a8c8',
      success: '#50fa7b', warning: '#ffb86c', danger: '#ff5555', info: '#8be9fd',
    },
  }),
  preset({
    name: 'catppuccin-mocha',
    title: 'Catppuccin Mocha',
    description: 'Soothing pastels on a warm dark base, from Catppuccin.',
    mode: 'dark',
    palette: {
      accent: '#cba6f7', accentSecondary: '#f5c2e7',
      bg: '#11111b', surface: '#1e1e2e', surfaceRaised: '#313244', border: '#45475a',
      text: '#cdd6f4', textMuted: '#a6adc8',
      success: '#a6e3a1', warning: '#f9e2af', danger: '#f38ba8', info: '#89b4fa',
    },
  }),
  preset({
    name: 'solarized-dark',
    title: 'Solarized Dark',
    description: "Ethan Schoonover's precision palette — teal and blue on deep sea green.",
    mode: 'dark',
    palette: {
      accent: '#2aa198', accentSecondary: '#268bd2',
      bg: '#00212b', surface: '#002b36', surfaceRaised: '#073642', border: '#0e4b5a',
      text: '#eee8d5', textMuted: '#839496',
      success: '#859900', warning: '#b58900', danger: '#e5534b', info: '#268bd2',
    },
  }),
  preset({
    name: 'gruvbox-dark',
    title: 'Gruvbox Dark',
    description: 'Retro groove: warm earth tones with a burnt-orange accent.',
    mode: 'dark',
    palette: {
      accent: '#fe8019', accentSecondary: '#fabd2f',
      bg: '#1d2021', surface: '#282828', surfaceRaised: '#3c3836', border: '#504945',
      text: '#ebdbb2', textMuted: '#a89984',
      success: '#b8bb26', warning: '#fabd2f', danger: '#fb4934', info: '#83a598',
    },
  }),
  preset({
    name: 'paper-light',
    title: 'Paper Light',
    description: 'Warm off-white paper with teal ink — easy on the eyes in daylight.',
    mode: 'light',
    palette: {
      accent: '#0f766e', accentSecondary: '#4f46e5',
      bg: '#f7f4ed', surface: '#fffdf8', surfaceRaised: '#efebe2', border: '#d9d2c5',
      text: '#2b2722', textMuted: '#77706a',
      success: '#15803d', warning: '#b45309', danger: '#b91c1c', info: '#1d4ed8',
    },
  }),
  preset({
    name: 'rose-pine-dawn',
    title: 'Rosé Pine Dawn',
    description: "Rosé Pine's soft light variant — dawn tones, pine and muted iris.",
    mode: 'light',
    palette: {
      accent: '#d7827e', accentSecondary: '#907aa9',
      bg: '#faf4ed', surface: '#fffaf3', surfaceRaised: '#f2e9e1', border: '#dfdad9',
      text: '#575279', textMuted: '#797593',
      success: '#286983', warning: '#ea9d34', danger: '#b4637a', info: '#56949f',
    },
  }),
]

export const BUILT_IN_BY_NAME: Record<string, Theme> = Object.fromEntries(BUILT_IN_THEMES.map((t) => [t.name, t]))

export function isBuiltInTheme(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILT_IN_BY_NAME, name)
}

/** a fresh, valid document for the studio's "New theme" (starts from the stock look of the mode) */
export function blankTheme(mode: ThemeMode = 'dark'): Theme {
  return {
    schema: 1,
    name: '',
    title: '',
    description: '',
    author: '',
    version: '1.0.0',
    mode,
    palette: { ...stockPalette(mode) },
    font: '',
    radius: '',
    css: '',
  }
}
