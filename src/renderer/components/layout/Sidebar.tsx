// =============================================================================
// Sidebar — Collapsible navigation with glassmorphism, badges, health status
// =============================================================================

import React, { useEffect } from 'react'
import {
  LayoutDashboard,
  Layers,
  Box,
  HardDrive,
  HeartPulse,
  Clock,
  Network,
  ScrollText,
  Monitor,
  Settings2,
  Cog,
  ChevronsLeft,
  ChevronsRight,
  Container,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Bookmark,
  Zap,
  Shield,
  Users,
  Wrench,
  FileCode,
  Archive,
  Database,
  TerminalSquare,
  CalendarClock,
  TrendingUp,
  ArrowUpCircle,
  Bell,
  Camera,
  LayoutTemplate,
  Bot,
  Share2,
  FolderOpen,
  PieChart,
  KeyRound,
  Puzzle,
  Radio,
  Download,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useSystemStore } from '../../stores/systemStore'
import { useHealthStore } from '../../stores/healthStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { useNotificationStore } from '../../stores/notificationStore'
import { useAuthStore } from '../../stores/authStore'
import { isMobile } from '../../hooks/useMobile'
import { ServerSwitcher } from '../common/ServerSwitcher'
import type { PageId } from '../../../shared/types'
import { ADMIN_ONLY_PAGES } from '../../../shared/types'

interface NavItem {
  id: PageId
  label: string
  icon: React.ElementType
  section?: 'main' | 'system'
}

const navItems: NavItem[] = [
  // ── Core ──
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'main' },
  { id: 'stacks', label: 'Stacks', icon: Layers, section: 'main' },
  { id: 'containers', label: 'Containers', icon: Box, section: 'main' },
  { id: 'images', label: 'Images', icon: HardDrive, section: 'main' },
  { id: 'networks', label: 'Networks', icon: Network, section: 'main' },
  { id: 'volumes', label: 'Volumes', icon: Database, section: 'main' },
  { id: 'health', label: 'Health', icon: HeartPulse, section: 'main' },
  // ── Monitoring ──
  { id: 'uptime', label: 'Uptime', icon: Clock, section: 'main' },
  { id: 'trends', label: 'Trends', icon: TrendingUp, section: 'main' },
  { id: 'topology', label: 'Topology', icon: Share2, section: 'main' },
  { id: 'updates', label: 'Updates', icon: ArrowUpCircle, section: 'main' },
  { id: 'activity', label: 'Activity', icon: Zap, section: 'main' },
  { id: 'event-feed', label: 'Live Events', icon: Radio, section: 'main' },
  // ── Management ──
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, section: 'main' },
  { id: 'secrets', label: 'Secrets', icon: KeyRound, section: 'main' },
  { id: 'schedules', label: 'Schedules', icon: CalendarClock, section: 'main' },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, section: 'main' },
  { id: 'file-browser', label: 'File Browser', icon: FolderOpen, section: 'main' },
  { id: 'plugins', label: 'Plugins', icon: Puzzle, section: 'main' },
  // ── System ──
  { id: 'terminal', label: 'Terminal', icon: TerminalSquare, section: 'system' },
  { id: 'logs', label: 'Logs', icon: ScrollText, section: 'system' },
  { id: 'environment', label: 'Environment', icon: FileCode, section: 'system' },
  { id: 'config', label: 'Config', icon: Settings2, section: 'system' },
  { id: 'diagnostics', label: 'Diagnostics', icon: Shield, section: 'system' },
  { id: 'system', label: 'System', icon: Monitor, section: 'system' },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, section: 'system' },
  { id: 'disk-analysis', label: 'Disk Analysis', icon: PieChart, section: 'system' },
  { id: 'backup', label: 'Backup', icon: Archive, section: 'system' },
  { id: 'cronjobs', label: 'Cron Jobs', icon: CalendarClock, section: 'system' },
  { id: 'users', label: 'Users', icon: Users, section: 'system' },
  { id: 'notifications', label: 'Notifications', icon: Bell, section: 'system' },
  { id: 'automations', label: 'Automations', icon: Bot, section: 'system' },
  { id: 'snapshots', label: 'Snapshots', icon: Camera, section: 'system' },
  { id: 'export', label: 'Export', icon: Download, section: 'system' },
  { id: 'settings', label: 'Settings', icon: Cog, section: 'system' },
]

export function Sidebar() {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar)
  const projectName = useSettingsStore((s) => s.projectName) || 'DCS Manager'
  const projectSubtitle = useSettingsStore((s) => s.projectSubtitle) || 'Docker Compose Skeleton'
  const systemStatus = useSystemStore((s) => s.status)
  const healthReport = useHealthStore((s) => s.report)
  const connectionStatus = useConnectionStore((s) => s.status)
  const unreadNotifications = useNotificationStore((s) => s.getServerUnreadCount())

  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const userRole = useAuthStore((s) => s.userRole)
  // Strict: only 'admin' gets full access (principle of least privilege)
  const isAdmin = userRole === 'admin'

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile && !sidebarCollapsed) {
      updateSetting('sidebarCollapsed', true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter out admin-only pages for non-admin users
  const visibleItems = navItems.filter((i) => !ADMIN_ONLY_PAGES.has(i.id) || isAdmin)
  const mainItems = visibleItems.filter((i) => i.section === 'main')
  const systemItems = visibleItems.filter((i) => i.section === 'system')

  // Build badge data
  const badges: Partial<Record<PageId, { value: string; color: string }>> = {}

  if (systemStatus) {
    badges.containers = {
      value: `${systemStatus.docker.containers.running}`,
      color: systemStatus.docker.containers.running > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400',
    }
    badges.stacks = {
      value: `${systemStatus.stacks.running}`,
      color: systemStatus.stacks.running > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400',
    }
    badges.images = {
      value: `${systemStatus.docker.images}`,
      color: 'bg-cyan-500/20 text-cyan-400',
    }
    badges.networks = {
      value: `${systemStatus.docker.networks}`,
      color: 'bg-cyan-500/20 text-cyan-400',
    }
  }

  if (healthReport) {
    const { unhealthy } = healthReport.summary
    if (unhealthy > 0) {
      badges.health = {
        value: `${unhealthy}`,
        color: 'bg-rose-500/20 text-rose-400',
      }
    }
  }

  if (systemStatus) {
    badges.volumes = {
      value: `${systemStatus.docker.volumes}`,
      color: 'bg-cyan-500/20 text-cyan-400',
    }
  }

  if (unreadNotifications > 0) {
    badges.notifications = {
      value: `${unreadNotifications}`,
      color: 'bg-rose-500/20 text-rose-400',
    }
    badges.activity = {
      value: `${unreadNotifications}`,
      color: 'bg-amber-500/20 text-amber-400',
    }
  }

  // Health status icon for the health nav item
  const healthStatus = healthReport?.status
  const healthStatusIcon: Record<string, { icon: React.ElementType; color: string; title: string }> = {
    healthy: { icon: CheckCircle, color: 'text-emerald-400', title: 'All systems healthy' },
    degraded: { icon: AlertTriangle, color: 'text-amber-400', title: 'System degraded' },
    critical: { icon: XCircle, color: 'text-rose-400', title: 'Critical issues' },
  }

  // Connection status icon for dashboard
  const connIcon = connectionStatus === 'connected'
    ? { icon: Wifi, color: 'text-emerald-400', title: 'Connected' }
    : connectionStatus === 'connecting'
      ? { icon: Wifi, color: 'text-amber-400 animate-pulse', title: 'Connecting...' }
      : { icon: WifiOff, color: 'text-slate-500', title: 'Disconnected' }

  // Build status icons map
  const statusIcons: Partial<Record<PageId, { icon: React.ElementType; color: string; title: string }>> = {}

  // Dashboard gets connection indicator
  statusIcons.dashboard = connIcon

  // Health gets health status indicator
  if (healthStatus && healthStatusIcon[healthStatus]) {
    statusIcons.health = healthStatusIcon[healthStatus]
  }

  return (
    <aside
      className={`
        relative flex flex-col h-full
        bg-slate-900/60 backdrop-blur-2xl
        border-r border-white/[0.06]
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${sidebarCollapsed ? 'w-[52px] md:w-[68px]' : 'w-[220px]'}
      `}
    >
      {/* Brand area */}
      <div className="flex items-center gap-3 px-2 md:px-4 h-11 md:h-14 border-b border-white/[0.06] shrink-0">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl shrink-0 border accent-text" style={{ backgroundColor: 'rgb(var(--color-accent) / 0.1)', borderColor: 'rgb(var(--color-accent) / 0.1)' }}>
          <Container size={18} strokeWidth={2.2} />
          <div className="absolute inset-0 rounded-xl blur-sm" style={{ backgroundColor: 'rgb(var(--color-accent) / 0.05)' }} />
          {/* Connection dot on the brand icon */}
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 transition-colors duration-500
            ${connectionStatus === 'connected' ? 'bg-emerald-400' : connectionStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : connectionStatus === 'error' ? 'bg-rose-400' : 'bg-slate-500'}
          `} />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <span className="text-sm font-bold tracking-wide text-gradient neon-emerald whitespace-nowrap">
              {projectName}
            </span>
            <p className="text-[10px] text-slate-600 -mt-0.5 whitespace-nowrap">{projectSubtitle}</p>
          </div>
        )}
      </div>

      {/* Server Switcher */}
      {!sidebarCollapsed && (
        <div className="px-2 py-2 border-b border-white/[0.06]">
          <ServerSwitcher />
        </div>
      )}

      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        {/* Main section */}
        <div className="space-y-0.5">
          {mainItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPage === item.id}
              collapsed={sidebarCollapsed}
              badge={badges[item.id]}
              statusIcon={statusIcons[item.id]}
              onClick={() => currentPage === item.id
                ? setCurrentPage(item.id, { resetView: true })
                : setCurrentPage(item.id)
              }
            />
          ))}
        </div>

        {/* Divider */}
        <div className={`my-3 mx-3 border-t border-white/[0.04] ${sidebarCollapsed ? 'mx-1' : ''}`} />

        {/* System section */}
        {!sidebarCollapsed && (
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            System
          </p>
        )}
        <div className="space-y-0.5">
          {systemItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPage === item.id}
              collapsed={sidebarCollapsed}
              statusIcon={statusIcons[item.id]}
              onClick={() => currentPage === item.id
                ? setCurrentPage(item.id, { resetView: true })
                : setCurrentPage(item.id)
              }
            />
          ))}
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-white/[0.06] p-2">
        <button
          onClick={toggleSidebar}
          className="
            flex items-center justify-center w-full
            rounded-lg p-2.5
            text-slate-500 hover:text-slate-300
            hover:bg-white/[0.06]
            transition-all duration-200
            no-drag press
          "
          title={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronsRight size={16} strokeWidth={2} />
          ) : (
            <ChevronsLeft size={16} strokeWidth={2} />
          )}
        </button>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// NavButton — individual navigation item with optional badge
// ---------------------------------------------------------------------------

function NavButton({
  item,
  isActive,
  collapsed,
  badge,
  statusIcon,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  badge?: { value: string; color: string }
  statusIcon?: { icon: React.ElementType; color: string; title: string }
  onClick: () => void
}) {
  const Icon = item.icon
  const StatusIcon = statusIcon?.icon

  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`
        group relative flex items-center gap-3 w-full
        rounded-lg px-3 py-2
        text-[13px] font-medium
        transition-all duration-200 ease-out
        no-drag
        ${
          isActive
            ? 'accent-bg-subtle accent-text'
            : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-300'
        }
      `}
    >
      {/* Active indicator bar */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full accent-indicator animate-scale-in origin-left" />
      )}

      {/* Active glow background */}
      {isActive && (
        <div className="absolute inset-0 rounded-lg pointer-events-none" style={{ backgroundColor: 'rgb(var(--color-accent) / 0.04)' }} />
      )}

      <Icon
        size={18}
        strokeWidth={isActive ? 2.2 : 1.7}
        className={`shrink-0 transition-all duration-200 ${
          isActive
            ? 'accent-text accent-glow'
            : 'text-slate-600 group-hover:text-slate-400'
        }`}
      />

      {!collapsed && (
        <>
          <span className="truncate whitespace-nowrap flex-1 text-left">{item.label}</span>
          {/* Status icon (health check / connection indicator) */}
          {StatusIcon && (
            <StatusIcon
              size={13}
              className={`shrink-0 ${statusIcon.color}`}
              title={statusIcon.title}
            />
          )}
          {badge && (
            <span className={`
              z-10 inline-flex items-center justify-center min-w-[20px] h-5
              rounded-full px-1.5 text-[10px] font-bold tabular-nums
              ${badge.color}
              transition-all duration-300
            `}>
              {badge.value}
            </span>
          )}
        </>
      )}

      {/* Collapsed: status icon as small overlay */}
      {collapsed && StatusIcon && (
        <span
          className={`absolute bottom-0.5 right-0.5 ${statusIcon.color}`}
          title={statusIcon.title}
        >
          <StatusIcon size={9} />
        </span>
      )}

      {/* Collapsed badge dot */}
      {collapsed && badge && (
        <span className={`
          absolute top-1 right-1 w-2 h-2 rounded-full
          ${badge.color.includes('rose') ? 'bg-rose-400' : badge.color.includes('emerald') ? 'bg-emerald-400' : 'bg-cyan-400'}
        `} />
      )}
    </button>
  )
}
