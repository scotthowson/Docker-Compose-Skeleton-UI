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
  TrendingUp, ArrowUpCircle, Bell as BellIcon, Camera, LayoutTemplate, Bot, Share2,
  FolderOpen, PieChart, Sparkles, KeyRound, Puzzle, Radio, ListChecks,
} from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { useSystemStore } from '../stores/systemStore'
import { useHealthStore } from '../stores/healthStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from './common/Toast'
import {
  startStack, stopStack, restartStack,
  startContainer, stopContainer, restartContainer,
  runImagePrune, triggerLogRotate, fetchHealthReport, triggerBackup,
} from '../api/endpoints'
import { useStackStore } from '../stores/stackStore'
import { useContainerStore } from '../stores/containerStore'
import type { PageId } from '../../shared/types'
import { ADMIN_ONLY_PAGES } from '../../shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandType = 'page' | 'action' | 'stack' | 'container'

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
  trends: <TrendingUp size={16} />,
  updates: <ArrowUpCircle size={16} />,
  notifications: <BellIcon size={16} />,
  snapshots: <Camera size={16} />,
  templates: <LayoutTemplate size={16} />,
  automations: <Bot size={16} />,
  topology: <Share2 size={16} />,
  'file-browser': <FolderOpen size={16} />,
  'disk-analysis': <PieChart size={16} />,
  secrets: <KeyRound size={16} />,
  schedules: <CalendarClock size={16} />,
  plugins: <Puzzle size={16} />,
  'event-feed': <Radio size={16} />,
  export: <Download size={16} />,
  setup: <Sparkles size={16} />,
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
  trends: 'Resource Trends',
  updates: 'Image Updates',
  notifications: 'Notifications',
  snapshots: 'Snapshots',
  templates: 'Templates',
  automations: 'Automations',
  topology: 'Network Topology',
  'file-browser': 'File Browser',
  'disk-analysis': 'Disk Analysis',
  secrets: 'Secrets Manager',
  schedules: 'Scheduled Tasks',
  plugins: 'Plugins',
  'event-feed': 'Live Events',
  export: 'Export Center',
  setup: 'Setup Wizard',
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
  const { isAuthenticated, logout, userRole } = useAuthStore()
  const isAdmin = userRole === 'admin'
  const currentPage = useSettingsStore((s) => s.currentPage)
  const setHealthReport = useHealthStore((s) => s.setReport)
  const stacks = useStackStore((s) => s.stacks)
  const containers = useContainerStore((s) => s.containers)
  const { addToast } = useToast()
  const isConnected = connectionStatus === 'connected'

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isAuthenticated || currentPage === 'setup') return
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
  }, [open, isAuthenticated, currentPage])

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

    // Navigation commands with rich keyword descriptions
    const pageDescriptions: Partial<Record<PageId, string>> = {
      dashboard: 'Overview, monitoring, live stats, home',
      stacks: 'Docker compose stacks, services, deploy',
      containers: 'Running containers, processes, instances',
      images: 'Docker images, layers, pull, registry',
      health: 'Health checks, container health, diagnostics',
      uptime: 'Uptime monitoring, availability, status',
      networks: 'Docker networks, bridge, overlay, DNS',
      volumes: 'Docker volumes, data persistence, mounts',
      logs: 'Log viewer, output, stdout, stderr, debug',
      system: 'System info, CPU, memory, disk, OS',
      config: 'Server configuration, API settings',
      settings: 'App settings, preferences, theme, profile',
      bookmarks: 'Saved bookmarks, favorites, pinned',
      activity: 'Activity feed, events, audit trail',
      topology: 'Network topology, map, visualization',
      'file-browser': 'Browse files, directory, filesystem',
      templates: 'Compose templates, scaffolding, presets',
      updates: 'Image updates, available upgrades',
      trends: 'Resource trends, metrics, history, graphs',
      terminal: 'Terminal, shell, command line, exec',
      cronjobs: 'Cron jobs, scheduled tasks, timers',
      'disk-analysis': 'Disk usage, storage analysis, space',
      maintenance: 'Cleanup, dangling images, volumes, prune',
      environment: 'Environment variables, .env files, secrets',
      backup: 'Backup, restore, snapshots, recovery',
      notifications: 'Alerts, notifications, webhooks',
      automations: 'Automations, triggers, workflows, bots',
      snapshots: 'Container snapshots, checkpoints',
      diagnostics: 'Diagnostics, troubleshoot, debug, inspect',
      users: 'User management, accounts, permissions',
      'event-feed': 'Live SSE events, real-time stream',
      export: 'Export data, download reports, backup configs',
    }
    const pageKeywords: Partial<Record<PageId, string[]>> = {
      dashboard: ['home', 'overview', 'monitor', 'live', 'stats', 'status'],
      stacks: ['compose', 'services', 'deploy', 'stack', 'docker-compose'],
      containers: ['container', 'process', 'instance', 'running', 'ps'],
      images: ['image', 'pull', 'registry', 'layer', 'tag', 'build'],
      health: ['health', 'check', 'healthy', 'unhealthy', 'diagnose'],
      uptime: ['uptime', 'availability', 'ping', 'monitor'],
      networks: ['network', 'bridge', 'overlay', 'dns', 'subnet'],
      volumes: ['volume', 'mount', 'data', 'persist', 'storage'],
      logs: ['log', 'output', 'stdout', 'stderr', 'debug', 'tail', 'follow'],
      system: ['system', 'cpu', 'memory', 'ram', 'os', 'kernel', 'info'],
      config: ['config', 'configuration', 'api', 'server', 'port'],
      settings: ['settings', 'preferences', 'theme', 'profile', 'options', 'customize'],
      bookmarks: ['bookmark', 'favorite', 'pin', 'save'],
      activity: ['activity', 'event', 'audit', 'history', 'recent'],
      topology: ['topology', 'map', 'graph', 'visualize', 'network map'],
      'file-browser': ['file', 'browse', 'directory', 'folder', 'filesystem', 'explore'],
      templates: ['template', 'scaffold', 'preset', 'compose template'],
      updates: ['update', 'upgrade', 'new version', 'outdated'],
      trends: ['trend', 'metric', 'chart', 'graph', 'history', 'cpu usage', 'memory usage'],
      terminal: ['terminal', 'shell', 'bash', 'exec', 'command', 'cli', 'ssh'],
      cronjobs: ['cron', 'schedule', 'timer', 'periodic', 'job'],
      'disk-analysis': ['disk', 'storage', 'space', 'size', 'usage', 'df'],
      maintenance: ['maintenance', 'cleanup', 'dangling', 'prune', 'gc'],
      environment: ['env', 'environment', 'variable', 'secret', '.env'],
      backup: ['backup', 'restore', 'snapshot', 'recovery', 'archive'],
      notifications: ['notification', 'alert', 'webhook', 'notify', 'bell'],
      automations: ['automation', 'trigger', 'workflow', 'bot', 'rule'],
      snapshots: ['snapshot', 'checkpoint', 'capture', 'freeze'],
      diagnostics: ['diagnostic', 'troubleshoot', 'debug', 'inspect', 'doctor'],
      users: ['user', 'account', 'permission', 'role', 'invite'],
      'event-feed': ['sse', 'stream', 'live', 'event', 'real-time', 'push'],
      export: ['export', 'download', 'report', 'backup', 'json'],
    }

    const allPages: PageId[] = ['dashboard', 'stacks', 'containers', 'images', 'health', 'networks', 'volumes', 'uptime', 'bookmarks', 'activity', 'event-feed', 'topology', 'file-browser', 'templates', 'updates', 'trends', 'secrets', 'schedules', 'plugins', 'terminal', 'cronjobs', 'disk-analysis', 'maintenance', 'environment', 'backup', 'export', 'notifications', 'automations', 'snapshots', 'logs', 'system', 'diagnostics', 'users', 'config', 'settings']
    // Filter out admin-only pages for non-admin users
    const pages = allPages.filter((p) => !ADMIN_ONLY_PAGES.has(p) || isAdmin)
    for (const page of pages) {
      items.push({
        id: `nav-${page}`,
        label: `Go to ${pageLabels[page]}`,
        description: pageDescriptions[page] ?? 'Navigate',
        icon: pageIcon[page],
        type: 'page',
        keywords: pageKeywords[page] ?? [page, pageLabels[page].toLowerCase()],
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

    // --- Admin-only server actions (require connection + admin) ---
    if (isConnected && isAdmin) {
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

      items.push({
        id: 'lint-all',
        label: 'Lint All Compose Files',
        description: 'Validate all compose files for errors and warnings',
        icon: <ListChecks size={16} className="text-cyan-400" />,
        type: 'action',
        keywords: ['validate', 'lint', 'compose', 'check', 'errors', 'warnings'],
        onSelect: () => {
          setCurrentPage('stacks')
          setOpen(false)
        },
      })

      items.push({
        id: 'check-updates',
        label: 'Check for System Updates',
        description: 'Check for available image and system updates',
        icon: <ArrowUpCircle size={16} className="text-emerald-400" />,
        type: 'action',
        keywords: ['update', 'upgrade', 'version', 'latest'],
        onSelect: () => {
          setCurrentPage('updates')
          setOpen(false)
        },
      })

      items.push({
        id: 'view-plugins',
        label: 'Manage Plugins',
        description: 'Install, configure, and scaffold plugins',
        icon: <Puzzle size={16} className="text-violet-400" />,
        type: 'action',
        keywords: ['plugin', 'extension', 'hooks', 'install', 'scaffold'],
        onSelect: () => {
          setCurrentPage('plugins')
          setOpen(false)
        },
      })

      items.push({
        id: 'view-audit',
        label: 'View Audit Log',
        description: 'Review security audit trail and change history',
        icon: <ScrollText size={16} className="text-amber-400" />,
        type: 'action',
        keywords: ['audit', 'log', 'history', 'security', 'changes'],
        onSelect: () => {
          setCurrentPage('activity')
          setOpen(false)
        },
      })
    }

    // --- Server actions available to all authenticated users ---
    if (isConnected) {
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

      // Dynamic stack commands
      for (const stack of stacks) {
        if (stack.status === 'running') {
          items.push({
            id: `stack-stop-${stack.name}`,
            label: `Stop Stack: ${stack.name}`,
            description: `${stack.running_containers} container${stack.running_containers !== 1 ? 's' : ''} running`,
            icon: <Square size={16} className="text-rose-400" />,
            type: 'stack',
            keywords: ['stop', 'stack', stack.name.toLowerCase(), 'down', 'halt'],
            onSelect: async () => {
              setOpen(false)
              try {
                const r = await stopStack(stack.name)
                addToast({ type: r.success ? 'success' : 'error', message: r.success ? `Stopped ${stack.name}` : `Failed to stop ${stack.name}` })
              } catch { addToast({ type: 'error', message: `Failed to stop ${stack.name}` }) }
            },
          })
          items.push({
            id: `stack-restart-${stack.name}`,
            label: `Restart Stack: ${stack.name}`,
            description: `${stack.running_containers} container${stack.running_containers !== 1 ? 's' : ''} running`,
            icon: <RotateCw size={16} className="text-amber-400" />,
            type: 'stack',
            keywords: ['restart', 'stack', stack.name.toLowerCase(), 'reload', 'reboot'],
            onSelect: async () => {
              setOpen(false)
              try {
                const r = await restartStack(stack.name)
                addToast({ type: r.success ? 'success' : 'error', message: r.success ? `Restarted ${stack.name}` : `Failed to restart ${stack.name}` })
              } catch { addToast({ type: 'error', message: `Failed to restart ${stack.name}` }) }
            },
          })
        } else {
          items.push({
            id: `stack-start-${stack.name}`,
            label: `Start Stack: ${stack.name}`,
            description: 'Currently stopped',
            icon: <Play size={16} className="text-emerald-400" />,
            type: 'stack',
            keywords: ['start', 'stack', stack.name.toLowerCase(), 'up', 'launch'],
            onSelect: async () => {
              setOpen(false)
              try {
                const r = await startStack(stack.name)
                addToast({ type: r.success ? 'success' : 'error', message: r.success ? `Started ${stack.name}` : `Failed to start ${stack.name}` })
              } catch { addToast({ type: 'error', message: `Failed to start ${stack.name}` }) }
            },
          })
        }

        // View logs for every stack
        items.push({
          id: `stack-logs-${stack.name}`,
          label: `View Logs: ${stack.name}`,
          description: `Open log viewer for ${stack.name}`,
          icon: <ScrollText size={16} className="text-cyan-400" />,
          type: 'stack',
          keywords: ['logs', 'log', 'view', 'stack', stack.name.toLowerCase(), 'output', 'tail'],
          onSelect: () => {
            setCurrentPage('logs')
            setOpen(false)
          },
        })
      }

      // Dynamic container commands
      for (const container of containers) {
        const isRunning = container.state === 'running'

        if (isRunning) {
          items.push({
            id: `container-stop-${container.name}`,
            label: `Stop Container: ${container.name}`,
            description: `Image: ${container.image}`,
            icon: <Square size={16} className="text-rose-400" />,
            type: 'container',
            keywords: ['stop', 'container', container.name.toLowerCase(), 'down', 'halt'],
            onSelect: async () => {
              setOpen(false)
              try {
                const r = await stopContainer(container.name)
                addToast({ type: r.success ? 'success' : 'error', message: r.success ? `Stopped ${container.name}` : `Failed to stop ${container.name}` })
              } catch { addToast({ type: 'error', message: `Failed to stop ${container.name}` }) }
            },
          })
          items.push({
            id: `container-restart-${container.name}`,
            label: `Restart Container: ${container.name}`,
            description: `Image: ${container.image}`,
            icon: <RotateCw size={16} className="text-amber-400" />,
            type: 'container',
            keywords: ['restart', 'container', container.name.toLowerCase(), 'reload', 'reboot'],
            onSelect: async () => {
              setOpen(false)
              try {
                const r = await restartContainer(container.name)
                addToast({ type: r.success ? 'success' : 'error', message: r.success ? `Restarted ${container.name}` : `Failed to restart ${container.name}` })
              } catch { addToast({ type: 'error', message: `Failed to restart ${container.name}` }) }
            },
          })
        } else {
          items.push({
            id: `container-start-${container.name}`,
            label: `Start Container: ${container.name}`,
            description: `Currently ${container.state}`,
            icon: <Play size={16} className="text-emerald-400" />,
            type: 'container',
            keywords: ['start', 'container', container.name.toLowerCase(), 'up', 'launch'],
            onSelect: async () => {
              setOpen(false)
              try {
                const r = await startContainer(container.name)
                addToast({ type: r.success ? 'success' : 'error', message: r.success ? `Started ${container.name}` : `Failed to start ${container.name}` })
              } catch { addToast({ type: 'error', message: `Failed to start ${container.name}` }) }
            },
          })
        }

        // View logs for every container
        items.push({
          id: `container-logs-${container.name}`,
          label: `View Logs: ${container.name}`,
          description: `Open log viewer for ${container.name}`,
          icon: <ScrollText size={16} className="text-cyan-400" />,
          type: 'container',
          keywords: ['logs', 'log', 'view', 'container', container.name.toLowerCase(), 'output', 'tail'],
          onSelect: () => {
            setCurrentPage('logs')
            setOpen(false)
          },
        })
      }
    }

    return items
  }, [setCurrentPage, status, health, isConnected, isAdmin, theme, sidebarCollapsed, toggleSidebar, updateSetting, logout, addToast, setHealthReport, stacks, containers])

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
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh]">
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
          border border-white/10
          rounded-2xl shadow-2xl shadow-black/40
          overflow-hidden
          animate-scale-in
        "
        onKeyDown={handleKeyDown}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 border-b border-white/5">
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
          <kbd className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-500 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2 scrollbar-thin">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {filtered.map((cmd, idx) => {
            const isSelected = idx === selectedIndex
            const prevType = idx > 0 ? filtered[idx - 1].type : null
            const showGroupHeader = query.trim() === '' && cmd.type !== prevType
            const groupLabel = cmd.type === 'page' ? 'Pages'
              : cmd.type === 'stack' ? 'Stack Actions'
              : cmd.type === 'container' ? 'Container Actions'
              : 'Quick Actions'
            return (
              <React.Fragment key={cmd.id}>
                {showGroupHeader && (
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{groupLabel}</span>
                  </div>
                )}
                <button
                  onClick={cmd.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`
                    flex items-center gap-3 w-full px-4 py-2.5 text-left
                    transition-colors duration-100
                    ${isSelected
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-slate-300 hover:bg-white/5'
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
                  {cmd.type === 'stack' && (
                    <span className="shrink-0 rounded-md border border-white/5 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500">Stack</span>
                  )}
                  {cmd.type === 'container' && (
                    <span className="shrink-0 rounded-md border border-white/5 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500">Container</span>
                  )}
                  {isSelected && (
                    <ArrowRight size={14} className="shrink-0 text-emerald-400/60" />
                  )}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        {/* Result count */}
        <div className="px-4 py-1.5 text-[10px] text-slate-500 border-t border-white/[0.03]">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/5 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px]">&uarr;</kbd>
              <kbd className="rounded border border-white/5 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px]">&darr;</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-white/5 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px]">&crarr;</kbd>
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
