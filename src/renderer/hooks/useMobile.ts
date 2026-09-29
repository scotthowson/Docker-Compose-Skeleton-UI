import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

export const isMobile = Capacitor.isNativePlatform() || window.innerWidth < 768
export const isNative = Capacitor.isNativePlatform()

/**
 * True while the window is narrower than Tailwind's `lg` (1024 px, where the header also drops its wide search
 * bar). Live, unlike `isMobile`, which is read once at load: a layout that gives way to a narrow window reads
 * this, so widening the window gives it back — without writing anything to the person's settings.
 */
export function useNarrowWindow(): boolean {
  const query = '(max-width: 1023.98px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return narrow
}

// Configure StatusBar on native platforms: the page draws under it, and its icons
// suit the look index.html put up before the first paint (lib/nativeLook keeps
// them in step with every later change of look)
if (isNative) {
  const light = document.documentElement.classList.contains('light')
  const color = document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || (light ? '#ffffff' : '#0f172a')
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: true })
    StatusBar.setStyle({ style: light ? Style.Light : Style.Dark })
    StatusBar.setBackgroundColor({ color })
  }).catch(() => {})
}
