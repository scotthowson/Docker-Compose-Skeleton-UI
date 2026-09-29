import { Capacitor } from '@capacitor/core'

export const isMobile = Capacitor.isNativePlatform() || window.innerWidth < 768
export const isNative = Capacitor.isNativePlatform()

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
