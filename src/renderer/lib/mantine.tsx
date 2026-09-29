// =============================================================================
// Mantine (https://mantine.dev) in the dashboard — used where its components are
// better than what is here: selects and their dropdowns, switches, segmented
// filters, badges, progress bars and rings, timelines, tooltips. Only the styles
// of those components are loaded, and Mantine's page-level baseline (body,
// headings, form resets) is NOT: the pages that were built without it look
// exactly as before. Colours follow the dashboard's own palette (the same
// emerald / cyan / amber / rose as its Tailwind classes) and Mantine's light or
// dark scheme follows the dashboard's `light` class on <html>.
//
// The look lives here, once: fields, dropdowns, badges and filters take the
// dashboard's glass surfaces from the --dcs-* variables below (one set per
// scheme), and mantine-dcs.css adds the few states a theme cannot express (the
// focus ring, the hovered and the chosen option). Pages pass data, not styles.
// =============================================================================

import { useEffect, useState, type ReactNode } from 'react'
import {
  Badge, Combobox, Input, MantineProvider, Popover, SegmentedControl, Select, Switch, Tooltip, createTheme,
  type CSSVariablesResolver, type MantineColorsTuple,
} from '@mantine/core'
import '@mantine/core/styles/default-css-variables.css'
import '@mantine/core/styles/global.css'
import '@mantine/core/styles/Badge.css'
import '@mantine/core/styles/Combobox.css'
import '@mantine/core/styles/Input.css'
import '@mantine/core/styles/InlineInput.css'
import '@mantine/core/styles/Popover.css'
import '@mantine/core/styles/Progress.css'
import '@mantine/core/styles/RingProgress.css'
import '@mantine/core/styles/ScrollArea.css'
import '@mantine/core/styles/SegmentedControl.css'
import '@mantine/core/styles/Switch.css'
import '@mantine/core/styles/Timeline.css'
import '@mantine/core/styles/Tooltip.css'
import '@mantine/core/styles/Text.css'
import './mantine-dcs.css'

const scale = (c: readonly string[]) => c as unknown as MantineColorsTuple

// Tailwind's 50…900 scales, so Mantine's color="emerald" is the emerald the rest of the dashboard uses
const PALETTE = {
  emerald: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b'],
  cyan: ['#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'],
  amber: ['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'],
  rose: ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337'],
  violet: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95'],
  slate: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
} as const
type PaletteColor = keyof typeof PALETTE
/** a palette colour by name (anything else — undefined, 'dark.7', a CSS value — falls back) */
const paletteColor = (c: unknown, fallback: PaletteColor): PaletteColor => (typeof c === 'string' && c in PALETTE ? (c as PaletteColor) : fallback)

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Mantine's "light" and "outline" colours, as the dashboard draws its chips: a 10 % tint of the 500 with the
// 300 for text in the dark scheme (bg-emerald-500/10 text-emerald-300), the 700 on a pale tint in the light one
const tints = (scheme: 'dark' | 'light') => Object.fromEntries(Object.entries(PALETTE).flatMap(([name, c]) => scheme === 'dark' ? [
  [`--mantine-color-${name}-light`, hexA(c[5], 0.1)],
  [`--mantine-color-${name}-light-hover`, hexA(c[5], 0.18)],
  [`--mantine-color-${name}-light-color`, c[3]],
  [`--mantine-color-${name}-outline`, c[4]],
  [`--dcs-tint-${name}-border`, hexA(c[5], 0.22)],
] : [
  [`--mantine-color-${name}-light`, hexA(c[6], 0.08)],
  [`--mantine-color-${name}-light-hover`, hexA(c[6], 0.14)],
  [`--mantine-color-${name}-light-color`, c[7]],
  [`--mantine-color-${name}-outline`, c[6]],
  [`--dcs-tint-${name}-border`, hexA(c[6], 0.25)],
]))

// the dashboard's surfaces, one set per scheme: fields like its inputs (bg-white/5 border-white/10, an
// emerald ring on focus), dropdowns like its tooltips (a dark slate bubble with a hairline border)
const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  dark: {
    ...tints('dark'),
    '--dcs-field-bg': 'rgba(255, 255, 255, 0.05)',
    '--dcs-field-border': 'rgba(255, 255, 255, 0.1)',
    '--dcs-field-focus': 'rgba(16, 185, 129, 0.5)',
    '--dcs-field-ring': 'rgba(16, 185, 129, 0.2)',
    '--dcs-field-color': '#e2e8f0',
    '--dcs-field-placeholder': '#64748b',
    '--dcs-dropdown-bg': 'rgba(15, 23, 42, 0.98)',
    '--dcs-dropdown-border': 'rgba(148, 163, 184, 0.2)',
    '--dcs-dropdown-shadow': '0 12px 32px rgba(2, 6, 23, 0.55)',
    '--dcs-option-hover': 'rgba(255, 255, 255, 0.06)',
    '--dcs-option-checked': '#6ee7b7',
    '--dcs-muted': '#64748b',
    '--dcs-seg-bg': 'rgba(255, 255, 255, 0.05)',
    '--dcs-seg-border': 'rgba(255, 255, 255, 0.1)',
    '--dcs-seg-label': '#94a3b8',
    '--dcs-seg-label-hover': '#e2e8f0',
    // the Proxmox forms (variant="fleet"): their inputs' slate fill and amber focus
    '--dcs-fleet-field-bg': 'rgba(30, 41, 59, 0.5)',
    '--dcs-fleet-field-focus': 'rgba(245, 158, 11, 0.4)',
    '--dcs-fleet-field-ring': 'rgba(245, 158, 11, 0.12)',
  },
  light: {
    ...tints('light'),
    '--dcs-field-bg': '#f8fafc',
    '--dcs-field-border': '#cbd5e1',
    '--dcs-field-focus': '#059669',
    '--dcs-field-ring': 'rgba(5, 150, 105, 0.2)',
    '--dcs-field-color': '#0f172a',
    '--dcs-field-placeholder': '#64748b',
    '--dcs-dropdown-bg': '#ffffff',
    '--dcs-dropdown-border': '#e2e8f0',
    '--dcs-dropdown-shadow': '0 12px 32px rgba(15, 23, 42, 0.14)',
    '--dcs-option-hover': '#f1f5f9',
    '--dcs-option-checked': '#047857',
    '--dcs-muted': '#64748b',
    '--dcs-seg-bg': 'rgba(241, 245, 249, 0.7)',
    '--dcs-seg-border': '#cbd5e1',
    '--dcs-seg-label': '#64748b',
    '--dcs-seg-label-hover': '#0f172a',
    '--dcs-fleet-field-bg': '#f8fafc',
    '--dcs-fleet-field-focus': '#059669',
    '--dcs-fleet-field-ring': 'rgba(5, 150, 105, 0.2)',
  },
})

// above every overlay the dashboard draws (its sheets and dialogs sit at z-index 100 … 10001)
const LAYER = 10050
// a dropdown panel (Select, Combobox, Popover): the same bubble in every one
const DROPDOWN = { background: 'var(--dcs-dropdown-bg)', borderColor: 'var(--dcs-dropdown-border)', boxShadow: 'var(--dcs-dropdown-shadow)', color: 'var(--dcs-field-color)' }

const theme = createTheme({
  fontFamily: 'inherit',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  defaultRadius: 'md',
  primaryColor: 'emerald',
  primaryShade: { light: 6, dark: 4 },
  cursorType: 'pointer',
  colors: {
    ...Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, scale(v)])),
    // Mantine's own "dark" scale (surfaces and text in the dark scheme) on the dashboard's slate
    dark: scale(['#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#0b1220', '#020617']),
  },
  components: {
    // a dark bubble in both schemes (Mantine's own dark scheme uses a white one, which clashes with the dashboard);
    // long hints wrap instead of running off the screen
    Tooltip: Tooltip.extend({
      defaultProps: { color: 'dark.7', withArrow: true, multiline: true, maw: 320, openDelay: 150, zIndex: LAYER + 10, transitionProps: { duration: 120 }, events: { hover: true, focus: true, touch: false } },
      styles: {
        tooltip: { border: '1px solid rgba(148, 163, 184, 0.25)', color: '#e2e8f0', fontSize: 12, lineHeight: 1.45, padding: '6px 10px', boxShadow: '0 8px 24px rgba(2, 6, 23, 0.45)' },
        arrow: { border: '1px solid rgba(148, 163, 184, 0.25)' },
      },
    }),
    // every field is the dashboard's input: 40 px, 14 px text, the glass fill, an emerald border on focus;
    // variant="fleet" is the Proxmox forms' input (a slate fill, amber on focus) for a field among theirs
    Input: Input.extend({
      defaultProps: { size: 'sm' },
      vars: (_theme, props) => {
        const fleet = props.variant === 'fleet'
        return {
          wrapper: {
            '--input-bg': fleet ? 'var(--dcs-fleet-field-bg)' : 'var(--dcs-field-bg)',
            '--input-bd': 'var(--dcs-field-border)',
            '--input-bd-focus': fleet ? 'var(--dcs-fleet-field-focus)' : 'var(--dcs-field-focus)',
            '--input-color': 'var(--dcs-field-color)',
            '--input-placeholder-color': 'var(--dcs-field-placeholder)',
            '--input-height': '40px',
            '--input-fz': '14px',
            '--input-radius': '8px',
            ...(fleet ? { '--dcs-field-ring': 'var(--dcs-fleet-field-ring)' } : {}),
          },
        }
      },
    }),
    Select: Select.extend({
      defaultProps: {
        allowDeselect: false,
        withCheckIcon: false,
        maxDropdownHeight: 320,
        comboboxProps: { offset: 6, zIndex: LAYER, transitionProps: { transition: 'fade', duration: 120 } },
      },
      styles: {
        dropdown: { ...DROPDOWN, padding: 4 },
        option: { fontSize: 13, borderRadius: 6, padding: '7px 10px' },
        groupLabel: { fontSize: 11, fontWeight: 600, color: 'var(--dcs-muted)', padding: '8px 10px 4px' },
        empty: { fontSize: 12, color: 'var(--dcs-muted)' },
      },
    }),
    Combobox: Combobox.extend({ defaultProps: { zIndex: LAYER }, styles: { dropdown: DROPDOWN } }),
    Popover: Popover.extend({ defaultProps: { zIndex: LAYER }, styles: { dropdown: DROPDOWN } }),
    // chips and pills: the dashboard's pill (10 px, normal case, medium weight, a hairline border in its colour)
    Badge: Badge.extend({
      defaultProps: { variant: 'light', size: 'sm', radius: 'xl' },
      vars: (_theme, props) => ({
        root: props.variant === 'light' ? { '--badge-bd': `1px solid var(--dcs-tint-${paletteColor(props.color, 'emerald')}-border)` } : {},
      }),
      styles: { root: { textTransform: 'none', fontWeight: 500, letterSpacing: 0, flexShrink: 0 } },
    }),
    // a row of choices (filters, view switches): the dashboard's pill bar, the choice in a tint of its colour
    SegmentedControl: SegmentedControl.extend({
      defaultProps: { size: 'xs', radius: 8, withItemsBorders: false, transitionDuration: 150 },
      // (Mantine gives a coloured control's labels a white --sc-label-color of their own; mantine-dcs.css
      // colours the chosen label from --dcs-seg-active instead, so it reads on the tint in both schemes)
      vars: (_theme, props) => ({
        root: {
          '--sc-color': `var(--mantine-color-${paletteColor(props.color, 'emerald')}-light-hover)`,
          '--dcs-seg-active': `var(--mantine-color-${paletteColor(props.color, 'emerald')}-light-color)`,
          '--sc-font-size': '12px',
          '--sc-padding': '6px 10px',
        },
      }),
      styles: { root: { background: 'var(--dcs-seg-bg)', border: '1px solid var(--dcs-seg-border)', padding: 2 } },
    }),
    // on / off: the dashboard's toggle (a 46 × 24 track, the 500 of its colour when on — emerald unless told)
    Switch: Switch.extend({
      defaultProps: { size: 'md', color: 'emerald' },
      vars: (_theme, props) => ({ root: { '--switch-color': `var(--mantine-color-${paletteColor(props.color, 'emerald')}-5)` } }),
      styles: { label: { fontSize: 12, paddingInlineStart: 10, color: 'inherit' }, description: { fontSize: 11 } },
    }),
  },
})

function useLightMode(): boolean {
  const html = typeof document !== 'undefined' ? document.documentElement : null
  const [light, setLight] = useState(() => !!html?.classList.contains('light'))
  useEffect(() => {
    if (!html) return
    const sync = () => setLight(html.classList.contains('light'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(html, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [html])
  return light
}

export function DcsMantineProvider({ children }: { children: ReactNode }) {
  const light = useLightMode()
  return (
    <MantineProvider theme={theme} forceColorScheme={light ? 'light' : 'dark'} cssVariablesResolver={cssVariablesResolver}>
      {children}
    </MantineProvider>
  )
}
