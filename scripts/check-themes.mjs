#!/usr/bin/env node
// =============================================================================
// check-themes — holds the theme system to its contract (runs in CI after the
// type check; locally: `node scripts/check-themes.mjs` or `npx tsx scripts/check-themes.mjs`):
//   - every built-in carries a complete, valid dark and light look
//   - both looks of every built-in reach WCAG AA (text and muted text 4.5:1 on
//     background and surface, accents 3:1, status colours 4.5:1)
//   - derivePalette is deterministic, keeps hues, reaches AA, and deriving back
//     and forth lands on the same palettes
//   - documents with a single palette (every theme made before 4.0) still load
//   - the JSON contract round-trips through validateTheme
//   - theme names and aliases resolve; the engine builds every look
// The TypeScript sources are bundled with esbuild (already a dev dependency).
// =============================================================================

import { build } from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { INVENTORY, renderInventory, scanClasses } from './theme-classes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-check-themes-'))

async function load(entry) {
  const outfile = path.join(tmp, `${path.basename(entry, '.ts')}.mjs`)
  await build({ entryPoints: [path.join(root, entry)], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent' })
  return import(pathToFileURL(outfile).href)
}

const T = await load('src/shared/themes.ts')
const E = await load('src/renderer/lib/themeEngine.ts')
fs.rmSync(tmp, { recursive: true, force: true })

let failures = 0
let checks = 0
function ok(cond, what) {
  checks++
  if (!cond) {
    failures++
    console.log(`  FAIL ${what}`)
  }
}
const section = (s) => console.log(`\n${s}`)
const eqPalette = (a, b) => T.PALETTE_KEYS.every((k) => a[k] === b[k])
const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }
const validPalette = (p) => !!p && T.PALETTE_KEYS.every((k) => typeof p[k] === 'string' && T.HEX_RE.test(p[k]) && p[k] === p[k].toLowerCase())

// ---------------------------------------------------------------------------
section('Built-in themes')
const EXPECTED = ['dcs-emerald', 'nord-night', 'dracula', 'catppuccin-mocha', 'solarized-dark', 'gruvbox-dark', 'rose-pine-dawn', 'paper-light']
const TITLES = { 'dcs-emerald': 'DCS Emerald', 'nord-night': 'Nord', dracula: 'Dracula', 'catppuccin-mocha': 'Catppuccin', 'solarized-dark': 'Solarized', 'gruvbox-dark': 'Gruvbox', 'rose-pine-dawn': 'Rosé Pine', 'paper-light': 'Paper' }
ok(T.BUILT_IN_THEMES.length === 8, `8 built-ins (found ${T.BUILT_IN_THEMES.length})`)
for (const name of EXPECTED) ok(!!T.BUILT_IN_BY_NAME[name], `built-in ${name} exists (a saved choice from 3.9 keeps working)`)
for (const t of T.BUILT_IN_THEMES) {
  ok(validPalette(t.palette_dark), `${t.name}: dark look complete and #rrggbb`)
  ok(validPalette(t.palette_light), `${t.name}: light look complete and #rrggbb`)
  ok(t.mode === 'dark' || t.mode === 'light', `${t.name}: mode is dark or light`)
  ok(eqPalette(t.palette, t.mode === 'light' ? t.palette_light : t.palette_dark), `${t.name}: palette is the look of its mode`)
  ok(t.title === TITLES[t.name], `${t.name}: title "${t.title}" is the short name "${TITLES[t.name]}"`)
  ok(/^[A-Z][^.]*[.]$/.test(t.description) && t.description.length <= 90, `${t.name}: description is one short sentence`)
  ok(T.validateTheme(JSON.parse(T.themeToJson(t))).ok, `${t.name}: its document validates`)
  ok(T.themeLooks(t).derived === null, `${t.name}: nothing derived`)
  const names = T.BUILT_IN_LOOK_NAMES[t.name]
  ok(!!names && !!names.dark && !!names.light, `${t.name}: its looks are named`)
}
ok(eqPalette(T.BUILT_IN_BY_NAME['dcs-emerald'].palette_dark, T.STOCK_DARK_PALETTE), 'DCS Emerald dark is the stock dark palette (renders as shipped)')

// ---------------------------------------------------------------------------
section('Contrast (WCAG AA) of every built-in look')
const cols = [['text-bg', 'text/bg'], ['text-surface', 'text/surf'], ['muted-bg', 'muted/bg'], ['muted-surface', 'muted/surf'], ['accent-surface', 'accent/surf'], ['success-surface', 'ok/surf'], ['warning-surface', 'warn/surf'], ['danger-surface', 'err/surf'], ['info-surface', 'info/surf'], ['border-surface', 'border/surf']]
console.log(`  ${'theme / look'.padEnd(26)}${cols.map(([, h]) => h.padStart(12)).join('')}`)
for (const t of T.BUILT_IN_THEMES) {
  for (const mode of T.THEME_MODES) {
    const res = T.checkContrast(T.themeLook(t, mode))
    const by = Object.fromEntries(res.map((r) => [r.id, r]))
    const look = T.BUILT_IN_LOOK_NAMES[t.name]?.[mode] ?? mode
    console.log(`  ${`${t.title} / ${look}`.padEnd(26)}${cols.map(([id]) => `${by[id].ratio.toFixed(2)}${by[id].ok ? ' ' : '!'}`.padStart(12)).join('')}`)
    for (const r of res) ok(r.ok, `${t.name} ${mode}: ${r.label} ${r.ratio.toFixed(2)}:1 (needs ${r.min}:1)`)
  }
}

// ---------------------------------------------------------------------------
section('derivePalette')
// sources: every built-in look, plus hand-made palettes of all kinds (grey, saturated, near-white, odd hues)
const FIXTURES = [
  ['grey dark', 'dark', { accent: '#ffffff', accentSecondary: '#aaaaaa', bg: '#111111', surface: '#1a1a1a', surfaceRaised: '#262626', border: '#333333', text: '#eeeeee', textMuted: '#999999', success: '#00ff00', warning: '#ffff00', danger: '#ff0000', info: '#0000ff' }],
  ['neon dark', 'dark', { accent: '#ff00ff', accentSecondary: '#00ffff', bg: '#0a0014', surface: '#140028', surfaceRaised: '#20003c', border: '#3a0066', text: '#fdf4ff', textMuted: '#c084fc', success: '#39ff14', warning: '#ffe600', danger: '#ff073a', info: '#00e5ff' }],
  ['forest light', 'light', { accent: '#166534', accentSecondary: '#a16207', bg: '#f0f5ee', surface: '#fbfdf9', surfaceRaised: '#e2eadf', border: '#c8d5c3', text: '#1a2e1a', textMuted: '#4d5f4b', success: '#15803d', warning: '#a16207', danger: '#b91c1c', info: '#0369a1' }],
  ['white light', 'light', { accent: '#2563eb', accentSecondary: '#7c3aed', bg: '#ffffff', surface: '#ffffff', surfaceRaised: '#f4f4f5', border: '#e4e4e7', text: '#09090b', textMuted: '#52525b', success: '#16a34a', warning: '#ca8a04', danger: '#dc2626', info: '#0284c7' }],
  ['minimal (4 keys)', 'dark', T.completePalette({ accent: '#2dd4bf', bg: '#0b1020', surface: '#111a2e', text: '#e6edf7' }, 'dark')],
]
// and a fixed set of generated palettes (seeded, so every run checks the same ones)
let seed = 20260929
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const between = (a, b) => a + (b - a) * rnd()
const GENERATED = []
for (let i = 0; i < 40; i++) {
  const mode = i % 2 ? 'light' : 'dark'
  const hue = between(0, 360)
  const tint = between(0, 0.06)
  const n = (l) => T.oklchToHex({ l, c: tint * (mode === 'dark' ? 1 : 0.4), h: hue })
  const col = (l) => T.oklchToHex({ l, c: between(0.03, 0.25), h: between(0, 360) })
  const L = mode === 'dark' ? { bg: between(0.1, 0.25) } : { bg: between(0.9, 0.98) }
  const d = mode === 'dark' ? 1 : -1
  GENERATED.push([`generated ${i} ${mode}`, mode, {
    accent: col(mode === 'dark' ? 0.78 : 0.55), accentSecondary: col(mode === 'dark' ? 0.78 : 0.55),
    bg: n(L.bg), surface: n(L.bg + d * 0.04), surfaceRaised: n(L.bg + d * 0.09), border: n(L.bg + d * 0.14),
    text: n(mode === 'dark' ? 0.95 : 0.25), textMuted: n(mode === 'dark' ? 0.74 : 0.5),
    success: col(mode === 'dark' ? 0.8 : 0.5), warning: col(mode === 'dark' ? 0.85 : 0.55), danger: col(mode === 'dark' ? 0.72 : 0.5), info: col(mode === 'dark' ? 0.8 : 0.5),
  }])
}
const SOURCES = [...T.BUILT_IN_THEMES.flatMap((t) => T.THEME_MODES.map((m) => [`${t.name} ${m}`, m, T.themeLook(t, m)])), ...FIXTURES, ...GENERATED]
const COLOUR_KEYS = ['accent', 'accentSecondary', 'success', 'warning', 'danger', 'info']
let roundTrips = 0
for (const [label, from, p] of SOURCES) {
  const to = from === 'dark' ? 'light' : 'dark'
  const b = T.derivePalette(p, from)
  ok(validPalette(b), `${label}: the derived ${to} look is complete and #rrggbb`)
  ok(eqPalette(b, T.derivePalette({ ...p }, from)), `${label}: deterministic`)
  // back and forth: the look derived from the derived look derives the same look again
  const c = T.derivePalette(b, to)
  const d = T.derivePalette(c, from)
  const same = eqPalette(d, b)
  if (same) roundTrips++
  ok(same, `${label}: derive(derive(derive(p))) equals derive(p)${same ? '' : ` — ${T.PALETTE_KEYS.filter((k) => d[k] !== b[k]).map((k) => `${k} ${b[k]}→${d[k]}`).join(', ')}`}`)
  // hues kept for every colour that has one
  for (const k of COLOUR_KEYS) {
    const src = T.hexToOklch(p[k])
    const out = T.hexToOklch(b[k])
    if (src.c >= 0.04 && out.c >= 0.02) ok(hueDiff(src.h, out.h) <= 6, `${label}: ${k} keeps its hue (${src.h.toFixed(1)}° → ${out.h.toFixed(1)}°)`)
  }
  // the neutrals keep the direction of the source's tint (its chroma-weighted mean hue)
  let x = 0
  let y = 0
  for (const k of ['bg', 'surface', 'surfaceRaised', 'border', 'text', 'textMuted']) {
    const o = T.hexToOklch(p[k])
    x += o.c * Math.cos((o.h * Math.PI) / 180)
    y += o.c * Math.sin((o.h * Math.PI) / 180)
  }
  const tintHue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  for (const k of ['bg', 'surfaceRaised', 'border', 'text']) {
    const o = T.hexToOklch(b[k])
    if (o.c >= 0.012 && Math.hypot(x, y) >= 0.02) ok(hueDiff(tintHue, o.h) <= 10, `${label}: derived ${k} keeps the tint (${tintHue.toFixed(0)}° → ${o.h.toFixed(0)}°)`)
  }
  // and the derived look is readable
  for (const r of T.checkContrast(b)) ok(r.ok, `${label}: derived ${to} look — ${r.label} ${r.ratio.toFixed(2)}:1 (needs ${r.min}:1)`)
}
console.log(`  ${SOURCES.length} sources derived both ways; ${roundTrips} stable round trips`)

// ---------------------------------------------------------------------------
section('Documents from before 4.0 (one palette)')
const oldDark = { schema: 1, name: 'midnight-teal', title: 'Midnight Teal', mode: 'dark', palette: { accent: '#2dd4bf', bg: '#0b1020', surface: '#111a2e', text: '#e6edf7' } }
const oldLight = { schema: 1, name: 'sand', title: 'Sand', mode: 'light', palette: { accent: '#0f766e', bg: '#f5efe3', surface: '#fffaf0', text: '#2b2520', textMuted: '#5f574d' }, css: '.glass { box-shadow: none; }' }
for (const doc of [oldDark, oldLight]) {
  const v = T.validateTheme(doc)
  ok(v.ok, `${doc.name}: validates (${v.errors.join('; ')})`)
  if (!v.ok) continue
  const looks = T.themeLooks(v.theme)
  ok(looks.derived === (doc.mode === 'dark' ? 'light' : 'dark'), `${doc.name}: the other look is derived`)
  ok(eqPalette(looks[doc.mode], v.theme.palette), `${doc.name}: its own look is its palette`)
  ok(validPalette(looks.dark) && validPalette(looks.light), `${doc.name}: both looks complete`)
  const json = JSON.parse(T.themeToJson(v.theme))
  ok(!!json.palette_dark && !!json.palette_light, `${doc.name}: saving writes both looks`)
  ok(eqPalette(json.palette, json[`palette_${doc.mode}`]), `${doc.name}: saving keeps palette = the look of its mode (older dashboards)`)
}
const meta = { schema: 1, name: 'server-old', title: 'Server old', description: '', author: '', version: '1.0.0', mode: 'light', palette: { accent: '#0f766e', bg: '#f7f4ed', surface: '#fffdf8', text: '#2b2722' }, font: '', radius: '', updated_at: 1790000000, has_css: false }
const fromMeta = T.themeFromMeta(meta)
ok(fromMeta.css === '' && !('has_css' in fromMeta) && fromMeta.palette_dark === undefined, 'a listing entry (GET /themes) becomes a theme')
ok(T.themeLooks(fromMeta).derived === 'dark', 'a listing entry without palette_dark gets a derived dark look')
ok(T.isBuiltInCopy({ name: 'nord-night', palette: T.completePalette({ accent: '#88c0d0', accentSecondary: '#81a1c1', bg: '#242933', surface: '#2e3440', surfaceRaised: '#3b4252', border: '#434c5e', text: '#eceff4', textMuted: '#aab4c5', success: '#a3be8c', warning: '#ebcb8b', danger: '#bf616a', info: '#88c0d0' }, 'dark'), css: '', font: '', radius: '' }), 'a 3.9 server copy of Nord Night is recognised as the built-in')
ok(T.isBuiltInCopy(T.BUILT_IN_BY_NAME.dracula), 'a copy of the current Dracula pair is the built-in')
ok(!T.isBuiltInCopy({ ...T.BUILT_IN_BY_NAME.dracula, css: 'a{}' }), 'a Dracula copy with extra css is its own theme')
ok(!T.isBuiltInCopy({ name: 'dracula', palette: { ...T.BUILT_IN_BY_NAME.dracula.palette, accent: '#ff0000' } }), 'an edited Dracula copy is its own theme')

// ---------------------------------------------------------------------------
section('The JSON contract round-trips through validateTheme')
const pairDoc = { schema: 1, name: 'pair', title: 'Pair', description: 'Both looks.', author: 'me', version: '1.2.0', mode: 'light', palette_dark: T.BUILT_IN_BY_NAME.dracula.palette_dark, palette_light: T.BUILT_IN_BY_NAME.dracula.palette_light, font: 'Inter', radius: 'md', css: '' }
const noPalette = T.validateTheme(pairDoc)
ok(noPalette.ok && eqPalette(noPalette.theme.palette, pairDoc.palette_light), 'a document with both looks and no palette takes palette from the look of its mode')
for (const t of [...T.BUILT_IN_THEMES, noPalette.theme, T.validateTheme(oldDark).theme, T.validateTheme(oldLight).theme]) {
  const json = T.themeToJson(t)
  const back = T.validateTheme(JSON.parse(json))
  ok(back.ok, `${t.name}: its JSON validates`)
  if (!back.ok) continue
  ok(T.themeToJson(back.theme) === json, `${t.name}: JSON → validate → JSON is identical`)
  ok(eqPalette(T.themeLook(back.theme, 'dark'), T.themeLook(t, 'dark')) && eqPalette(T.themeLook(back.theme, 'light'), T.themeLook(t, 'light')), `${t.name}: both looks survive the trip`)
  const keys = Object.keys(JSON.parse(json))
  ok(keys.join() === 'schema,name,title,description,author,version,mode,palette,palette_dark,palette_light,font,radius,css', `${t.name}: the document has the contract's keys in order`)
}
const bad = [
  [{ name: 'x', palette: { bg: '#000000' } }, 'palette without accent/surface/text'],
  [{ name: 'x', palette: { accent: '#fff', bg: '#000', surface: '#111', text: '#eee' }, palette_dark: { accent: 'red', bg: '#000000', surface: '#111111', text: '#eeeeee' } }, 'palette_dark with a named colour'],
  [{ name: 'x', palette: { accent: '#ffffff', bg: '#000000', surface: '#111111', text: '#eeeeee' }, palette_light: [] }, 'palette_light that is not an object'],
  [{ name: 'Bad Name', palette: { accent: '#ffffff', bg: '#000000', surface: '#111111', text: '#eeeeee' } }, 'a name with spaces'],
]
for (const [doc, what] of bad) ok(!T.validateTheme(doc).ok, `refused: ${what}`)

// ---------------------------------------------------------------------------
section('Names and aliases')
for (const [from, to] of Object.entries(T.THEME_ALIASES)) ok(!!T.BUILT_IN_BY_NAME[to], `alias ${from} → ${to} resolves to a built-in`)
for (const name of EXPECTED) ok(T.resolveThemeAlias(name) === name && T.isBuiltInTheme(name), `${name} resolves to itself`)
ok(T.isBuiltInTheme(T.DEFAULT_THEME_NAME), 'the default theme is a built-in')
ok(!T.isBuiltInTheme('nope'), 'an unknown name is not a built-in')

// ---------------------------------------------------------------------------
section('Engine')
for (const t of T.BUILT_IN_THEMES) {
  for (const mode of T.THEME_MODES) {
    const css = E.buildThemeCss(t, mode)
    ok(!/undefined|NaN/.test(css), `${t.name} ${mode}: no undefined/NaN in the stylesheet`)
    ok(css.includes(`--dcs-bg: ${T.themeLook(t, mode).bg}`), `${t.name} ${mode}: the palette variables are set`)
    ok(css.length < 400000, `${t.name} ${mode}: stylesheet size ${(css.length / 1024).toFixed(0)} KB`)
  }
}
const stock = E.buildThemeCss(T.BUILT_IN_BY_NAME['dcs-emerald'], 'dark')
ok(!/\{[^}]*!important/.test(stock.replace(/html\[data-theme\] \{[^}]*\}/g, '')), 'DCS Emerald dark overrides no class (renders exactly as shipped)')
// (only Mantine's gray scale, which is its light scheme's, may come from DCS Emerald's light look)
ok(!/--mantine-color-(?!gray-)/.test(stock), 'DCS Emerald dark leaves Mantine\'s dark scheme exactly as shipped')
// the accent as small text (the page you are on in the sidebar and the tab bar, on its pill) reads at 4.5:1 in every look
const inked = []
for (const t of T.BUILT_IN_THEMES) {
  for (const mode of T.THEME_MODES) {
    const look = T.themeLook(t, mode)
    const ink = E.accentInk(look)
    const pill = T.mixHex(look.surface, look.accent, 0.12)
    const worst = Math.min(...[look.surface, look.bg, pill].map((b) => T.contrastRatio(ink, b)))
    ok(worst >= 4.5, `${t.name} ${mode}: the accent as text reads (${worst.toFixed(2)}:1)`)
    if (ink !== look.accent) inked.push(`${t.title} ${mode} ${look.accent}→${ink}`)
  }
}
console.log(`  the accent as text is a deeper (or, on a dark look, lighter) shade of its hue in: ${inked.join(', ') || 'none'}`)
ok(!E.buildThemeCss(T.BUILT_IN_BY_NAME['dcs-emerald'], 'dark').includes('.accent-text'), 'DCS Emerald dark keeps its accent text as shipped')

// every Mantine colour name the pages pass (lib/mantine.tsx) follows a look that changes everything; violet stays decorative
for (const mode of T.THEME_MODES) {
  const css = E.buildThemeCss(T.BUILT_IN_BY_NAME['gruvbox-dark'], mode)
  const missing = ['emerald', 'cyan', 'amber', 'orange', 'rose', 'slate'].flatMap((n) =>
    ['light', 'light-hover', 'light-color', 'outline', '6'].map((v) => `--mantine-color-${n}-${v}`).concat(`--dcs-tint-${n}-border`)).filter((v) => !css.includes(`${v}:`))
  ok(missing.length === 0, `gruvbox-dark ${mode}: Mantine's emerald, cyan, amber, orange, rose and slate follow the look${missing.length ? ` — not: ${missing.slice(0, 6).join(' ')}` : ''}`)
}

// every colour class the pages use is restyled by a look that changes everything (no leftover emerald or slate)
const current = fs.readFileSync(INVENTORY, 'utf8')
ok(current === renderInventory(scanClasses()), 'src/renderer/lib/themeClasses.ts lists the colour classes in use (run node scripts/theme-classes.mjs)')
const inventory = [...current.matchAll(/'([^']+)'/g)].map((m) => m[1])
const escCls = (cls) => cls.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`)
for (const [name, mode] of [['nord-night', 'light'], ['gruvbox-dark', 'dark'], ['dracula', 'light'], ['catppuccin-mocha', 'dark']]) {
  const css = E.buildThemeCss(T.BUILT_IN_BY_NAME[name], mode)
  const left = inventory.filter((cls) => {
    // decorative hues keep their colour in every theme; only their pale text is darkened on a light look
    const deco = /-(violet|purple|fuchsia|pink|indigo)-(\d+)/.exec(cls)
    if (deco) return mode === 'light' && /(^|:)(text|placeholder|fill|stroke)-/.test(cls) && +deco[2] <= 500 && !css.includes(`.${escCls(cls)}`)
    if (/-black(\/|$)/.test(cls) && mode === 'dark') return false // black stays black on a dark look
    if (/(^|:)(bg|text|border)-(white|black)$/.test(cls) && cls !== 'text-white' && !cls.endsWith(':text-white')) return false // solid white knobs, plain black
    if (/(^|:)text-black/.test(cls)) return false
    return !css.includes(`.${escCls(cls)}`)
  })
  ok(left.length === 0, `${name} ${mode}: every colour class is restyled${left.length ? ` — not: ${left.slice(0, 12).join(' ')}` : ''}`)
}

console.log(`\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ''}`)
process.exit(failures ? 1 : 0)
