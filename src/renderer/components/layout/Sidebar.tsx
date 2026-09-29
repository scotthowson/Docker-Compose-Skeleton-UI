// =============================================================================
// Sidebar — Collapsible navigation with glassmorphism, badges, health status
// =============================================================================

import { usePolling } from '../../hooks/usePolling'
import { fetchStacks } from '../../api/endpoints'
import { useFleetRole } from '../../hooks/useFleetRole'
import { useFleetTotals } from '../../hooks/useFleetTotals'
import React, { useEffect } from 'react'
import {
  HeartPulse,
  ChevronsLeft,
  ChevronsRight,
  Container,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useSystemStore } from '../../stores/systemStore'
import { useHealthStore } from '../../stores/healthStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { useApiLink } from '../../hooks/useApiLink'
import { useNotificationStore } from '../../stores/notificationStore'
import { useAuthStore } from '../../stores/authStore'
import { useNarrowWindow } from '../../hooks/useMobile'
import { ServerSwitcher } from '../common/ServerSwitcher'
import type { PageId } from '../../../shared/types'
import { ADMIN_ONLY_PAGES } from '../../../shared/types'
import { pageMeta } from '../../constants/pageTitles'

export interface NavItem {
  id: PageId
  label: string
  icon: React.ElementType
  section?: 'main' | 'system'
}

/** a sidebar entry: where a page sits here; its name and icon are the page's own (constants/pageTitles) */
const nav = (id: PageId, section: 'main' | 'system'): NavItem => ({ id, label: pageMeta[id].label, icon: pageMeta[id].icon, section })

export const navItems: NavItem[] = [
  // ── Core ──
  nav('dashboard', 'main'),
  nav('stacks', 'main'),
  nav('containers', 'main'),
  nav('images', 'main'),
  nav('networks', 'main'),
  nav('volumes', 'main'),
  nav('health', 'main'),
  nav('dns', 'main'),
  nav('crowdsec', 'main'),
  nav('proxmox', 'main'),
  // ── Monitoring ──
  nav('uptime', 'main'),
  nav('trends', 'main'),
  nav('topology', 'main'),
  nav('updates', 'main'),
  nav('activity', 'main'),
  nav('event-feed', 'main'),
  // ── Management ──
  nav('templates', 'main'),
  nav('secrets', 'main'),
  nav('schedules', 'main'),
  nav('bookmarks', 'main'),
  nav('file-browser', 'main'),
  nav('plugins', 'main'),
  // ── System ──
  nav('terminal', 'system'),
  nav('logs', 'system'),
  nav('environment', 'system'),
  nav('diagnostics', 'system'),
  nav('system', 'system'),
  nav('maintenance', 'system'),
  nav('disk-analysis', 'system'),
  nav('backup', 'system'),
  nav('cronjobs', 'system'),
  nav('users', 'system'),
  nav('notifications', 'system'),
  nav('automations', 'system'),
  nav('snapshots', 'system'),
  nav('export', 'system'),
  nav('config', 'system'),
  nav('settings', 'system'),
]

export function Sidebar() {
  // a hub: the badge counts the VMs (the merged stack list), not this server's own stacks
  const { isHub } = useFleetRole()
  const isConnectedForVms = useConnectionStore((st) => st.status === 'connected')
  const vmList = usePolling(fetchStacks, 30000, { enabled: isConnectedForVms && isHub })
  // a hub counts its VMs in every badge: containers, images, networks and volumes are its own plus theirs
  const { totals: fleet } = useFleetTotals()
  const vmStacks = vmList.data ? { total: vmList.data.stacks.filter((x) => x.placement === 'vm').length, up: vmList.data.stacks.filter((x) => x.placement === 'vm' && x.status === 'running').length } : null
  const currentPage = useSettingsStore((s) => s.currentPage)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar)
  const projectName = useSettingsStore((s) => s.projectName) || 'DCS Manager'
  const projectSubtitle = useSettingsStore((s) => s.projectSubtitle) || 'DCS Orchestrator'
  const systemStatus = useSystemStore((s) => s.status)
  const healthReport = useHealthStore((s) => s.report)
  const connectionStatus = useConnectionStore((s) => s.status)
  const link = useApiLink()
  const unreadNotifications = useNotificationStore((s) => s.getServerUnreadCount())

  // A narrow window shows the icon rail whatever the person chose, and gives the choice back when it widens
  // (nothing is written to the settings: the old code saved the collapse and the wide window inherited it)
  const narrow = useNarrowWindow()
  const collapsed = sidebarCollapsed || narrow
  const userRole = useAuthStore((s) => s.userRole)
  // Strict: only 'admin' gets full access (principle of least privilege)
  const isAdmin = userRole === 'admin'

  // Filter out admin-only pages for non-admin users
  const visibleItems = navItems.filter((i) => !ADMIN_ONLY_PAGES.has(i.id) || isAdmin)
  const mainItems = visibleItems.filter((i) => i.section === 'main')
  const systemItems = visibleItems.filter((i) => i.section === 'system')

  // Build badge data
  const badges: Partial<Record<PageId, { value: string; color: string }>> = {}

  if (systemStatus) {
    const runningContainers = systemStatus.docker.containers.running + fleet.containersRunning
    badges.containers = {
      value: `${runningContainers}`,
      color: runningContainers > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400',
    }
    badges.stacks = isHub && vmStacks !== null
      ? { value: `${vmStacks.total}`, color: vmStacks.up > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-500/20 text-slate-400' } // a hub counts its VMs
      : { value: `${systemStatus.stacks.running}`, color: systemStatus.stacks.running > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400' }
    badges.images = {
      value: `${systemStatus.docker.images + fleet.images}`,
      color: 'bg-cyan-500/20 text-cyan-400',
    }
    badges.networks = {
      value: `${systemStatus.docker.networks + fleet.networks}`,
      color: 'bg-cyan-500/20 text-cyan-400',
    }
  }

  if (healthReport && link.live) {
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
      value: `${systemStatus.docker.volumes + fleet.volumes}`,
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

  const updatesAvailable = useSettingsStore((s) => s.updatesAvailable) ?? 0
  if (updatesAvailable > 0) {
    badges.updates = {
      value: `${updatesAvailable}`,
      color: 'bg-cyan-500/20 text-cyan-400',
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
  const connIcon = link.live
    ? { icon: Wifi, color: 'text-emerald-400', title: 'Connected' }
    : link.state === 'trouble'
      ? { icon: Wifi, color: 'text-amber-400 animate-pulse', title: 'The API is not answering' }
      : link.state === 'reconnecting'
        ? { icon: WifiOff, color: 'text-rose-400 animate-pulse', title: connectionStatus === 'connecting' ? 'Connecting...' : 'API reconnecting…' }
        : { icon: WifiOff, color: 'text-rose-400', title: 'Not connected' }

  // Build status icons map
  const statusIcons: Partial<Record<PageId, { icon: React.ElementType; color: string; title: string }>> = {}

  // Dashboard gets connection indicator
  statusIcons.dashboard = connIcon

  // Health gets health status indicator
  if (!link.live) {
    // the last verdict is history while the API does not answer
    statusIcons.health = { icon: HeartPulse, color: link.state === 'trouble' ? 'text-amber-400 animate-pulse' : 'text-rose-400 animate-pulse', title: link.label }
  } else if (healthStatus && healthStatusIcon[healthStatus]) {
    statusIcons.health = healthStatusIcon[healthStatus]
  }

  return (
    <aside
      className={`
        relative hidden md:flex flex-col h-full
        bg-slate-900/60 backdrop-blur-2xl
        border-r border-white/5
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${collapsed ? 'w-[52px] md:w-[68px]' : 'w-[220px]'}
      `}
    >
      {/* Brand area */}
      <div className="flex items-center gap-3 px-2 md:px-4 h-11 md:h-14 border-b border-white/5 shrink-0">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl shrink-0 border accent-text" style={{ backgroundColor: 'rgb(var(--color-accent) / 0.1)', borderColor: 'rgb(var(--color-accent) / 0.1)' }}>
          <Container size={18} strokeWidth={2.2} />
          <div className="absolute inset-0 rounded-xl blur-sm" style={{ backgroundColor: 'rgb(var(--color-accent) / 0.05)' }} />
          {/* Connection dot on the brand icon */}
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 transition-colors duration-500
            ${connectionStatus === 'connected' ? 'bg-emerald-400' : connectionStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : connectionStatus === 'error' ? 'bg-rose-400' : 'bg-slate-500'}
          `} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-sm font-bold tracking-wide text-gradient neon-emerald whitespace-nowrap">
              {projectName}
            </span>
            <p className="text-[10px] text-slate-500 -mt-0.5 whitespace-nowrap">{projectSubtitle}</p>
          </div>
        )}
      </div>

      {/* Server Switcher */}
      {!collapsed && (
        <div className="px-2 py-2 border-b border-white/5">
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
              collapsed={collapsed}
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
        <div className={`my-3 mx-3 border-t border-white/[0.03] ${collapsed ? 'mx-1' : ''}`} />

        {/* System section */}
        {!collapsed && (
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            System
          </p>
        )}
        <div className="space-y-0.5">
          {systemItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPage === item.id}
              collapsed={collapsed}
              statusIcon={statusIcons[item.id]}
              onClick={() => currentPage === item.id
                ? setCurrentPage(item.id, { resetView: true })
                : setCurrentPage(item.id)
              }
            />
          ))}
        </div>
      </nav>

      {/* Collapse toggle (a narrow window has the rail whatever this says, so it is not offered there) */}
      {!narrow && <div className="shrink-0 border-t border-white/5 p-2">
        <button
          onClick={toggleSidebar}
          className="
            flex items-center justify-center w-full
            rounded-lg p-2.5
            text-slate-500 hover:text-slate-300
            hover:bg-white/5
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
      </div>}
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
            : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
        }
      `}
    >
      {/* Active indicator bar — inset-y centering avoids animate-scale-in
           overriding the -translate-y-1/2 transform (which caused the bar to
           start at the wrong position and jump to center) */}
      {isActive && (
        <div className="absolute left-0 inset-y-0 my-auto w-[3px] h-4 rounded-r-full accent-indicator animate-scale-in origin-left" />
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
            : 'text-slate-500 group-hover:text-slate-400'
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
