// =============================================================================
// Mantine (https://mantine.dev) in the dashboard — used where its components are
// better than what is here: progress bars and rings, timelines, tooltips. Only
// the styles of those components are loaded, and Mantine's page-level baseline
// (body, headings, form resets) is NOT: the pages that were built without it
// look exactly as before. Colours follow the dashboard's own palette (the same
// emerald / cyan / amber / rose as its Tailwind classes) and Mantine's light
// or dark scheme follows the dashboard's `light` class on <html>.
// =============================================================================

import { useEffect, useState, type ReactNode } from 'react'
import { MantineProvider, Tooltip, createTheme, type MantineColorsTuple } from '@mantine/core'
import '@mantine/core/styles/default-css-variables.css'
import '@mantine/core/styles/global.css'
import '@mantine/core/styles/Progress.css'
import '@mantine/core/styles/RingProgress.css'
import '@mantine/core/styles/Timeline.css'
import '@mantine/core/styles/Tooltip.css'
import '@mantine/core/styles/Text.css'

const scale = (c: readonly string[]) => c as unknown as MantineColorsTuple

// Tailwind's 50…900 scales, so Mantine's color="emerald" is the emerald the rest of the dashboard uses
const theme = createTheme({
  fontFamily: 'inherit',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  defaultRadius: 'md',
  primaryColor: 'emerald',
  primaryShade: { light: 6, dark: 4 },
  cursorType: 'pointer',
  colors: {
    emerald: scale(['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b']),
    cyan: scale(['#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63']),
    amber: scale(['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f']),
    rose: scale(['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337']),
    slate: scale(['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a']),
    // Mantine's own "dark" scale (surfaces and text in the dark scheme) on the dashboard's slate
    dark: scale(['#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#0b1220', '#020617']),
  },
  components: {
    // a dark bubble in both schemes (Mantine's own dark scheme uses a white one, which clashes with the dashboard)
    Tooltip: Tooltip.extend({
      defaultProps: { color: 'dark.7', withArrow: true, transitionProps: { duration: 120 } },
      styles: {
        tooltip: { border: '1px solid rgba(148, 163, 184, 0.25)', color: '#e2e8f0', fontSize: 12, padding: '6px 10px', boxShadow: '0 8px 24px rgba(2, 6, 23, 0.45)' },
        arrow: { border: '1px solid rgba(148, 163, 184, 0.25)' },
      },
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
    <MantineProvider theme={theme} forceColorScheme={light ? 'light' : 'dark'}>
      {children}
    </MantineProvider>
  )
}
