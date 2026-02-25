import { Capacitor } from '@capacitor/core'

export const isMobile = Capacitor.isNativePlatform() || window.innerWidth < 768
export const isNative = Capacitor.isNativePlatform()

// Configure StatusBar on native platforms
if (isNative) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: true })
    StatusBar.setStyle({ style: Style.Dark })
    StatusBar.setBackgroundColor({ color: '#0f172a' })
  }).catch(() => {})
}
