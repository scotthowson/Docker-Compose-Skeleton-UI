import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { pageTitles } from './constants/pageTitles'
import { StatusBar } from './components/layout/StatusBar'
import { ToastProvider } from './components/common/Toast'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import OnboardingOverlay from './components/common/OnboardingOverlay'
import { CommandPalette } from './components/CommandPalette'
import { KeyboardShortcuts } from './components/KeyboardShortcuts'
import { GlobalPoller } from './components/GlobalPoller'
import { useSettingsStore } from './stores/settingsStore'
import { useConnectionStore } from './stores/connectionStore'
import { useAuthStore } from './stores/authStore'
import { getDefaultServerUrl } from './lib/env'
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
import Trends from './pages/Trends'
import Updates from './pages/Updates'
import Notifications from './pages/Notifications'
import Snapshots from './pages/Snapshots'
import Templates from './pages/Templates'
import Automations from './pages/Automations'
import Topology from './pages/Topology'
import FileBrowser from './pages/FileBrowser'
import DiskAnalysis from './pages/DiskAnalysis'
import Secrets from './pages/Secrets'
import Schedules from './pages/Schedules'
import Plugins from './pages/Plugins'
import EventFeed from './pages/EventFeed'
import Export from './pages/Export'
import SetupWizard from './pages/SetupWizard'
import KeyboardShortcutsPanel from './components/common/KeyboardShortcutsPanel'
import { apiClient } from './api/client'
import { sseClient } from './lib/sse'
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
  trends: Trends,
  updates: Updates,
  notifications: Notifications,
  snapshots: Snapshots,
  templates: Templates,
  automations: Automations,
  topology: Topology,
  'file-browser': FileBrowser,
  'disk-analysis': DiskAnalysis,
  secrets: Secrets,
  schedules: Schedules,
  plugins: Plugins,
  'event-feed': EventFeed,
  export: Export,
  setup: SetupWizard as unknown as React.ComponentType,
}

// Page order for Ctrl+1-9 navigation
const pageOrder: PageId[] = ['dashboard', 'stacks', 'containers', 'images', 'health', 'networks', 'volumes', 'uptime', 'bookmarks', 'activity', 'logs', 'system', 'diagnostics', 'terminal']

export default function App() {
  const { currentPage, loadSettings, setCurrentPage, theme, toggleSidebar, updateSetting, autoLockMinutes, customCSS } = useSettingsStore()
  const { connect, setServerUrl } = useConnectionStore()
  const { isAuthenticated, loading: authLoading, checkAccountExists, logout } = useAuthStore()
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const [transitionPage, setTransitionPage] = useState(currentPage)
  const [transitioning, setTransitioning] = useState(false)
  const [settingsReady, setSettingsReady] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Smooth logout transition: brief fade-to-dark before Login mounts.
  // useLayoutEffect fires synchronously BEFORE the browser paints, so
  // the user never sees Login flash before the dark screen appears.
  const [logoutFading, setLogoutFading] = useState(false)
  const prevAuthRef = useRef(isAuthenticated)
  useLayoutEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      setLogoutFading(true)
      const timer = setTimeout(() => setLogoutFading(false), 300)
      prevAuthRef.current = false
      return () => clearTimeout(timer)
    }
    prevAuthRef.current = isAuthenticated
  }, [isAuthenticated])

  // Load settings first, then sync server URL to the connection layer
  useEffect(() => {
    async function init() {
      checkAccountExists()
      await loadSettings()
      // After settings load, sync the persisted server URL to apiClient + connectionStore
      const { serverUrl } = useSettingsStore.getState()
      if (serverUrl) {
        setServerUrl(serverUrl)
      }

      // Check if server needs first-run setup.
      // In Electron: single IPC call uses Node.js http in main process (no CORS).
      // In browser: falls back to raw fetch().
      let currentServerUrl = useSettingsStore.getState().serverUrl || getDefaultServerUrl()
      // Don't prepend http:// on relative URLs (Docker/web mode uses /api)
      if (!currentServerUrl.startsWith('/') && !/^https?:\/\//i.test(currentServerUrl)) currentServerUrl = `http://${currentServerUrl}`
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          let initialized = true
          if (window.electronAPI?.checkServer) {
            const res = await window.electronAPI.checkServer(currentServerUrl)
            if (res.reachable) {
              initialized = res.initialized
            }
          } else {
            const ctrl = new AbortController()
            const tid = setTimeout(() => ctrl.abort(), 5000)
            const resp = await fetch(`${currentServerUrl}/setup/status`, { method: 'GET', signal: ctrl.signal })
            clearTimeout(tid)
            if (resp.ok) {
              const data = await resp.json()
              initialized = !!data.initialized
            }
          }
          if (!initialized) {
            if (window.electronAPI) {
              await window.electronAPI.setSetting('userAccounts', undefined)
            }
            localStorage.removeItem('userAccounts')
            localStorage.removeItem('auth-session')
            localStorage.removeItem('api-auth-token')
            apiClient.setAuthToken(null)
            useAuthStore.setState({ hasAccount: false, isAuthenticated: false, currentUser: null })
            setCurrentPage('setup')
            setSettingsReady(true)
            return
          }
          break
        } catch {
          if (attempt < 2) await new Promise(r => setTimeout(r, 300))
        }
      }

      // If user has a valid session, ensure role is resolved
      const { currentUser, apiToken, setUserRole, userRole } = useAuthStore.getState()
      if (currentUser && !userRole) {
        // Try server first (if we have a token)
        if (apiToken) {
          try {
            const { authVerify } = await import('./api/endpoints')
            const res = await authVerify()
            if (res.role) {
              setUserRole(res.role as 'admin' | 'user', currentUser)
            }
          } catch {
            // Server unreachable — fall through to checkAccountExists migration
          }
        }
        // checkAccountExists() already handles the default-role fallback,
        // but if it ran before accounts were loaded (race), re-trigger it
        if (!useAuthStore.getState().userRole) {
          await useAuthStore.getState().checkAccountExists()
        }
      }

      setSettingsReady(true)
    }
    init()
  }, [checkAccountExists, loadSettings, setServerUrl, setCurrentPage])

  // Only connect after settings are loaded and server URL is synced
  useEffect(() => {
    if (isAuthenticated && settingsReady) {
      connect()
    }
  }, [isAuthenticated, settingsReady, connect])

  // Activate SSE when connected, disconnect when not
  const connectionStatus = useConnectionStore((s) => s.status)
  useEffect(() => {
    if (connectionStatus === 'connected') {
      sseClient.connect()
    } else {
      sseClient.disconnect()
    }
    return () => sseClient.disconnect()
  }, [connectionStatus])

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Apply per-user appearance (accent color + background image)
  const [accentColor, setAccentColor] = useState('emerald')
  const [backgroundImage, setBackgroundImage] = useState('')
  const currentUser = useAuthStore((s) => s.currentUser)
  useEffect(() => {
    const readProfile = () => {
      try {
        const key = currentUser ? `user-profile-${currentUser}` : 'user-profile'
        let raw = localStorage.getItem(key)
        // Fallback to legacy global key for migration
        if (!raw && key !== 'user-profile') raw = localStorage.getItem('user-profile')
        if (raw) {
          const parsed = JSON.parse(raw)
          setAccentColor(parsed.accentColor || 'emerald')
          setBackgroundImage(parsed.backgroundImage || '')
          return
        }
      } catch {}
      setAccentColor('emerald')
      setBackgroundImage('')
    }
    readProfile()
    window.addEventListener('profile-updated', readProfile)
    return () => window.removeEventListener('profile-updated', readProfile)
  }, [currentUser])

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor)
  }, [accentColor])

  // Sync document title with current page
  useEffect(() => {
    const title = pageTitles[currentPage] || 'Dashboard'
    document.title = `${title} — DCS Manager`
  }, [currentPage])

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
      mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      const timer = setTimeout(() => {
        setTransitionPage(currentPage)
        setTransitioning(false)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [currentPage, transitionPage])

  // Global keyboard shortcuts
  useEffect(() => {
    if (!isAuthenticated || currentPage === 'setup') return
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      const digit = parseInt(e.key, 10)
      if (digit >= 1 && digit <= 9) {
        const page = pageOrder[digit - 1]
        if (page) {
          e.preventDefault()
          const current = useSettingsStore.getState().currentPage
          current === page
            ? setCurrentPage(page, { resetView: true })
            : setCurrentPage(page)
        }
      }
      // Ctrl+0 → Settings (10th page)
      if (e.key === '0') {
        e.preventDefault()
        const current = useSettingsStore.getState().currentPage
        current === 'settings'
          ? setCurrentPage('settings', { resetView: true })
          : setCurrentPage('settings')
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
  }, [setCurrentPage, isAuthenticated, currentPage, toggleSidebar, updateSetting])

  // ? key to toggle keyboard shortcuts panel (only when no input focused)
  useEffect(() => {
    if (!isAuthenticated || currentPage === 'setup') return
    function handleQuestion(e: KeyboardEvent) {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return
      e.preventDefault()
      setShowShortcuts((prev) => !prev)
    }
    window.addEventListener('keydown', handleQuestion)
    return () => window.removeEventListener('keydown', handleQuestion)
  }, [isAuthenticated, currentPage])

  // Show setup wizard if server needs first-run setup
  if (currentPage === 'setup' && settingsReady) {
    return <SetupWizard onComplete={() => setCurrentPage('dashboard')} />
  }

  // Show login screen if not authenticated
  if (!settingsReady || authLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-xl" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-gradient">DCS Manager</h1>
            <p className="text-xs text-slate-500 mt-1.5">Docker Compose Skeleton</p>
          </div>
          <div className="w-32 h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-emerald-500/40 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // During logout fade, show a brief dark screen so the layout doesn't
    // abruptly snap from the full dashboard to the login form.
    if (logoutFading) {
      return <div className="h-screen bg-slate-950" />
    }
    return <Login />
  }

  const ActivePage = pageComponents[transitionPage] || Dashboard

  return (
    <ToastProvider>
      <div
        className="h-screen flex flex-col bg-slate-950 overflow-hidden theme-bg safe-area-top safe-area-bottom"
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

        {/* Onboarding overlay (self-managing visibility via localStorage) */}
        <OnboardingOverlay />

        {/* Global data polling (sidebar badges, status bar) */}
        <GlobalPoller />

        {/* Command Palette + Keyboard Shortcuts */}
        <CommandPalette />
        <KeyboardShortcuts />
        <KeyboardShortcutsPanel open={showShortcuts} onClose={() => setShowShortcuts(false)} />

        {/* Header — z-30 so dropdown renders above content area */}
        <div className="relative z-30">
          <Header />
        </div>

        <div className="flex flex-1 overflow-hidden relative z-10">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content area */}
          <main ref={mainRef} className="flex-1 overflow-y-auto p-3 md:p-6 transition-all duration-300 scrollbar-thin">
            <div className={`max-w-[1600px] mx-auto transition-all duration-150 ${transitioning ? 'opacity-0 translate-y-0.5 scale-[0.998]' : 'opacity-100 translate-y-0 scale-100'}`}>
              <ErrorBoundary
                key={transitionPage}
                fallbackMessage="This page encountered an error"
                onNavigateHome={() => setCurrentPage('dashboard')}
              >
                <ActivePage />
              </ErrorBoundary>
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
