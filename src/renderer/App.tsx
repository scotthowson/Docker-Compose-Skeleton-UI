import { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { StatusBar } from './components/layout/StatusBar'
import { ToastProvider } from './components/common/Toast'
import { CommandPalette } from './components/CommandPalette'
import { KeyboardShortcuts } from './components/KeyboardShortcuts'
import { useSettingsStore } from './stores/settingsStore'
import { useConnectionStore } from './stores/connectionStore'
import { useAuthStore } from './stores/authStore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stacks from './pages/Stacks'
import Containers from './pages/Containers'
import Images from './pages/Images'
import Health from './pages/Health'
import Uptime from './pages/Uptime'
import Networks from './pages/Networks'
import Logs from './pages/Logs'
import System from './pages/System'
import Config from './pages/Config'
import Settings from './pages/Settings'
import Bookmarks from './pages/Bookmarks'
import Activity from './pages/Activity'
import Diagnostics from './pages/Diagnostics'
import Users from './pages/Users'
import Maintenance from './pages/Maintenance'
import Environment from './pages/Environment'
import Volumes from './pages/Volumes'
import Backup from './pages/Backup'
import Terminal from './pages/Terminal'
import CronJobs from './pages/CronJobs'
import type { PageId } from '../shared/types'

const pageComponents: Record<PageId, React.ComponentType> = {
  dashboard: Dashboard,
  stacks: Stacks,
  containers: Containers,
  images: Images,
  health: Health,
  uptime: Uptime,
  networks: Networks,
  volumes: Volumes,
  bookmarks: Bookmarks,
  activity: Activity,
  logs: Logs,
  system: System,
  diagnostics: Diagnostics,
  config: Config,
  settings: Settings,
  users: Users,
  maintenance: Maintenance,
  environment: Environment,
  backup: Backup,
  terminal: Terminal,
  cronjobs: CronJobs,
}

// Page order for Ctrl+1-9 navigation
const pageOrder: PageId[] = ['dashboard', 'stacks', 'containers', 'images', 'health', 'networks', 'volumes', 'uptime', 'bookmarks', 'activity', 'logs', 'system', 'diagnostics', 'terminal']

export default function App() {
  const { currentPage, loadSettings, setCurrentPage, theme, backgroundImage, toggleSidebar, updateSetting, autoLockMinutes, customCSS } = useSettingsStore()
  const { connect } = useConnectionStore()
  const { isAuthenticated, loading: authLoading, checkAccountExists, logout } = useAuthStore()
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [transitionPage, setTransitionPage] = useState(currentPage)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    checkAccountExists()
    loadSettings()
  }, [checkAccountExists, loadSettings])

  useEffect(() => {
    if (isAuthenticated) {
      connect()
    }
  }, [isAuthenticated, connect])

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Custom CSS injection
  useEffect(() => {
    let styleEl = document.getElementById('custom-user-css') as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'custom-user-css'
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = customCSS || ''
    return () => {
      // Don't remove on cleanup — persist across re-renders
    }
  }, [customCSS])

  // Auto-lock after inactivity
  const resetAutoLock = useCallback(() => {
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current)
      autoLockTimerRef.current = null
    }
    if (autoLockMinutes > 0 && isAuthenticated) {
      autoLockTimerRef.current = setTimeout(() => {
        logout()
      }, autoLockMinutes * 60 * 1000)
    }
  }, [autoLockMinutes, isAuthenticated, logout])

  useEffect(() => {
    if (!isAuthenticated || autoLockMinutes <= 0) return
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const
    const handler = () => resetAutoLock()
    for (const evt of events) window.addEventListener(evt, handler, { passive: true })
    resetAutoLock()
    return () => {
      for (const evt of events) window.removeEventListener(evt, handler)
      if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current)
    }
  }, [isAuthenticated, autoLockMinutes, resetAutoLock])

  // Smooth page transition: fade out, swap component, fade in
  useEffect(() => {
    if (currentPage !== transitionPage) {
      setTransitioning(true)
      const timer = setTimeout(() => {
        setTransitionPage(currentPage)
        setTransitioning(false)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [currentPage, transitionPage])

  // Global keyboard shortcuts
  useEffect(() => {
    if (!isAuthenticated) return
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      const digit = parseInt(e.key, 10)
      if (digit >= 1 && digit <= 9) {
        const page = pageOrder[digit - 1]
        if (page) {
          e.preventDefault()
          setCurrentPage(page)
        }
      }
      // Ctrl+0 → Settings (10th page)
      if (e.key === '0') {
        e.preventDefault()
        setCurrentPage('settings')
      }
      // Ctrl+B → Toggle sidebar
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        toggleSidebar()
      }
      // Ctrl+D → Toggle dark/light theme
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        const current = useSettingsStore.getState().theme
        updateSetting('theme', current === 'dark' ? 'light' : 'dark')
      }
      // Ctrl+R → Refresh (dispatch custom event for pages to listen to)
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app-refresh'))
      }
      // Ctrl+T → Terminal
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        setCurrentPage('terminal')
      }
      // Ctrl+Shift+P → Command Palette (alternative to Ctrl+K)
      if (e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-command-palette'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCurrentPage, isAuthenticated, toggleSidebar, updateSetting])

  // Show login screen if not authenticated
  if (authLoading) {
    return <div className="h-screen bg-slate-950" />
  }

  if (!isAuthenticated) {
    return <Login />
  }

  const ActivePage = pageComponents[transitionPage] || Dashboard

  return (
    <ToastProvider>
      <div
        className="h-screen flex flex-col bg-slate-950 overflow-hidden theme-bg"
        style={backgroundImage ? {
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        } : undefined}
      >
        {/* Background overlay for readability when using bg image */}
        {backgroundImage && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-0" />
        )}

        {/* Command Palette + Keyboard Shortcuts */}
        <CommandPalette />
        <KeyboardShortcuts />

        {/* Header — z-30 so dropdown renders above content area */}
        <div className="relative z-30">
          <Header />
        </div>

        <div className="flex flex-1 overflow-hidden relative z-10">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-3 md:p-6 transition-all duration-300 scrollbar-thin">
            <div className={`max-w-[1600px] mx-auto transition-all duration-150 ${transitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
              <ActivePage />
            </div>
          </main>
        </div>

        {/* Status bar */}
        <div className="relative z-10">
          <StatusBar />
        </div>
      </div>
    </ToastProvider>
  )
}
