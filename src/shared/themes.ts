// =============================================================================
// Themes — the document a dashboard theme is (schema 1), its validation, the
// palette helpers the engine and the studio share, and the built-in themes.
// The server stores exactly this document (.config/themes/<name>.json).
//
// A theme is an identity with two looks: a dark palette and a light palette.
// The person picks the theme; the dark/light switch picks the look.
//
//   mode + palette          the primary look (what dashboards before 4.0 read)
//   palette_dark / _light   the two looks (optional; a missing one is derived)
//
// Reading: dark  = palette_dark  ?? (mode === 'dark'  ? palette : derived)
//          light = palette_light ?? (mode === 'light' ? palette : derived)
// Writing (studio saves, exports, copies): both looks, and palette = the look
// of `mode`, so a document from 4.0 still works on an older dashboard.
// =============================================================================

export const THEME_SCHEMA = 1 as const
export const THEME_NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
export const HEX_RE = /^#[0-9a-fA-F]{6}$/
export const THEME_CSS_MAX = 65536
/** a font-family name that is safe to drop into a stylesheet unquoted-or-quoted */
export const FONT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,62}$/

export type ThemeMode = 'dark' | 'light'
export const THEME_MODES: ThemeMode[] = ['dark', 'light']
/** the person's choice of look: dark, light, or whatever the device prefers */
export type ThemeModePreference = ThemeMode | 'system'
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
  /** the primary look: the one `palette` holds and dashboards before 4.0 show */
  mode: ThemeMode
  /** the palette of `mode` */
  palette: ThemePalette
  /** the dark look (missing: `palette` of a dark theme, else derived from the light look) */
  palette_dark?: ThemePalette
  /** the light look (missing: `palette` of a light theme, else derived from the dark look) */
  palette_light?: ThemePalette
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
  accent: { label: 'Accent', hint: 'Logo, active page, highlights' },
  accentSecondary: { label: 'Second accent', hint: 'The other end of the brand gradient' },
  bg: { label: 'Background', hint: 'The page behind everything' },
  surface: { label: 'Surface', hint: 'Cards, header, sidebar, dialogs' },
  surfaceRaised: { label: 'Raised surface', hint: 'Menus, tracks, selected rows' },
  border: { label: 'Border', hint: 'Card edges, inputs, dividers' },
  text: { label: 'Text', hint: 'Headings and body text' },
  textMuted: { label: 'Muted text', hint: 'Labels and captions' },
  success: { label: 'Success', hint: 'Running, healthy, primary actions' },
  warning: { label: 'Warning', hint: 'Attention and pending work' },
  danger: { label: 'Danger', hint: 'Errors and destructive actions' },
  info: { label: 'Info', hint: 'Information and charts' },
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

// OKLCH (Björn Ottosson's OKLab in polar form): lightness 0..1, chroma, hue in degrees.
// OKLab lightness follows what the eye sees, so moving a colour along it keeps its hue.

export interface Oklch { l: number; c: number; h: number }

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)

function oklabToLinear(l: number, a: number, b: number): Rgb {
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ]
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map((v) => toLinear(v / 255))
  const L = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const M = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const S = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const l = 0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S
  const a = 1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S
  const bb = 0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S
  const h = (Math.atan2(bb, a) * 180) / Math.PI
  return { l, c: Math.hypot(a, bb), h: h < 0 ? h + 360 : h }
}

function inGamut(rgb: Rgb): boolean {
  return rgb.every((v) => v >= -0.0001 && v <= 1.0001)
}

/** the most chroma a hue can have at a lightness and still be an sRGB colour */
export function maxChroma(l: number, h: number): number {
  const rad = (h * Math.PI) / 180
  let lo = 0
  let hi = 0.4
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklabToLinear(l, mid * Math.cos(rad), mid * Math.sin(rad)))) lo = mid
    else hi = mid
  }
  return lo
}

/** an OKLCH colour as #rrggbb; chroma the sRGB gamut cannot show is reduced, hue and lightness are kept */
export function oklchToHex({ l, c, h }: Oklch): string {
  const L = Math.max(0, Math.min(1, l))
  const C = Math.min(Math.max(0, c), maxChroma(L, h))
  const rad = (h * Math.PI) / 180
  const lin = oklabToLinear(L, C * Math.cos(rad), C * Math.sin(rad))
  return rgbToHex(lin.map((v) => fromLinear(Math.max(0, Math.min(1, v))) * 255) as Rgb)
}

// ---------------------------------------------------------------------------
// The stock palettes: what the stylesheet renders with no theme overrides
// (dark: the Tailwind classes as compiled; light: the .light block in
// index.css). The engine diffs a look against them so an unchanged colour
// emits no override: DCS Emerald's dark look is the dark stock palette.
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
// Contrast: what a look must reach to be readable
// ---------------------------------------------------------------------------

export interface ContrastRule {
  id: string
  /** plain words for the studio: "Text on background" */
  label: string
  fg: PaletteKey
  bg: PaletteKey
  min: number
}

export interface ContrastCheck extends ContrastRule {
  ratio: number
  ok: boolean
}

/**
 * WCAG AA for a look: text and muted text 4.5:1 on the background and on
 * surfaces; the accents 3:1 (they mark parts of the interface: the active
 * page, focus, the brand gradient); status colours 4.5:1 (they are text too:
 * "Running", error messages). Borders are deliberately faint glass edges and
 * never the only sign of a control, so they only have to stay visible.
 */
export const CONTRAST_RULES: ContrastRule[] = [
  { id: 'text-bg', label: 'Text on background', fg: 'text', bg: 'bg', min: 4.5 },
  { id: 'text-surface', label: 'Text on surface', fg: 'text', bg: 'surface', min: 4.5 },
  { id: 'text-raised', label: 'Text on raised surface', fg: 'text', bg: 'surfaceRaised', min: 4.5 },
  { id: 'muted-bg', label: 'Muted text on background', fg: 'textMuted', bg: 'bg', min: 4.5 },
  { id: 'muted-surface', label: 'Muted text on surface', fg: 'textMuted', bg: 'surface', min: 4.5 },
  { id: 'accent-surface', label: 'Accent on surface', fg: 'accent', bg: 'surface', min: 3 },
  { id: 'accent-bg', label: 'Accent on background', fg: 'accent', bg: 'bg', min: 3 },
  { id: 'accent2-surface', label: 'Second accent on surface', fg: 'accentSecondary', bg: 'surface', min: 3 },
  { id: 'success-surface', label: 'Success on surface', fg: 'success', bg: 'surface', min: 4.5 },
  { id: 'warning-surface', label: 'Warning on surface', fg: 'warning', bg: 'surface', min: 4.5 },
  { id: 'danger-surface', label: 'Danger on surface', fg: 'danger', bg: 'surface', min: 4.5 },
  { id: 'info-surface', label: 'Info on surface', fg: 'info', bg: 'surface', min: 4.5 },
  { id: 'success-bg', label: 'Success on background', fg: 'success', bg: 'bg', min: 4.5 },
  { id: 'warning-bg', label: 'Warning on background', fg: 'warning', bg: 'bg', min: 4.5 },
  { id: 'danger-bg', label: 'Danger on background', fg: 'danger', bg: 'bg', min: 4.5 },
  { id: 'info-bg', label: 'Info on background', fg: 'info', bg: 'bg', min: 4.5 },
  { id: 'border-surface', label: 'Border on surface', fg: 'border', bg: 'surface', min: 1.2 },
  { id: 'border-bg', label: 'Border on background', fg: 'border', bg: 'bg', min: 1.2 },
]

export function checkContrast(p: ThemePalette): ContrastCheck[] {
  return CONTRAST_RULES.map((r) => {
    const ratio = contrastRatio(p[r.fg], p[r.bg])
    return { ...r, ratio, ok: ratio >= r.min }
  })
}

// ---------------------------------------------------------------------------
// Deriving the other look
// ---------------------------------------------------------------------------

type NeutralKey = 'bg' | 'surface' | 'surfaceRaised' | 'border' | 'text' | 'textMuted'
type ColourKey = 'accent' | 'accentSecondary' | 'success' | 'warning' | 'danger' | 'info'
const NEUTRAL_KEYS: NeutralKey[] = ['bg', 'surface', 'surfaceRaised', 'border', 'text', 'textMuted']
const COLOUR_KEYS: ColourKey[] = ['accent', 'accentSecondary', 'success', 'warning', 'danger', 'info']
/** the neutrals whose tint says how coloured a look's glass is (mid-lightness ones: near-white and near-black hold no tint) */
const TINT_KEYS: NeutralKey[] = ['bg', 'surfaceRaised', 'border']
/** the contrast a derived colour reaches on the background and the surface of its look (AA plus a margin) */
const COLOUR_MIN: Record<ColourKey, number> = { accent: 3.1, accentSecondary: 3.1, success: 4.6, warning: 4.6, danger: 4.6, info: 4.6 }

// The features of a palette snap to grids and a derived look is built exactly at the
// grid points, so reading a derived look back gives the same features: deriving there
// and back again lands on the same palettes.
const NEUTRAL_HUE_STEP = 10
const TINT_STEP = 0.5
const TINT_MAX = 1.5
const CHROMA_STEP = 0.01
/** the hue grid of a colour: finer for vivid colours, coarser for greyish ones (whose hue 8-bit rounding moves more) */
const hueStepFor = (c: number) => (c >= 0.1 ? 2 : c >= 0.05 ? 4 : c >= 0.025 ? 8 : 20)

const snap = (v: number, step: number) => Math.round(v / step) * step
const snapHue = (h: number, step: number) => ((snap(h, step) % 360) + 360) % 360
const floorTo = (v: number, step: number) => Math.floor(v / step + 1e-9) * step

/** how much of the chroma its lightness and hue allow a colour uses (0 = grey, 1 = as vivid as sRGB goes) */
function saturation({ l, c, h }: Oklch): number {
  const m = maxChroma(l, h)
  return m > 1e-4 ? Math.min(1, c / m) : 0
}

/** the palette keys in their canonical order */
function ordered(p: Record<PaletteKey, string>): ThemePalette {
  return Object.fromEntries(PALETTE_KEYS.map((k) => [k, p[k]])) as ThemePalette
}

/** a colour moved away from its backgrounds (darker in a light look, lighter in a dark one) until it reaches the contrast */
function reachContrast(l: number, c: number, h: number, against: string[], min: number, mode: ThemeMode): string {
  let hex = oklchToHex({ l, c, h })
  const step = mode === 'light' ? -0.004 : 0.004
  for (let i = 0; i < 250 && !against.every((b) => contrastRatio(hex, b) >= min); i++) {
    l = Math.max(0, Math.min(1, l + step))
    hex = oklchToHex({ l, c, h })
  }
  return hex
}

interface DeriveFeatures {
  /** hue of the neutrals (on a 10° grid; 0 when they are grey) */
  neutralHue: number
  /** how saturated the neutrals are, relative to the stock slate of the same look (0 = grey) */
  tint: number
  /** each colour's hue (as measured) and chroma (on the grid) */
  colours: Record<ColourKey, { h: number; c: number }>
}

function features(p: ThemePalette, from: ThemeMode): DeriveFeatures {
  const base = NEUTRAL_TARGET[from]
  // hue: the neutrals' chroma-weighted mean direction (greys add nothing)
  let x = 0
  let y = 0
  for (const k of NEUTRAL_KEYS) {
    const o = hexToOklch(p[k])
    x += o.c * Math.cos((o.h * Math.PI) / 180)
    y += o.c * Math.sin((o.h * Math.PI) / 180)
  }
  const measured = TINT_KEYS.reduce((n, k) => n + saturation(hexToOklch(p[k])), 0) / TINT_KEYS.reduce((n, k) => n + Math.max(base[k].s, 0.02), 0)
  const tint = Math.min(TINT_MAX, snap(measured, TINT_STEP))
  const neutralHue = tint === 0 || Math.hypot(x, y) < 1e-6 ? 0 : snapHue((Math.atan2(y, x) * 180) / Math.PI, NEUTRAL_HUE_STEP)
  const colours = {} as DeriveFeatures['colours']
  for (const k of COLOUR_KEYS) {
    const o = hexToOklch(p[k])
    colours[k] = { h: o.h, c: snap(o.c, CHROMA_STEP) }
  }
  return { neutralHue, tint, colours }
}

/** the neutrals of a look: the stock lightness of that look, as saturated as the stock slate times the tint, in the source's hue */
function neutralsFor(f: DeriveFeatures, mode: ThemeMode): Record<NeutralKey, string> {
  const t = NEUTRAL_TARGET[mode]
  const chroma = (k: NeutralKey) => Math.min(1, t[k].s * f.tint) * maxChroma(t[k].l, f.neutralHue)
  const out = {} as Record<NeutralKey, string>
  for (const k of ['bg', 'surface', 'surfaceRaised', 'border', 'text'] as NeutralKey[]) {
    out[k] = oklchToHex({ l: t[k].l, c: chroma(k), h: f.neutralHue })
  }
  out.textMuted = reachContrast(t.textMuted.l, chroma('textMuted'), f.neutralHue, [out.bg, out.surface], 4.6, mode)
  return out
}

/**
 * The other look of a palette: `from` is the mode `p` was made for; the result is
 * the palette of the other mode. The neutrals come from the stock palette of that
 * mode tinted toward the source's neutral hue; the accents and status colours keep
 * their hue (and as much chroma as both looks can show), take the lightness their
 * role has in the stock look, then move just far enough to reach AA on the new
 * background and surface. Deterministic; deriving back and forth is stable.
 */
export function derivePalette(p: ThemePalette, from: ThemeMode): ThemePalette {
  const to: ThemeMode = from === 'dark' ? 'light' : 'dark'
  const f = features(p, from)
  const twins = { dark: neutralsFor(f, 'dark'), light: neutralsFor(f, 'light') }
  const out = { ...twins[to] } as Record<PaletteKey, string>
  for (const k of COLOUR_KEYS) {
    const measured = f.colours[k]
    const place = (m: ThemeMode, chroma: number, hue: number) => reachContrast(COLOUR_TARGET[m][k], chroma, hue, [twins[m].bg, twins[m].surface], COLOUR_MIN[k], m)
    // settle on a chroma both looks can show at the lightness this role takes there (the
    // colour is never clipped), and on the hue grid of that chroma: a round trip reads
    // the same chroma and hue back
    let chroma = measured.c
    let h = chroma === 0 ? 0 : snapHue(measured.h, hueStepFor(chroma))
    for (let i = 0; i < 8; i++) {
      const next = floorTo(Math.min(chroma, maxChroma(hexToOklch(place('dark', chroma, h)).l, h), maxChroma(hexToOklch(place('light', chroma, h)).l, h)), CHROMA_STEP)
      const nextHue = next === 0 ? 0 : snapHue(measured.h, hueStepFor(next))
      if (next === chroma && nextHue === h) break
      chroma = next
      h = nextHue
    }
    out[k] = place(to, chroma, h)
  }
  return ordered(out)
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

/** a palette object as sent: its known keys as #rrggbb, or errors named after the field */
function readPalette(value: unknown, field: string, errors: string[]): Partial<Record<PaletteKey, string>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${field} must be an object of colours`)
    return null
  }
  const p = value as Record<string, unknown>
  const partial: Partial<Record<PaletteKey, string>> = {}
  let bad = false
  for (const key of PALETTE_KEYS) {
    const v = p[key]
    if (v === undefined || v === null || v === '') continue
    if (typeof v !== 'string' || !HEX_RE.test(normalizeHex(v))) {
      errors.push(`${field}.${key} must be a #rrggbb colour`)
      bad = true
      continue
    }
    partial[key] = normalizeHex(v)
  }
  const missing = PALETTE_REQUIRED.filter((k) => !partial[k])
  if (missing.length) {
    errors.push(`${field} needs at least accent, bg, surface and text (missing: ${missing.join(', ')})`)
    return null
  }
  return bad ? null : partial
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

  // both looks are optional; `palette` may be left out when the look of `mode` is there
  const present = (v: unknown) => v !== undefined && v !== null
  const darkIn = present(o.palette_dark) ? readPalette(o.palette_dark, 'palette_dark', errors) : null
  const lightIn = present(o.palette_light) ? readPalette(o.palette_light, 'palette_light', errors) : null
  const primaryLook = mode === 'light' ? lightIn : darkIn
  const partial = present(o.palette) || !primaryLook ? readPalette(o.palette, 'palette', errors) : primaryLook

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

  if (errors.length || !partial) return { ok: false, errors, theme: null }

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
  if (darkIn) theme.palette_dark = completePalette(darkIn, 'dark')
  if (lightIn) theme.palette_light = completePalette(lightIn, 'light')
  if (typeof o.updated_at === 'number') theme.updated_at = o.updated_at
  return { ok: true, errors: [], theme }
}

// ---------------------------------------------------------------------------
// The two looks of a theme
// ---------------------------------------------------------------------------

export interface ThemeLooks {
  dark: ThemePalette
  light: ThemePalette
  /** the look the document does not carry (derived here), or null when it carries both */
  derived: ThemeMode | null
}

const looksCache = new WeakMap<Theme, ThemeLooks>()

/** both looks of a theme by the reading rule (a derived look is computed once per document) */
export function themeLooks(theme: Theme): ThemeLooks {
  const hit = looksCache.get(theme)
  if (hit) return hit
  const primary: ThemeMode = theme.mode === 'light' ? 'light' : 'dark'
  const dark = theme.palette_dark ?? (primary === 'dark' ? theme.palette : null)
  const light = theme.palette_light ?? (primary === 'light' ? theme.palette : null)
  let looks: ThemeLooks
  if (dark && light) looks = { dark, light, derived: null }
  else if (dark) looks = { dark, light: derivePalette(dark, 'dark'), derived: 'light' }
  else looks = { dark: derivePalette(light as ThemePalette, 'light'), light: light as ThemePalette, derived: 'dark' }
  looksCache.set(theme, looks)
  return looks
}

export function themeLook(theme: Theme, mode: ThemeMode): ThemePalette {
  return themeLooks(theme)[mode]
}

/** the writing rule: both looks spelled out, `palette` = the look of `mode` */
export function withBothLooks(theme: Theme): Theme {
  const { dark, light } = themeLooks(theme)
  return { ...theme, palette: { ...(theme.mode === 'light' ? light : dark) }, palette_dark: { ...dark }, palette_light: { ...light } }
}

/** the document as it travels (saves, exports, copies): both looks, no server timestamp, a stable key order */
export function themeToJson(theme: Theme): string {
  const t = withBothLooks(theme)
  const doc = {
    schema: 1,
    name: t.name,
    title: t.title,
    description: t.description,
    author: t.author,
    version: t.version,
    mode: t.mode,
    palette: ordered(t.palette),
    palette_dark: ordered(t.palette_dark as ThemePalette),
    palette_light: ordered(t.palette_light as ThemePalette),
    font: t.font,
    radius: t.radius,
    css: t.css,
  }
  return JSON.stringify(doc, null, 2)
}

/** a theme from a list entry (the css is not in the listing; '' until GET /themes/{name}) */
export function themeFromMeta(meta: ThemeMeta): Theme {
  const { has_css: _h, palette_dark: dark, palette_light: light, ...rest } = meta
  void _h
  const mode: ThemeMode = rest.mode === 'light' ? 'light' : 'dark'
  const theme: Theme = { ...rest, mode, palette: completePalette(rest.palette ?? {}, mode), css: '' }
  if (dark) theme.palette_dark = completePalette(dark, 'dark')
  if (light) theme.palette_light = completePalette(light, 'light')
  return theme
}

// ---------------------------------------------------------------------------
// Built-in themes: eight identities, each with a hand-tuned dark and light look
// taken from the palette's own dark/light siblings. Where an official colour
// misses AA as text on its surface, only its lightness moved (hue and chroma
// kept) until it reaches it; scripts/check-themes.mjs holds them to that.
// ---------------------------------------------------------------------------

const BUILT_IN = 'DCS'

export const DEFAULT_THEME_NAME = 'dcs-emerald'

interface BuiltInSpec {
  name: string
  title: string
  description: string
  /** the primary look: what a dashboard before 4.0 shows, and what people who picked it then saw */
  mode: ThemeMode
  dark: ThemePalette
  light: ThemePalette
  /** what the family calls its two looks */
  looks: { dark: string; light: string }
}

/** twelve hex colours in PALETTE_KEYS order */
function pal(v: string): ThemePalette {
  const hexes = v.trim().split(/\s+/)
  return Object.fromEntries(PALETTE_KEYS.map((k, i) => [k, `#${hexes[i]}`])) as ThemePalette
}

// accent accentSecondary | bg surface surfaceRaised border | text textMuted | success warning danger info
const SPECS: BuiltInSpec[] = [
  {
    name: 'dcs-emerald',
    title: 'DCS Emerald',
    description: 'The dashboard as shipped: slate glass with emerald and cyan.',
    mode: 'dark',
    dark: { ...STOCK_DARK_PALETTE },
    light: pal('059669 0891b2  f1f5f9 ffffff e2e8f0 cbd5e1  0f172a 475569  047857 b35207 be123c 0e7490'),
    looks: { dark: 'Slate', light: 'Daylight' },
  },
  {
    name: 'nord-night',
    title: 'Nord',
    description: 'Arctic blues from the Nord project: Polar Night and Snow Storm.',
    mode: 'dark',
    dark: pal('88c0d0 81a1c1  242933 2e3440 3b4252 434c5e  eceff4 b4bccb  a3be8c ebcb8b e38189 88c0d0'),
    light: pal('5e81ac 6786a5  e5e9f0 eceff4 d8dee9 c9d1de  2e3440 4c566a  566e40 806322 a54a54 476993'),
    looks: { dark: 'Polar Night', light: 'Snow Storm' },
  },
  {
    name: 'dracula',
    title: 'Dracula',
    description: 'Purple and pink on deep grey-blue, with Alucard for daylight.',
    mode: 'dark',
    dark: pal('bd93f9 ff79c6  21222c 282a36 343746 44475a  f8f8f2 9aa3c8  50fa7b ffb86c fa5e5b 8be9fd'),
    light: pal('644ac9 a3144d  f4efd9 fffbeb efe9d1 dcd6c0  1f1f1f 6c664b  14710a a34d14 c63525 036a96'),
    looks: { dark: 'Dracula', light: 'Alucard' },
  },
  {
    name: 'catppuccin-mocha',
    title: 'Catppuccin',
    description: 'Soothing pastels: Mocha after dark, Latte by day.',
    mode: 'dark',
    dark: pal('cba6f7 f5c2e7  11111b 1e1e2e 313244 45475a  cdd6f4 a6adc8  a6e3a1 f9e2af f38ba8 89b4fa'),
    light: pal('8839ef ca59ad  e6e9ef eff1f5 ccd0da bcc0cc  4c4f69 5c5f77  267712 935b08 cf0536 135cea'),
    looks: { dark: 'Mocha', light: 'Latte' },
  },
  {
    name: 'solarized-dark',
    title: 'Solarized',
    description: "Ethan Schoonover's precision palette, in its dark and light forms.",
    mode: 'dark',
    dark: pal('2aa198 268bd2  00212b 002b36 073642 0b4150  eee8d5 839496  859900 b58900 fc534a 3395dd'),
    light: pal('0c9289 2288cf  eee8d5 fdf6e3 e6dfca d6cfb9  073642 546a71  5f6d0f 81620e cb1b1f 136ba6'),
    looks: { dark: 'Dark', light: 'Light' },
  },
  {
    name: 'gruvbox-dark',
    title: 'Gruvbox',
    description: 'Retro groove: warm earth tones with a burnt-orange accent.',
    mode: 'dark',
    dark: pal('fe8019 fabd2f  1d2021 282828 3c3836 504945  ebdbb2 a89984  b8bb26 fabd2f fb5843 83a598'),
    light: pal('af3a03 b2730e  f2e5bc fbf1c7 ebdbb2 d5c4a1  3c3836 665c54  6c6809 8e5a01 9d0006 076678'),
    looks: { dark: 'Dark', light: 'Light' },
  },
  {
    name: 'rose-pine-dawn',
    title: 'Rosé Pine',
    description: 'Soft rose, pine and iris: Rosé Pine at night, Dawn by day.',
    mode: 'light',
    dark: pal('ebbcba c4a7e7  191724 1f1d2e 26233a 403d52  e0def4 908caa  4091b2 f6c177 eb6f92 9ccfd8'),
    light: pal('c87471 907aa9  faf4ed fffaf3 f2e9e1 dfdad9  575279 6e6a86  286983 9b6203 a5566d 397782'),
    looks: { dark: 'Main', light: 'Dawn' },
  },
  {
    name: 'paper-light',
    title: 'Paper',
    description: 'Warm paper and teal ink, with an ink-dark look for the evening.',
    mode: 'light',
    dark: pal('2dd4bf a5b4fc  171411 1f1b17 29241f 3a332b  ece5d8 a89d8e  4ade80 fbbf24 f87171 93c5fd'),
    light: pal('0f766e 4f46e5  f5f1e8 fffdf8 ede7db d9d1c2  2b2722 6b645c  0f7d3a b15003 b91c1c 1d4ed8'),
    looks: { dark: 'Ink', light: 'Paper' },
  },
]

export const BUILT_IN_THEMES: Theme[] = SPECS.map((s) => ({
  schema: 1,
  name: s.name,
  title: s.title,
  description: s.description,
  author: BUILT_IN,
  version: '2.0.0',
  mode: s.mode,
  palette: { ...(s.mode === 'light' ? s.light : s.dark) },
  palette_dark: { ...s.dark },
  palette_light: { ...s.light },
  font: '',
  radius: '',
  css: '',
}))

export const BUILT_IN_BY_NAME: Record<string, Theme> = Object.fromEntries(BUILT_IN_THEMES.map((t) => [t.name, t]))

/** what each built-in family calls its two looks ("Mocha", "Latte") */
export const BUILT_IN_LOOK_NAMES: Record<string, { dark: string; light: string }> = Object.fromEntries(SPECS.map((s) => [s.name, s.looks]))

/** old theme names that now mean another theme (none renamed so far; a rename adds its old name here so saved choices keep working) */
export const THEME_ALIASES: Record<string, string> = {}

export function resolveThemeAlias(name: string): string {
  return Object.prototype.hasOwnProperty.call(THEME_ALIASES, name) ? THEME_ALIASES[name] : name
}

export function isBuiltInTheme(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILT_IN_BY_NAME, resolveThemeAlias(name))
}

// The single palette each built-in had before it became a pair (DCS 3.9). "Set for
// everyone" stored such a copy on the server; a copy that is exactly that palette is
// the old built-in, and the built-in's pair stands in for it.
const LEGACY_BUILT_IN: Record<string, string> = {
  'dcs-emerald': '34d399 22d3ee 020617 0f172a 1e293b 1e293b f1f5f9 94a3b8 34d399 fbbf24 fb7185 22d3ee',
  'nord-night': '88c0d0 81a1c1 242933 2e3440 3b4252 434c5e eceff4 aab4c5 a3be8c ebcb8b bf616a 88c0d0',
  dracula: 'bd93f9 ff79c6 1e1f29 282a36 343746 44475a f8f8f2 a3a8c8 50fa7b ffb86c ff5555 8be9fd',
  'catppuccin-mocha': 'cba6f7 f5c2e7 11111b 1e1e2e 313244 45475a cdd6f4 a6adc8 a6e3a1 f9e2af f38ba8 89b4fa',
  'solarized-dark': '2aa198 268bd2 00212b 002b36 073642 0e4b5a eee8d5 839496 859900 b58900 e5534b 268bd2',
  'gruvbox-dark': 'fe8019 fabd2f 1d2021 282828 3c3836 504945 ebdbb2 a89984 b8bb26 fabd2f fb4934 83a598',
  'paper-light': '0f766e 4f46e5 f7f4ed fffdf8 efebe2 d9d2c5 2b2722 77706a 15803d b45309 b91c1c 1d4ed8',
  'rose-pine-dawn': 'd7827e 907aa9 faf4ed fffaf3 f2e9e1 dfdad9 575279 797593 286983 ea9d34 b4637a 56949f',
}

function samePalette(a: ThemePalette | undefined, b: ThemePalette | undefined): boolean {
  return !!a && !!b && PALETTE_KEYS.every((k) => normalizeHex(a[k] ?? '') === normalizeHex(b[k] ?? ''))
}

/**
 * True when a stored document is only a copy of a built-in: its current pair, or
 * the single palette it had before 4.0. The built-in then wins, so a server that
 * keeps an old copy shows the tuned pair instead of a derived look.
 */
export function isBuiltInCopy(doc: Pick<Theme, 'name' | 'palette'> & Partial<Pick<Theme, 'palette_dark' | 'palette_light' | 'css' | 'font' | 'radius'>>): boolean {
  const b = BUILT_IN_BY_NAME[doc.name]
  if (!b || (doc.css ?? '') !== '' || (doc.font ?? '') !== '' || (doc.radius ?? '') !== '') return false
  if (samePalette(doc.palette_dark, b.palette_dark) && samePalette(doc.palette_light, b.palette_light)) return true
  const legacy = LEGACY_BUILT_IN[doc.name]
  return !doc.palette_dark && !doc.palette_light && !!legacy && samePalette(doc.palette, pal(legacy))
}

/** a fresh document for the studio's "New theme": both looks of DCS Emerald */
export function blankTheme(mode: ThemeMode = 'dark'): Theme {
  const base = BUILT_IN_BY_NAME[DEFAULT_THEME_NAME]
  return {
    schema: 1,
    name: '',
    title: '',
    description: '',
    author: '',
    version: '1.0.0',
    mode,
    palette: { ...themeLook(base, mode) },
    palette_dark: { ...themeLook(base, 'dark') },
    palette_light: { ...themeLook(base, 'light') },
    font: '',
    radius: '',
    css: '',
  }
}

// The stock lightness and chroma of every role in each look, read from DCS Emerald's
// two looks: derivePalette rebuilds neutrals from them and gives colour roles their lightness.
const EMERALD = SPECS[0]
function targetsOf(p: ThemePalette): Record<NeutralKey, { l: number; s: number }> {
  return Object.fromEntries(NEUTRAL_KEYS.map((k) => { const o = hexToOklch(p[k]); return [k, { l: o.l, s: saturation(o) }] })) as Record<NeutralKey, { l: number; s: number }>
}
const NEUTRAL_TARGET: Record<ThemeMode, Record<NeutralKey, { l: number; s: number }>> = { dark: targetsOf(EMERALD.dark), light: targetsOf(EMERALD.light) }
const COLOUR_TARGET: Record<ThemeMode, Record<ColourKey, number>> = {
  dark: Object.fromEntries(COLOUR_KEYS.map((k) => [k, hexToOklch(EMERALD.dark[k]).l])) as Record<ColourKey, number>,
  light: Object.fromEntries(COLOUR_KEYS.map((k) => [k, hexToOklch(EMERALD.light[k]).l])) as Record<ColourKey, number>,
}
