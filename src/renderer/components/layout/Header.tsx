// =============================================================================
// Header — Top bar with page title, user profile dropdown, theme toggle, status
// =============================================================================

import { useState, useRef, useEffect } from 'react'
import {
  Sun, Moon, LogOut, ChevronDown, Settings, Shield,
  UserCircle, Mail, Clock, Bell,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { useSystemStore } from '../../stores/systemStore'
import { useAuthStore } from '../../stores/authStore'
import { useNotificationStore } from '../../stores/notificationStore'
import { NotificationDrawer } from '../NotificationDrawer'
import type { PageId } from '../../../shared/types'
import type { ConnectionStatus } from '../../../shared/types'

const pageTitles: Record<PageId, string> = {
  dashboard: 'Dashboard',
  stacks: 'Stack Manager',
  containers: 'Containers',
  images: 'Images',
  health: 'Health Monitor',
  uptime: 'Uptime Monitor',
  networks: 'Networks',
  volumes: 'Volumes',
  bookmarks: 'Bookmarks',
  activity: 'Activity',
  maintenance: 'Maintenance',
  environment: 'Environment',
  backup: 'Backup & Restore',
  logs: 'Logs',
  system: 'System Info',
  diagnostics: 'Diagnostics',
  users: 'User Management',
  config: 'Server Config',
  settings: 'Settings',
  terminal: 'Terminal',
  cronjobs: 'Cron Jobs',
  trends: 'Resource Trends',
  updates: 'Image Updates',
  notifications: 'Notifications',
  snapshots: 'Snapshots',
  templates: 'Templates',
  automations: 'Automations',
  topology: 'Network Topology',
  'file-browser': 'File Browser',
  'disk-analysis': 'Disk Analysis',
  setup: 'Setup Wizard',
}

const statusConfig: Record<ConnectionStatus, { color: string; ringColor: string; pulse: boolean; label: string }> = {
  connected: {
    color: 'bg-emerald-400',
    ringColor: 'ring-emerald-400/30',
    pulse: false,
    label: 'Connected',
  },
  connecting: {
    color: 'bg-amber-400',
    ringColor: 'ring-amber-400/30',
    pulse: true,
    label: 'Connecting...',
  },
  disconnected: {
    color: 'bg-slate-500',
    ringColor: 'ring-slate-500/20',
    pulse: false,
    label: 'Disconnected',
  },
  error: {
    color: 'bg-rose-400',
    ringColor: 'ring-rose-400/30',
    pulse: true,
    label: 'Connection Error',
  },
}

// ---------------------------------------------------------------------------
// User Profile Dropdown
// ---------------------------------------------------------------------------

function UserProfileDropdown({ onClose }: { onClose: () => void }) {
  const { currentUser, logout } = useAuthStore()
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const ref = useRef<HTMLDivElement>(null)

  // Get profile data from localStorage
  const profileData = (() => {
    try {
      const raw = localStorage.getItem('user-profile')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })()

  const userInitial = (currentUser?.[0] ?? 'U').toUpperCase()
  const profileIcon = profileData.icon ?? ''
  const profileEmail = profileData.email ?? ''

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const menuItems = [
    {
      icon: UserCircle,
      label: 'Edit Profile',
      description: 'Name, email, avatar',
      onClick: () => { onClose(); setCurrentPage('settings') },
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Connection, preferences',
      onClick: () => { onClose(); setCurrentPage('settings') },
    },
    {
      icon: Shield,
      label: 'Security',
      description: 'Local auth, session',
      onClick: () => { onClose(); setCurrentPage('settings') },
    },
  ]

  return (
    <div
      ref={ref}
      className="no-drag absolute right-0 top-full mt-2 w-72 glass rounded-xl overflow-hidden animate-scale-in z-50 shadow-2xl shadow-black/30"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Profile header */}
      <div className="px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          {profileIcon ? (
            <img src={profileIcon} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover ring-2 ring-emerald-500/20" />
          ) : (
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">
              {userInitial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">{currentUser}</p>
            {profileEmail ? (
              <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                <Mail size={8} />
                {profileEmail}
              </p>
            ) : (
              <p className="text-[10px] text-slate-600">Administrator</p>
            )}
          </div>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-[9px] font-semibold text-emerald-400">
            <Clock size={8} />
            Active
          </span>
        </div>
      </div>

      {/* Menu items */}
      <div className="py-1.5">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="no-drag flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04]">
              <item.icon size={14} className="text-slate-400" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-slate-200">{item.label}</p>
              <p className="text-[10px] text-slate-600">{item.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Logout */}
      <div className="border-t border-white/[0.06] p-2">
        <button
          onClick={() => { onClose(); logout() }}
          className="no-drag flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          <span className="text-xs font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export function Header() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const theme = useSettingsStore((s) => s.theme)
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const connectionStatus = useConnectionStore((s) => s.status)
  const serverStatus = useSystemStore((s) => s.status)
  const { currentUser } = useAuthStore()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const toggleDrawer = useNotificationStore((s) => s.toggleDrawer)

  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [profileVersion, setProfileVersion] = useState(0)

  // Re-read profile data when the profile-updated event fires
  useEffect(() => {
    const handler = () => setProfileVersion((v) => v + 1)
    window.addEventListener('profile-updated', handler)
    return () => window.removeEventListener('profile-updated', handler)
  }, [])

  const title = pageTitles[currentPage] ?? 'Dashboard'
  const { color, ringColor, pulse, label } = statusConfig[connectionStatus]
  const hostname = serverStatus?.hostname
  const isDark = theme === 'dark'
  const userInitial = (currentUser?.[0] ?? 'U').toUpperCase()

  // Get profile icon (re-reads on profileVersion change)
  const profileIcon = (() => {
    void profileVersion // dependency trigger
    try {
      const raw = localStorage.getItem('user-profile')
      return raw ? JSON.parse(raw).icon ?? '' : ''
    } catch { return '' }
  })()

  const toggleTheme = () => {
    updateSetting('theme', isDark ? 'light' : 'dark')
  }

  return (
    <>
    <header
      className="
        drag-region
        flex items-center justify-between
        h-11 md:h-14 px-3 md:px-5
        bg-slate-900/80 backdrop-blur-2xl
        border-b border-white/[0.06]
        shrink-0
      "
    >
      {/* Left: Page title */}
      <div className="no-drag flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-200 select-none tracking-wide">
          {title}
        </h1>
        {hostname && (
          <span className="hidden md:contents">
            <span className="text-white/[0.08]">/</span>
            <span className="text-xs text-slate-500 font-mono select-none">
              {hostname}
            </span>
          </span>
        )}
      </div>

      {/* Right: Notifications + Search + User + Theme + Connection */}
      <div className="no-drag flex items-center gap-2.5">
        {/* Notification bell */}
        <button
          onClick={toggleDrawer}
          className="
            relative flex items-center justify-center w-7 h-7 md:w-8 md:h-8
            rounded-lg text-slate-400
            bg-white/[0.03] border border-white/[0.06]
            hover:bg-white/[0.08] hover:text-slate-200
            transition-all duration-200
          "
          title="Notifications"
        >
          <Bell size={14} />
          {unreadCount > 0 && (
            <span className="
              absolute -top-1 -right-1
              flex items-center justify-center
              min-w-[16px] h-4 px-1 rounded-full
              bg-rose-500 text-white
              text-[9px] font-bold leading-none
              ring-2 ring-slate-900
            ">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Command palette trigger */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="
            hidden sm:flex items-center gap-2
            rounded-lg px-2.5 py-1.5
            text-[11px] text-slate-500
            bg-white/[0.03] border border-white/[0.06]
            hover:bg-white/[0.06] hover:text-slate-400
            transition-all duration-200
          "
          title="Search (Ctrl+K)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <span>Search</span>
          <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 font-mono text-[9px]">Ctrl+K</kbd>
        </button>

        {/* User Profile Button */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="
                flex items-center gap-1.5 md:gap-2 px-1.5 md:px-2 py-1 md:py-1.5 rounded-lg
                bg-white/[0.03] border border-white/[0.06]
                hover:bg-white/[0.06] hover:border-white/[0.1]
                transition-all duration-200
              "
            >
              {profileIcon ? (
                <img src={profileIcon} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-[9px] font-bold">
                  {userInitial}
                </div>
              )}
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">{currentUser}</span>
              <ChevronDown size={10} className={`text-slate-600 transition-transform duration-200 hidden sm:block ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>

            {showProfileMenu && (
              <UserProfileDropdown onClose={() => setShowProfileMenu(false)} />
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="
            flex items-center justify-center w-7 h-7 md:w-8 md:h-8
            rounded-lg text-slate-400
            bg-white/[0.03] border border-white/[0.06]
            hover:bg-white/[0.08] hover:text-slate-200
            transition-all duration-200
          "
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Connection status pill */}
        <div className={`
          inline-flex items-center gap-1.5 md:gap-2 rounded-full px-2 md:px-3 py-1 md:py-1.5
          border transition-all duration-300
          ${connectionStatus === 'connected'
            ? 'bg-emerald-500/8 border-emerald-500/15'
            : connectionStatus === 'error'
              ? 'bg-rose-500/8 border-rose-500/15'
              : connectionStatus === 'connecting'
                ? 'bg-amber-500/8 border-amber-500/15'
                : 'bg-slate-500/8 border-slate-500/15'
          }
        `}>
          <span className="relative flex h-2 w-2">
            {pulse && (
              <span
                className={`absolute inset-0 rounded-full ${color} opacity-50 animate-ping`}
                style={{ animationDuration: '2s' }}
              />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${color} ring-2 ${ringColor}`} />
          </span>
          <span className="hidden sm:inline text-[11px] text-slate-400 font-medium">{label}</span>
        </div>
      </div>
    </header>
    <NotificationDrawer />
    </>
  )
}
