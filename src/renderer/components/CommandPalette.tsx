// =============================================================================
// CommandPalette — Spotlight-style global search (Ctrl+K / Cmd+K)
// =============================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Search, LayoutDashboard, Layers, Box, HardDrive, HeartPulse, Clock, Network,
  ScrollText, Monitor, Settings2, Cog, ArrowRight, Trash2, Play, Square,
  RotateCw, Command, Wrench, Sun, Moon, PanelLeftClose, PanelLeft,
  LogOut, RefreshCw, Download, Lock, Shield, UserCircle, Bookmark, Zap, Users,
  FileCode, Archive, Database, TerminalSquare, CalendarClock,
} from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { useSystemStore } from '../stores/systemStore'
import { useHealthStore } from '../stores/healthStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from './common/Toast'
import {
  startStack, stopStack, restartStack,
  runImagePrune, triggerLogRotate, fetchHealthReport, triggerBackup,
} from '../api/endpoints'
import type { PageId } from '../../shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandType = 'page' | 'action' | 'stack'

interface CommandItem {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  type: CommandType
  keywords?: string[]
  onSelect: () => void
}

// ---------------------------------------------------------------------------
// Navigation commands
// ---------------------------------------------------------------------------

const pageIcon: Record<PageId, React.ReactNode> = {
  dashboard: <LayoutDashboard size={16} />,
  stacks: <Layers size={16} />,
  containers: <Box size={16} />,
  images: <HardDrive size={16} />,
  health: <HeartPulse size={16} />,
  uptime: <Clock size={16} />,
  networks: <Network size={16} />,
  volumes: <Database size={16} />,
  logs: <ScrollText size={16} />,
  system: <Monitor size={16} />,
  config: <Settings2 size={16} />,
  settings: <Cog size={16} />,
  bookmarks: <Bookmark size={16} />,
  activity: <Zap size={16} />,
  diagnostics: <Shield size={16} />,
  users: <Users size={16} />,
  maintenance: <Wrench size={16} />,
  environment: <FileCode size={16} />,
  backup: <Archive size={16} />,
  terminal: <TerminalSquare size={16} />,
  cronjobs: <CalendarClock size={16} />,
}

const pageLabels: Record<PageId, string> = {
  dashboard: 'Dashboard',
  stacks: 'Stacks',
  containers: 'Containers',
  images: 'Images',
  health: 'Health Monitor',
  uptime: 'Uptime Monitor',
  networks: 'Networks',
  volumes: 'Volumes',
  bookmarks: 'Bookmarks',
  activity: 'Activity',
  maintenance: 'Maintenance',
  environment: 'Environment Variables',
  backup: 'Backup & Restore',
  terminal: 'Terminal',
  logs: 'Log Viewer',
  system: 'System Info',
  diagnostics: 'Diagnostics',
  users: 'User Management',
  config: 'Server Config',
  settings: 'Settings',
  cronjobs: 'Cron Jobs',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar)
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const theme = useSettingsStore((s) => s.theme)
  const status = useSystemStore((s) => s.status)
  const health = useHealthStore((s) => s.report)
  const connectionStatus = useConnectionStore((s) => s.status)
  const { logout } = useAuthStore()
  const setHealthReport = useHealthStore((s) => s.setReport)
  const { addToast } = useToast()
  const isConnected = connectionStatus === 'connected'

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Ctrl+Shift+P alternative trigger via custom event from App.tsx
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('open-command-palette', handler)
    return () => window.removeEventListener('open-command-palette', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = []

    // Navigation commands
    const pages: PageId[] = ['dashboard', 'stacks', 'containers', 'images', 'health', 'networks', 'volumes', 'uptime', 'bookmarks', 'activity', 'terminal', 'cronjobs', 'maintenance', 'environment', 'backup', 'logs', 'system', 'diagnostics', 'users', 'config', 'settings']
    for (const page of pages) {
      items.push({
        id: `nav-${page}`,
        label: `Go to ${pageLabels[page]}`,
        description: 'Navigate',
        icon: pageIcon[page],
        type: 'page',
        keywords: [page, pageLabels[page].toLowerCase()],
        onSelect: () => {
          setCurrentPage(page)
          setOpen(false)
        },
      })
    }

    // Quick info commands
    if (status) {
      items.push({
        id: 'info-containers',
        label: `${status.docker.containers.running} / ${status.docker.containers.total} Containers Running`,
        description: `${status.docker.containers.stopped} stopped`,
        icon: <Box size={16} className="text-cyan-400" />,
        type: 'action',
        keywords: ['container', 'running', 'status'],
        onSelect: () => {
          setCurrentPage('containers')
          setOpen(false)
        },
      })
      items.push({
        id: 'info-stacks',
        label: `${status.stacks.running} / ${status.stacks.total} Stacks Running`,
        description: 'Stack overview',
        icon: <Layers size={16} className="text-emerald-400" />,
        type: 'action',
        keywords: ['stack', 'running'],
        onSelect: () => {
          setCurrentPage('stacks')
          setOpen(false)
        },
      })
    }

    if (health) {
      items.push({
        id: 'info-health',
        label: `System Health: ${health.status.charAt(0).toUpperCase() + health.status.slice(1)}`,
        description: `${health.summary.healthy}/${health.summary.total} healthy`,
        icon: <HeartPulse size={16} className={
          health.status === 'healthy' ? 'text-emerald-400'
            : health.status === 'degraded' ? 'text-amber-400'
              : 'text-rose-400'
        } />,
        type: 'action',
        keywords: ['health', 'healthy', 'status'],
        onSelect: () => {
          setCurrentPage('health')
          setOpen(false)
        },
      })
    }

    // Action commands
    items.push({
      id: 'action-theme',
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      description: 'Toggle theme',
      icon: theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-violet-400" />,
      type: 'action',
      keywords: ['theme', 'dark', 'light', 'mode', 'toggle'],
      onSelect: () => {
        updateSetting('theme', theme === 'dark' ? 'light' : 'dark')
        setOpen(false)
      },
    })

    items.push({
      id: 'action-sidebar',
      label: sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar',
      description: 'Toggle sidebar visibility',
      icon: sidebarCollapsed
        ? <PanelLeft size={16} className="text-cyan-400" />
        : <PanelLeftClose size={16} className="text-cyan-400" />,
      type: 'action',
      keywords: ['sidebar', 'toggle', 'collapse', 'expand', 'panel'],
      onSelect: () => {
        toggleSidebar()
        setOpen(false)
      },
    })

    items.push({
      id: 'action-refresh',
      label: 'Refresh All Data',
      description: 'Re-fetch all data from server (Ctrl+R)',
      icon: <RefreshCw size={16} className="text-emerald-400" />,
      type: 'action',
      keywords: ['refresh', 'reload', 'fetch', 'update', 'data'],
      onSelect: () => {
        window.dispatchEvent(new CustomEvent('app-refresh'))
        setOpen(false)
      },
    })

    items.push({
      id: 'action-profile',
      label: 'Edit Profile',
      description: 'Update your display name, avatar, and email',
      icon: <UserCircle size={16} className="text-emerald-400" />,
      type: 'action',
      keywords: ['profile', 'avatar', 'name', 'email', 'account'],
      onSelect: () => {
        setCurrentPage('settings')
        setOpen(false)
      },
    })

    items.push({
      id: 'action-security',
      label: 'Security & Password',
      description: 'Change password, view security settings',
      icon: <Shield size={16} className="text-rose-400" />,
      type: 'action',
      keywords: ['security', 'password', 'change', 'account', 'auth'],
      onSelect: () => {
        setCurrentPage('settings')
        setOpen(false)
      },
    })

    items.push({
      id: 'action-export',
      label: 'Export Settings',
      description: 'Download settings as JSON backup',
      icon: <Download size={16} className="text-cyan-400" />,
      type: 'action',
      keywords: ['export', 'backup', 'settings', 'download', 'json'],
      onSelect: () => {
        window.dispatchEvent(new CustomEvent('export-settings'))
        setOpen(false)
      },
    })

    items.push({
      id: 'action-logout',
      label: 'Sign Out',
      description: 'Log out of your account',
      icon: <LogOut size={16} className="text-rose-400" />,
      type: 'action',
      keywords: ['logout', 'sign out', 'exit', 'quit'],
      onSelect: () => {
        logout()
        setOpen(false)
      },
    })

    // --- Server action commands (require connection) ---
    if (isConnected) {
      items.push({
        id: 'action-prune',
        label: 'Prune Docker Images',
        description: 'Remove dangling and unused images',
        icon: <Trash2 size={16} className="text-orange-400" />,
        type: 'action',
        keywords: ['prune', 'clean', 'docker', 'images', 'dangling', 'unused'],
        onSelect: async () => {
          setOpen(false)
          try {
            const r = await runImagePrune()
            addToast({ type: r.success ? 'success' : 'error', message: r.success ? 'Stale images pruned' : 'Image prune failed' })
          } catch { addToast({ type: 'error', message: 'Image prune failed' }) }
        },
      })

      items.push({
        id: 'action-rotate-logs',
        label: 'Rotate Server Logs',
        description: 'Archive and rotate the server log file',
        icon: <Archive size={16} className="text-pink-400" />,
        type: 'action',
        keywords: ['rotate', 'logs', 'archive', 'clean', 'log'],
        onSelect: async () => {
          setOpen(false)
          try {
            const r = await triggerLogRotate()
            addToast({
              type: r.success ? 'success' : 'error',
              message: r.success
                ? `Logs rotated${r.archived_as ? ` — archived as ${r.archived_as}` : ''}`
                : 'Log rotation failed',
            })
          } catch { addToast({ type: 'error', message: 'Log rotation failed' }) }
        },
      })

      items.push({
        id: 'action-check-health',
        label: 'Run Health Check',
        description: 'Fetch a fresh health report from the server',
        icon: <HeartPulse size={16} className="text-emerald-400" />,
        type: 'action',
        keywords: ['health', 'check', 'diagnose', 'status', 'monitor'],
        onSelect: async () => {
          setOpen(false)
          try {
            const report = await fetchHealthReport()
            setHealthReport(report)
            addToast({
              type: report.status === 'healthy' ? 'success' : report.status === 'degraded' ? 'warning' : 'error',
              message: `Health: ${report.status} — ${report.summary.healthy}/${report.summary.total} healthy`,
            })
          } catch { addToast({ type: 'error', message: 'Health check failed' }) }
        },
      })

      items.push({
        id: 'action-backup',
        label: 'Run Backup Now',
        description: 'Trigger a full server backup',
        icon: <Download size={16} className="text-cyan-400" />,
        type: 'action',
        keywords: ['backup', 'snapshot', 'save', 'export', 'archive'],
        onSelect: async () => {
          setOpen(false)
          try {
            const r = await triggerBackup()
            addToast({
              type: r.success ? 'success' : 'error',
              message: r.success ? `Backup started: ${r.filename}` : 'Backup failed',
            })
          } catch { addToast({ type: 'error', message: 'Backup trigger failed' }) }
        },
      })
    }

    return items
  }, [setCurrentPage, status, health, isConnected, theme, sidebarCollapsed, toggleSidebar, updateSetting, logout, addToast, setHealthReport])

  // Filter commands
  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter((cmd) => {
      if (cmd.label.toLowerCase().includes(q)) return true
      if (cmd.description.toLowerCase().includes(q)) return true
      return cmd.keywords?.some((k) => k.includes(q)) ?? false
    })
  }, [commands, query])

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filtered.length])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault()
        filtered[selectedIndex].onSelect()
      }
    },
    [filtered, selectedIndex],
  )

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div
        className="
          relative w-full max-w-lg
          bg-slate-900/95 backdrop-blur-2xl
          border border-white/[0.08]
          rounded-2xl shadow-2xl shadow-black/40
          overflow-hidden
          animate-scale-in
        "
        onKeyDown={handleKeyDown}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 border-b border-white/[0.06]">
          <Search size={18} className="text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, containers, stacks..."
            className="
              flex-1 bg-transparent py-4
              text-sm text-slate-100 placeholder-slate-500
              focus:outline-none
            "
          />
          <kbd className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-500 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2 scrollbar-thin">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No results for "{query}"
            </div>
          )}
          {filtered.map((cmd, idx) => {
            const isSelected = idx === selectedIndex
            return (
              <button
                key={cmd.id}
                onClick={cmd.onSelect}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`
                  flex items-center gap-3 w-full px-4 py-2.5 text-left
                  transition-colors duration-100
                  ${isSelected
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-300 hover:bg-white/[0.04]'
                  }
                `}
              >
                <div className={`
                  shrink-0 rounded-lg p-1.5
                  ${isSelected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.05] text-slate-400'}
                `}>
                  {cmd.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cmd.label}</p>
                  <p className="text-[11px] text-slate-500 truncate">{cmd.description}</p>
                </div>
                {isSelected && (
                  <ArrowRight size={14} className="shrink-0 text-emerald-400/60" />
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06] text-[11px] text-slate-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px]">&uarr;</kbd>
              <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px]">&darr;</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px]">&crarr;</kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command size={10} />
            <span>K to toggle</span>
          </span>
        </div>
      </div>
    </div>
  )
}
