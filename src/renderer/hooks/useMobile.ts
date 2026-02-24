import { Capacitor } from '@capacitor/core'

export const isMobile = Capacitor.isNativePlatform() || window.innerWidth < 768
export const isNative = Capacitor.isNativePlatform()
