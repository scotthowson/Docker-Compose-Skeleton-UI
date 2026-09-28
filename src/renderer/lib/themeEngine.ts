// =============================================================================
// themeEngine — turns a theme document into the dashboard's look.
//
// The app hard-codes ~5,300 Tailwind colour classes, so a theme works the way
// light mode works: a palette becomes an override stylesheet (<style id=
// "dcs-theme">) that restyles the classes the .light block in index.css already
// targets, with !important and a selector (html[data-theme] .class) that beats
// both the utilities and the .light block. Every mapping lives here, so a
// palette change is a full re-theme.
//
// A colour that equals the stock look of the theme's mode emits nothing, which
// is why "dcs-emerald" (the dark stock palette) renders pixel-identical to the
// untouched dashboard and why a theme that only changes the status colours
// leaves the neutral glass exactly as Tailwind compiled it.
// =============================================================================

import {
  type Theme,
  type ThemeMode,
  type ThemePalette,
  type ThemeRadius,
  hexToTriplet,
  mixHex,
  stockPalette,
  FONT_NAME_RE,
} from '../../shared/themes'
import { sanitizeCss } from './cssSanitize'

export const THEME_STYLE_ID = 'dcs-theme'
const ROOT = 'html[data-theme]'
const ROOT_LIGHT = 'html[data-theme].light'
const DEFAULT_META_COLOR = '#0f172a'

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** escape a Tailwind class name for use in a selector (bg-white/[0.03] → bg-white\/\[0\.03\]) */
function esc(cls: string): string {
  return cls.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`)
}

/** "#rrggbb" + alpha → rgb(r g b / a) */
function rgba(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  return `rgb(${hexToTriplet(hex)} / ${+a.toFixed(3)})`
}

function shade(hex: string, t: number): string {
  return mixHex(hex, '#000000', t)
}

/** the alpha a Tailwind opacity suffix means: "5" → 0.05, "[0.03]" → 0.03 */
function alphaOf(suffix: string): number {
  if (suffix.startsWith('[')) return parseFloat(suffix.slice(1, -1))
  return parseInt(suffix, 10) / 100
}

/** the selector a utility class (with an optional variant prefix) needs */
function selectorFor(cls: string): string {
  if (cls.startsWith('hover:')) return `${ROOT} .${esc(cls)}:hover`
  if (cls.startsWith('focus:')) return `${ROOT} .${esc(cls)}:focus`
  if (cls.startsWith('group-hover:')) return `${ROOT} .group:hover .${esc(cls)}`
  if (cls.startsWith('placeholder:') || cls.startsWith('placeholder-')) return `${ROOT} .${esc(cls)}::placeholder`
  if (cls.startsWith('divide-')) return `${ROOT} .${esc(cls)} > :not([hidden]) ~ :not([hidden])`
  return `${ROOT} .${esc(cls)}`
}

/** the declaration a utility class sets, with the colour swapped */
function declarationFor(cls: string, value: string): string {
  const base = cls.replace(/^(hover|focus|group-hover|placeholder):/, '')
  if (base.startsWith('placeholder')) return `color: ${value} !important`
  if (base.startsWith('bg-')) return `background-color: ${value} !important`
  if (base.startsWith('text-')) return `color: ${value} !important`
  if (base.startsWith('border-t-')) return `border-top-color: ${value} !important`
  if (base.startsWith('border-b-')) return `border-bottom-color: ${value} !important`
  if (base.startsWith('border-l-')) return `border-left-color: ${value} !important`
  if (base.startsWith('border-r-')) return `border-right-color: ${value} !important`
  if (base.startsWith('border-')) return `border-color: ${value} !important`
  if (base.startsWith('divide-')) return `border-color: ${value} !important`
  if (base.startsWith('ring-offset-')) return `--tw-ring-offset-color: ${value} !important`
  if (base.startsWith('ring-')) return `--tw-ring-color: ${value} !important`
  if (base.startsWith('shadow-')) return `--tw-shadow-color: ${value} !important`
  if (base.startsWith('from-')) return `--tw-gradient-from: ${value} var(--tw-gradient-from-position) !important`
  if (base.startsWith('to-')) return `--tw-gradient-to: ${value} var(--tw-gradient-to-position) !important`
  if (base.startsWith('via-')) return `--tw-gradient-stops: var(--tw-gradient-from), ${value} var(--tw-gradient-via-position), var(--tw-gradient-to) !important`
  if (base.startsWith('fill-')) return `fill: ${value} !important`
  if (base.startsWith('stroke-')) return `stroke: ${value} !important`
  if (base.startsWith('accent-')) return `accent-color: ${value} !important`
  return `color: ${value} !important`
}

/**
 * Collects rules and merges the selectors that share a declaration. Hand-written
 * rules (elements, components like .glass, variables) come out BEFORE the class
 * rules, so an explicit utility on an element keeps winning the way it does in
 * Tailwind's own cascade (components layer, then utilities).
 */
class Sheet {
  private groups = new Map<string, string[]>()
  private raw: string[] = []

  /** a utility class → its colour */
  cls(cls: string, value: string): void {
    const decl = declarationFor(cls, value)
    const list = this.groups.get(decl) ?? []
    list.push(selectorFor(cls))
    this.groups.set(decl, list)
  }

  /** several classes → one colour */
  each(classes: string[], value: string): void {
    for (const c of classes) this.cls(c, value)
  }

  /** a hand-written rule (selectors are already complete) */
  rule(selectors: string, body: string): void {
    this.raw.push(`${selectors} { ${body} }`)
  }

  toString(): string {
    const out: string[] = [...this.raw]
    for (const [decl, selectors] of this.groups) out.push(`${selectors.join(',\n')} { ${decl} }`)
    return out.join('\n')
  }

  get size(): number {
    return this.groups.size + this.raw.length
  }
}

// ---------------------------------------------------------------------------
// The palette → class map
// ---------------------------------------------------------------------------

/** the neutral classes: page, surfaces, glass, borders, text ramp, translucent tints */
function emitNeutrals(s: Sheet, p: ThemePalette, mode: ThemeMode): void {
  const light = mode === 'light'
  const { bg, surface, surfaceRaised: raised, border, text, textMuted: muted } = p

  // Text ramp. Dark: dimmer = toward the background. Light: the dashboard's
  // slate-500/600 read darker than slate-400, so dimmer steps go toward text.
  const t100 = text
  const t200 = mixHex(text, muted, light ? 0.1 : 0.16)
  const t300 = mixHex(text, muted, light ? 0.3 : 0.4)
  const t400 = muted
  const t500 = light ? mixHex(muted, text, 0.35) : mixHex(muted, bg, 0.3)
  const t600 = light ? mixHex(muted, text, 0.55) : mixHex(muted, bg, 0.5)
  const t700 = light ? mixHex(muted, text, 0.7) : mixHex(muted, bg, 0.65)
  // Neutral solids (slate-500/600/700 equivalents) sit between the raised surface and muted text
  const n500 = mixHex(raised, muted, 0.6)
  const n600 = mixHex(raised, muted, 0.36)
  const n700 = mixHex(raised, muted, 0.2)

  // ── Page ──
  s.rule(`${ROOT} body, ${ROOT} .theme-bg`, `background-color: ${bg} !important; color: ${text} !important`)

  // ── Surfaces ──
  s.cls('bg-slate-950', bg)
  for (const a of ['30', '40', '50', '60', '70', '85', '95']) s.cls(`bg-slate-950/${a}`, rgba(bg, alphaOf(a)))
  s.cls('from-slate-950', bg)
  s.cls('bg-slate-900', surface)
  for (const a of ['40', '50', '60', '80', '85', '90', '95', '97', '98']) s.cls(`bg-slate-900/${a}`, rgba(surface, alphaOf(a)))
  s.cls('hover:bg-slate-900/80', rgba(surface, 0.8))
  s.cls('bg-slate-800', raised)
  for (const a of ['20', '30', '40', '50', '60', '70', '80', '90', '95']) s.cls(`bg-slate-800/${a}`, rgba(raised, alphaOf(a)))
  s.cls('hover:bg-slate-800', raised)
  s.cls('hover:bg-slate-800/50', rgba(raised, 0.5))
  s.cls('hover:bg-slate-800/60', rgba(raised, 0.6))
  s.each(['from-slate-800/60', 'to-slate-800/60'], rgba(raised, 0.6))
  s.cls('bg-slate-700', n700)
  for (const a of ['40', '50', '60', '80', '90']) s.cls(`bg-slate-700/${a}`, rgba(n700, alphaOf(a)))
  s.cls('via-slate-700/40', rgba(n700, 0.4))
  s.cls('via-slate-700/30', rgba(n700, 0.3))
  s.cls('bg-slate-600', n600)
  s.cls('bg-slate-600/40', rgba(n600, 0.4))
  s.cls('bg-slate-600/80', rgba(n600, 0.8))
  s.cls('to-slate-600/20', rgba(n600, 0.2))
  s.cls('bg-slate-500', n500)
  for (const a of ['8', '10', '15', '20']) s.cls(`bg-slate-500/${a}`, rgba(n500, alphaOf(a)))
  s.cls('from-slate-500/20', rgba(n500, 0.2))
  s.cls('fill-slate-500', n500)
  s.cls('bg-slate-400', muted)
  s.cls('ring-offset-slate-900', surface)

  // ── Glass components (@apply'd in index.css, so the class map cannot reach them) ──
  s.rule(`${ROOT} .glass`, `background-color: ${rgba(surface, 0.75)} !important; border-color: ${border} !important`)
  s.rule(`${ROOT} .glass-subtle, ${ROOT} .glass-card, ${ROOT} .glass-1`, `background-color: ${rgba(surface, 0.65)} !important; border-color: ${rgba(border, 0.6)} !important`)
  s.rule(`${ROOT} .glass-card:hover`, `border-color: ${border} !important`)
  s.rule(`${ROOT} .glass-hover:hover`, `background-color: ${rgba(raised, 0.6)} !important; border-color: ${mixHex(border, text, 0.15)} !important`)
  s.rule(`${ROOT} .glass-2`, `background-color: ${rgba(raised, 0.6)} !important; border-color: ${rgba(border, 0.8)} !important`)
  s.rule(`${ROOT} .glass-3`, `background-color: ${rgba(raised, 0.8)} !important; border-color: ${border} !important`)
  s.rule(`${ROOT} .skeleton`, `background: linear-gradient(90deg, ${rgba(raised, 0.6)}, ${rgba(n700, 0.4)}, ${rgba(raised, 0.6)}) !important; background-size: 200% 100% !important`)

  // ── Borders: the border-white/* family reads the palette border at a strength that follows the class ──
  s.rule(`${ROOT} .border-t, ${ROOT} .border-b, ${ROOT} .border-l, ${ROOT} .border-r`, `border-color: ${rgba(border, 0.55)} !important`)
  const borderFor = (suffix: string): string => {
    const a = alphaOf(suffix)
    if (a <= 0.03) return rgba(border, 0.45)
    if (a <= 0.05) return rgba(border, 0.55)
    if (a <= 0.06) return rgba(border, 0.65)
    if (a <= 0.08) return rgba(border, 0.8)
    if (a <= 0.12) return border
    if (a <= 0.15) return mixHex(border, text, 0.2)
    if (a <= 0.2) return mixHex(border, text, 0.3)
    if (a <= 0.3) return mixHex(border, text, 0.45)
    return mixHex(border, text, 0.55)
  }
  for (const a of ['[0.02]', '[0.03]', '[0.04]', '5', '[0.05]', '[0.06]', '[0.08]', '10', '[0.10]', '[0.12]', '15', '[0.15]', '20', '30', '40']) {
    s.cls(`border-white/${a}`, borderFor(a))
  }
  for (const a of ['5', '10', '15', '[0.15]', '20', '30']) s.cls(`hover:border-white/${a}`, borderFor(a))
  s.each(['divide-white/[0.03]', 'divide-white/[0.04]'], rgba(border, 0.5))
  s.cls('border-slate-500', n500)
  for (const a of ['10', '15', '20', '30', '50']) s.cls(`border-slate-500/${a}`, rgba(n500, alphaOf(a)))
  s.cls('border-slate-400', muted)
  s.cls('border-t-slate-400', muted)
  s.cls('border-slate-600', n600)
  s.cls('border-slate-600/50', rgba(n600, 0.5))
  s.cls('border-slate-700', n700)
  s.cls('border-slate-900', surface)

  // ── Text ──
  s.each(['text-white', 'text-slate-100'], t100)
  s.cls('text-slate-200', t200)
  s.cls('text-slate-300', t300)
  s.cls('text-slate-400', t400)
  s.cls('text-slate-500', t500)
  s.cls('text-slate-500/80', rgba(t500, 0.8))
  s.cls('text-slate-600', t600)
  s.cls('text-slate-700', t700)
  s.cls('hover:text-white', t100)
  s.cls('hover:text-slate-200', t200)
  s.cls('hover:text-slate-300', t300)
  s.cls('hover:text-slate-400', t400)
  s.cls('hover:text-slate-500', t500)
  s.cls('group-hover:text-white', t100)
  s.cls('group-hover:text-slate-300', t300)
  s.cls('group-hover:text-slate-400', t400)
  s.cls('placeholder-slate-500', t500)
  s.each(['placeholder-slate-600', 'placeholder:text-slate-600'], t600)
  s.cls('placeholder-slate-700', t700)
  for (const a of ['[0.06]', '[0.08]', '10']) s.cls(`text-white/${a}`, rgba(text, alphaOf(a)))

  // ── Translucent surfaces: a tint of the text colour (white on dark, ink on light) ──
  for (const a of ['[0.01]', '[0.015]', '[0.02]', '[0.03]', '[0.04]', '5', '[0.05]', '[0.06]', '[0.07]', '[0.08]', '10', '[0.1]', '[0.10]', '[0.12]', '15', '20']) {
    s.cls(`bg-white/${a}`, rgba(text, alphaOf(a)))
  }
  for (const a of ['[0.02]', '[0.03]', '[0.04]', '5', '[0.05]', '[0.06]', '[0.08]', '10', '[0.1]']) {
    s.cls(`hover:bg-white/${a}`, rgba(text, alphaOf(a)))
  }
  s.each(['from-white/[0.06]'], rgba(text, 0.06))
  s.each(['from-white/[0.08]', 'via-white/[0.08]'], rgba(text, 0.08))
  for (const a of ['[0.06]', '[0.1]', '10', '15']) s.cls(`ring-white/${a}`, rgba(text, alphaOf(a)))

  // ── Chrome: scrollbars, charts, selection, the phone's status bar colour ──
  s.rule(`${ROOT} ::-webkit-scrollbar-thumb`, `background-color: ${rgba(muted, 0.35)} !important`)
  s.rule(`${ROOT} ::-webkit-scrollbar-thumb:hover`, `background-color: ${rgba(muted, 0.55)} !important`)
  s.rule(`${ROOT} .scrollbar-thin`, `scrollbar-color: ${rgba(muted, 0.4)} transparent !important`)
  s.rule(`${ROOT} .recharts-cartesian-grid line`, `stroke: ${rgba(border, 0.8)} !important`)
  s.rule(`${ROOT} .recharts-text`, `fill: ${t500} !important`)
  s.rule(`${ROOT} .recharts-tooltip-wrapper .recharts-default-tooltip`, `background-color: ${rgba(raised, 0.96)} !important; border-color: ${border} !important; color: ${text} !important`)
  s.rule(`${ROOT} .recharts-tooltip-wrapper .recharts-tooltip-label`, `color: ${muted} !important`)
  s.rule(`${ROOT} .recharts-tooltip-wrapper .recharts-tooltip-item, ${ROOT} .recharts-tooltip-wrapper .recharts-tooltip-item-name, ${ROOT} .recharts-tooltip-wrapper .recharts-tooltip-item-separator, ${ROOT} .recharts-tooltip-wrapper .recharts-tooltip-item-value, ${ROOT} .recharts-tooltip-wrapper .recharts-tooltip-item-unit`, `color: ${text} !important`)
  s.rule(`${ROOT} .uptime-tip::before`, `border-color: ${border} !important`)

  if (light) {
    // The .light block styles elements as well as classes; give those the palette
    // too. html[data-theme] el (0,1,2) beats .light el (0,1,1) and still loses to
    // a utility class on the element (0,2,1), as in the stock cascade.
    s.rule(`${ROOT} h1, ${ROOT} h2, ${ROOT} h3, ${ROOT} h4, ${ROOT} h5, ${ROOT} h6`, `color: ${text} !important`)
    s.rule(`${ROOT} header, ${ROOT} footer`, `background-color: ${rgba(surface, 0.85)} !important; border-color: ${border} !important`)
    s.rule(`${ROOT} aside`, `background-color: ${rgba(surface, 0.8)} !important; border-color: ${border} !important`)
    s.rule(`${ROOT} input, ${ROOT} textarea, ${ROOT} select`, `background-color: ${surface} !important; border-color: ${border} !important; color: ${text} !important`)
    s.rule(`${ROOT} input::placeholder, ${ROOT} textarea::placeholder`, `color: ${t500} !important`)
    s.rule(`${ROOT} input:focus, ${ROOT} textarea:focus, ${ROOT} select:focus`, `border-color: ${rgba(p.success, 0.6)} !important; box-shadow: 0 0 0 3px ${rgba(p.success, 0.2)} !important`)
    s.rule(`${ROOT} table th`, `color: ${t500} !important; border-color: ${rgba(border, 0.7)} !important`)
    s.rule(`${ROOT} table td`, `color: ${t300} !important`)
    s.rule(`${ROOT} table thead`, `background-color: ${rgba(text, 0.02)} !important`)
    s.rule(`${ROOT} tr:hover, ${ROOT} table tr:hover`, `background-color: ${rgba(text, 0.03)} !important`)
    s.rule(`${ROOT} kbd`, `background-color: ${rgba(text, 0.05)} !important; border-color: ${border} !important; color: ${t600} !important`)
    s.rule(`${ROOT} pre, ${ROOT} code`, `background-color: ${raised} !important; color: ${t300} !important`)
    s.rule(`${ROOT_LIGHT} .bg-slate-950\\/60, ${ROOT_LIGHT} .bg-slate-900\\/80`, `border-color: ${border} !important`)
    for (const a of ['20', '30', '40', '50', '60', '70']) s.cls(`bg-black/${a}`, rgba(text, alphaOf(a) * 0.4))
    for (const a of ['20', '30', '40', '50', '60']) s.cls(`shadow-black/${a}`, rgba(text, alphaOf(a) * 0.2))
  }
}

/** the status hue families the dashboard uses for each semantic colour */
const FAMILIES: Record<'success' | 'warning' | 'danger' | 'info', { hues: string[]; primary: string; keyframe: string | null }> = {
  success: { hues: ['emerald', 'teal', 'lime', 'green'], primary: 'emerald', keyframe: 'glowPulseEmerald' },
  warning: { hues: ['amber', 'orange', 'yellow'], primary: 'amber', keyframe: null },
  danger: { hues: ['rose', 'red'], primary: 'rose', keyframe: 'glowPulseRose' },
  info: { hues: ['cyan', 'sky', 'blue'], primary: 'cyan', keyframe: 'glowPulseCyan' },
}

/** the arbitrary glow shadows hard-coded with a hue's rgb (sidebar dots, status pills) */
const ARBITRARY_GLOWS: Record<string, string[]> = {
  emerald: ['0_0_8px_rgba(52,211,153,0.6)', '0_0_8px_rgba(52,211,153,0.3)', '0_0_8px_rgba(52,211,153,.6)', '0_0_6px_rgba(52,211,153,0.4)', '0_0_6px_rgba(52,211,153,0.5)', '0_0_20px_rgba(52,211,153,0.2)', '0_0_12px_rgba(52,211,153,0.4)'],
  cyan: ['0_0_8px_rgba(34,211,238,0.3)'],
  amber: ['0_0_8px_rgba(251,191,36,0.3)'],
  rose: ['0_0_8px_rgba(251,113,133,0.3)'],
}

/** one hue family (emerald, teal, …) painted with a semantic colour */
function emitHue(s: Sheet, hue: string, c: string, text: string, full: boolean, light: boolean): void {
  const s500 = shade(c, 0.15)
  const s600 = shade(c, 0.3)
  const t300 = mixHex(c, text, 0.3)
  const t200 = mixHex(c, text, 0.55)
  const t100 = mixHex(c, text, 0.75)

  // text
  s.each([`text-${hue}-400`, `hover:text-${hue}-400`, `group-hover:text-${hue}-400`, `fill-${hue}-400`, `stroke-${hue}-400`], c)
  s.each([`text-${hue}-300`, `hover:text-${hue}-300`, `group-hover:text-${hue}-300`], t300)
  s.each([`text-${hue}-200`, `hover:text-${hue}-200`], t200)
  s.cls(`text-${hue}-100`, t100)
  s.cls(`text-${hue}-500`, s500)
  s.cls(`text-${hue}-600`, s600)
  // solid backgrounds and borders
  s.each([`bg-${hue}-400`, `hover:bg-${hue}-400`, `border-${hue}-400`, `border-t-${hue}-400`, `accent-${hue}-400`, `from-${hue}-400`, `to-${hue}-400`], c)
  s.each([`bg-${hue}-500`, `hover:bg-${hue}-500`, `border-${hue}-500`, `border-t-${hue}-500`, `border-b-${hue}-500`, `border-l-${hue}-500`, `accent-${hue}-500`, `from-${hue}-500`, `to-${hue}-500`, `ring-${hue}-500`], s500)
  s.each([`bg-${hue}-600`, `hover:bg-${hue}-600`, `border-${hue}-600`], s600)
  // translucent backgrounds
  const bgAlphas = full
    ? ['5', '8', '10', '12', '15', '20', '25', '30', '40', '50', '60', '70', '80', '90', '[0.02]', '[0.03]', '[0.04]', '[0.05]', '[0.06]', '[0.08]']
    : ['10', '15', '20', '25', '[0.02]', '[0.04]', '[0.06]']
  for (const a of bgAlphas) s.cls(`bg-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
  for (const a of ['10', '20', '30']) s.cls(`bg-${hue}-400/${a}`, rgba(c, alphaOf(a)))
  const hoverBg = full ? ['5', '10', '15', '20', '25', '30', '40', '50', '[0.06]'] : ['15', '25']
  for (const a of hoverBg) s.cls(`hover:bg-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
  // translucent borders, rings, shadows
  const borderAlphas = full ? ['10', '15', '20', '25', '30', '40', '50', '60'] : ['15', '20', '25', '40']
  for (const a of borderAlphas) s.cls(`border-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
  if (full) {
    for (const a of ['10', '15', '20', '25', '30', '40', '50']) s.cls(`hover:border-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
    for (const a of ['20', '30', '40', '50', '60']) s.cls(`focus:border-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
    for (const a of ['10', '20', '25', '30', '40', '50']) s.cls(`ring-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
    for (const a of ['20', '30']) s.cls(`focus:ring-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
    for (const a of ['10', '20', '25', '30', '40', '50']) s.cls(`shadow-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
    for (const a of ['20', '30']) s.cls(`hover:shadow-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
    for (const a of ['50', '60', '70', '80', '90']) s.cls(`text-${hue}-400/${a}`, rgba(c, alphaOf(a)))
    for (const a of ['50', '60', '70']) s.cls(`text-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
    for (const a of ['80', '90']) s.cls(`text-${hue}-300/${a}`, rgba(t300, alphaOf(a)))
    for (const a of ['80', '90']) s.cls(`text-${hue}-200/${a}`, rgba(t200, alphaOf(a)))
    s.cls(`text-${hue}-100/90`, rgba(t100, 0.9))
    for (const a of ['10', '15', '20', '30']) s.cls(`from-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
    for (const a of ['10', '15', '20', '30']) s.cls(`to-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
    for (const a of ['5', '10']) s.cls(`via-${hue}-500/${a}`, rgba(s500, alphaOf(a)))
  } else {
    s.cls(`ring-${hue}-500/20`, rgba(s500, 0.2))
    s.cls(`from-${hue}-500/20`, rgba(s500, 0.2))
    s.cls(`to-${hue}-500/20`, rgba(s500, 0.2))
  }
  // glows, neon text and the hard-coded arbitrary shadows of the primary hue
  const glow = ARBITRARY_GLOWS[hue]
  if (glow) {
    for (const g of glow) {
      const m = /^0_0_(\d+)px_rgba\([^,]+,[^,]+,[^,]+,([0-9.]+)\)$/.exec(g)
      if (!m) continue
      const px = m[1]
      const a = parseFloat(m[2])
      // the class names are assembled piecewise so Tailwind's source scanner does
      // not read "shadow-[…]" here as an arbitrary utility to compile
      const open = '['
      const close = ']'
      s.rule(`${ROOT} .${esc('shadow-' + open + g + close)}`, `box-shadow: 0 0 ${px}px ${rgba(c, a)} !important`)
      s.rule(`${ROOT} .${esc('drop-shadow-' + open + g + close)}`, `filter: drop-shadow(0 0 ${px}px ${rgba(c, a)}) !important`)
    }
    s.rule(`${ROOT} .glow-${hue}`, light
      ? `box-shadow: 0 0 12px ${rgba(c, 0.1)} !important`
      : `box-shadow: 0 0 20px ${rgba(c, 0.15)}, 0 0 60px ${rgba(c, 0.05)} !important`)
    s.rule(`${ROOT} .neon-${hue}`, light ? 'text-shadow: none !important' : `text-shadow: 0 0 7px ${rgba(c, 0.4)}, 0 0 20px ${rgba(c, 0.15)} !important`)
  }
}

function emitStatus(s: Sheet, p: ThemePalette, stock: ThemePalette, mode: ThemeMode): void {
  const light = mode === 'light'
  for (const key of ['success', 'warning', 'danger', 'info'] as const) {
    const c = p[key]
    if (c === stock[key]) continue
    const fam = FAMILIES[key]
    for (const hue of fam.hues) emitHue(s, hue, c, p.text, hue === fam.primary, light)
    if (fam.keyframe) {
      s.rule(`@keyframes ${fam.keyframe}`, `0%, 100% { box-shadow: 0 0 8px ${rgba(c, 0.15)}; } 50% { box-shadow: 0 0 24px ${rgba(c, 0.3)}, 0 0 48px ${rgba(c, 0.1)}; }`)
    }
  }
}

/** the brand: --color-accent, the emerald→cyan gradients, selection, the logo's glow */
function emitBrand(s: Sheet, p: ThemePalette, stock: ThemePalette): void {
  const a = p.accent
  const b = p.accentSecondary
  const changed = a !== stock.accent || b !== stock.accentSecondary
  if (!changed) return
  const vars: string[] = []
  if (a !== stock.accent) vars.push(`--color-accent: ${hexToTriplet(a)}`)
  if (b !== stock.accentSecondary) vars.push(`--color-accent-secondary: ${hexToTriplet(b)}`)
  s.rule(ROOT, vars.join('; '))
  // the emerald → cyan pairs are the brand gradient (avatar, logo box, primary CTA), not status colours
  const pairs: Array<[string, string, number]> = [
    ['from-emerald-500', 'to-cyan-500', 1],
    ['from-emerald-400', 'to-cyan-400', 1],
    ['from-emerald-500/20', 'to-cyan-500/20', 0.2],
  ]
  for (const [from, to, alpha] of pairs) {
    const fromC = alpha < 1 ? rgba(a, alpha) : a
    const toC = alpha < 1 ? rgba(b, alpha) : b
    s.rule(`${ROOT} .${esc(from)}.${esc(to)}`, `--tw-gradient-from: ${fromC} var(--tw-gradient-from-position) !important; --tw-gradient-to: ${toC} var(--tw-gradient-to-position) !important`)
    s.rule(`${ROOT} .${esc(to.replace('to-', 'from-'))}.${esc(from.replace('from-', 'to-'))}`, `--tw-gradient-from: ${toC} var(--tw-gradient-from-position) !important; --tw-gradient-to: ${fromC} var(--tw-gradient-to-position) !important`)
  }
  s.rule(`${ROOT} .gradient-border::before`, `background: linear-gradient(135deg, ${rgba(a, 0.3)}, ${rgba(b, 0.1)}, ${rgba(a, 0.3)}) !important`)
  s.rule(`${ROOT} .gradient-border-animated::before`, `background: conic-gradient(from var(--gradient-angle, 0deg), ${rgba(a, 0.4)}, ${rgba(b, 0.2)}, ${rgba(a, 0.4)}, ${rgba(b, 0.2)}, ${rgba(a, 0.4)}) !important`)
  s.rule(`${ROOT} .text-gradient.neon-emerald`, `text-shadow: 0 0 7px ${rgba(a, 0.4)}, 0 0 20px ${rgba(a, 0.15)} !important`)
  s.rule(`${ROOT} ::selection`, `background-color: ${rgba(a, 0.3)} !important`)
  s.rule(`@keyframes blinkCaret`, `0%, 100% { border-color: transparent; } 50% { border-color: ${rgba(a, 0.8)}; }`)
}

/** the rounded-* scale for each radius setting ('lg' is what ships) */
const RADIUS_SCALE: Record<Exclude<ThemeRadius, 'lg'>, Record<string, string>> = {
  sm: { md: '0.25rem', lg: '0.375rem', xl: '0.5rem', '2xl': '0.625rem', '3xl': '0.875rem' },
  md: { md: '0.3125rem', lg: '0.4375rem', xl: '0.625rem', '2xl': '0.8125rem', '3xl': '1.125rem' },
  xl: { md: '0.5rem', lg: '0.75rem', xl: '1rem', '2xl': '1.375rem', '3xl': '1.75rem' },
}

function emitRadius(s: Sheet, radius: Theme['radius']): void {
  if (!radius || radius === 'lg' || !(radius in RADIUS_SCALE)) return
  const scale = RADIUS_SCALE[radius]
  s.rule(ROOT, `--dcs-radius: ${scale.xl}`)
  for (const [step, value] of Object.entries(scale)) {
    s.rule(`${ROOT} .rounded-${step}`, `border-radius: ${value} !important`)
    s.rule(`${ROOT} .rounded-t-${step}`, `border-top-left-radius: ${value} !important; border-top-right-radius: ${value} !important`)
    s.rule(`${ROOT} .rounded-b-${step}`, `border-bottom-left-radius: ${value} !important; border-bottom-right-radius: ${value} !important`)
  }
  s.rule(`${ROOT} .glass, ${ROOT} .glass-subtle, ${ROOT} .glass-card, ${ROOT} .glass-1, ${ROOT} .glass-2, ${ROOT} .glass-3`, `border-radius: ${scale.xl} !important`)
}

function emitFont(s: Sheet, font: string): void {
  const name = font.trim()
  if (!name || !FONT_NAME_RE.test(name)) return
  s.rule(`${ROOT} body`, `font-family: "${name}", 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important`)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** the complete override stylesheet for a theme (empty for the stock look) */
export function buildThemeCss(theme: Theme): string {
  const mode: ThemeMode = theme.mode === 'light' ? 'light' : 'dark'
  const stock = stockPalette(mode)
  const p = theme.palette
  const s = new Sheet()

  // the palette as variables, always: custom CSS (a theme's own or the user's) can build on them
  s.rule(ROOT, [
    `--dcs-accent: ${p.accent}`, `--dcs-accent-secondary: ${p.accentSecondary}`,
    `--dcs-bg: ${p.bg}`, `--dcs-surface: ${p.surface}`, `--dcs-surface-raised: ${p.surfaceRaised}`, `--dcs-border: ${p.border}`,
    `--dcs-text: ${p.text}`, `--dcs-text-muted: ${p.textMuted}`,
    `--dcs-success: ${p.success}`, `--dcs-warning: ${p.warning}`, `--dcs-danger: ${p.danger}`, `--dcs-info: ${p.info}`,
  ].join('; '))

  const neutralKeys = ['bg', 'surface', 'surfaceRaised', 'border', 'text', 'textMuted'] as const
  if (neutralKeys.some((k) => p[k] !== stock[k])) emitNeutrals(s, p, mode)
  emitStatus(s, p, stock, mode)
  emitBrand(s, p, stock)
  emitRadius(s, theme.radius)
  emitFont(s, theme.font)

  const parts = [`/* theme: ${theme.name || 'draft'} (${mode}) */`, s.toString()]
  if (theme.css && theme.css.trim()) {
    parts.push(`/* ── ${theme.name || 'draft'}: extra css ── */`, sanitizeCss(theme.css).css)
  }
  return parts.join('\n')
}

function ensureStyle(): HTMLStyleElement {
  let el = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = THEME_STYLE_ID
    // after Tailwind's sheet and before custom-user-css, so the person's own CSS still wins
    const custom = document.getElementById('custom-user-css')
    if (custom) document.head.insertBefore(el, custom)
    else document.head.appendChild(el)
  }
  return el
}

function setMetaThemeColor(color: string): void {
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (meta && meta.content !== color) meta.content = color
}

/** the theme the document is currently dressed in (null = the stock look) */
let currentTheme: Theme | null = null
export function appliedTheme(): Theme | null {
  return currentTheme
}

/** while the studio previews a draft, the periodic re-sync keeps its hands off the document */
let previewing = false
export function setThemePreviewing(on: boolean): void {
  previewing = on
}
export function isThemePreviewing(): boolean {
  return previewing
}

/**
 * Dress the document in a theme. null removes the theme stylesheet and the
 * data-theme attribute and leaves the profile accent and the light/dark class
 * alone (the caller restores those from the dark/light setting).
 */
export function applyTheme(theme: Theme | null): void {
  const html = document.documentElement
  const style = ensureStyle()
  currentTheme = theme
  if (!theme) {
    html.removeAttribute('data-theme')
    if (style.textContent) style.textContent = ''
    setMetaThemeColor(DEFAULT_META_COLOR)
    return
  }
  const light = theme.mode === 'light'
  html.setAttribute('data-theme', theme.name || 'draft')
  html.classList.toggle('light', light)
  html.classList.toggle('dark', !light)
  const css = buildThemeCss(theme)
  if (style.textContent !== css) style.textContent = css
  setMetaThemeColor(theme.palette.surface)
}

