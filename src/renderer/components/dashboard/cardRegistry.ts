// =============================================================================
// Card Registry — 24-column free-placement grid, 50px row height
// =============================================================================

import type { DashboardCard, DashboardLayout } from '../../../shared/types'

export interface CardRegistryEntry {
  id: string
  title: string
  iconName: string
  defaultX: number
  defaultY: number
  defaultW: number
  defaultH: number
  description: string
}

export const GRID_COLS = 24
export const H_UNIT = 50  // px per row unit

// Default layout with explicit x,y positions:
// Row 0-3:   Overview (full width)
// Row 4-7:   Stack Status (full width)
// Row 8-16:  Health (left half) + Resources (right half)
// Row 17-24: Containers + Server + Disk (thirds)
// Row 25-27: Trends + Consumers + Updates + Backup (quarters)
// Row 28-32: Log + Maintenance + Notifications (thirds)
// Row 33-37: Automations + Events + Quick Actions (thirds)
export const CARD_REGISTRY: CardRegistryEntry[] = [
  { id: 'overview',           title: 'Overview',          iconName: 'LayoutDashboard', defaultX: 0,  defaultY: 0,  defaultW: 24, defaultH: 4,  description: 'Container counts, uptime, health score sparklines' },
  { id: 'stack-grid',         title: 'Stack Status',      iconName: 'Layers',          defaultX: 0,  defaultY: 4,  defaultW: 24, defaultH: 4,  description: 'All stacks with status indicators' },
  { id: 'health-summary',     title: 'Health Monitor',    iconName: 'HeartPulse',      defaultX: 0,  defaultY: 8,  defaultW: 12, defaultH: 9,  description: 'Health score gauge + container status grid' },
  { id: 'resource-chart',     title: 'System Resources',  iconName: 'Activity',        defaultX: 12, defaultY: 8,  defaultW: 12, defaultH: 9,  description: 'CPU, memory, disk donut charts' },
  { id: 'container-overview', title: 'Containers',        iconName: 'Box',             defaultX: 0,  defaultY: 17, defaultW: 8,  defaultH: 8,  description: 'Container status breakdown' },
  { id: 'server-info',        title: 'Server Info',       iconName: 'Server',          defaultX: 8,  defaultY: 17, defaultW: 8,  defaultH: 8,  description: 'System information' },
  { id: 'disk-monitor',       title: 'Disk Monitor',      iconName: 'HardDrive',       defaultX: 16, defaultY: 17, defaultW: 8,  defaultH: 8,  description: 'Disk usage per mount' },
  { id: 'trends',             title: 'Resource Trends',   iconName: 'TrendingUp',      defaultX: 0,  defaultY: 25, defaultW: 6,  defaultH: 3,  description: 'Historical resource graphs' },
  { id: 'top-consumers',      title: 'Top Consumers',     iconName: 'Zap',             defaultX: 6,  defaultY: 25, defaultW: 6,  defaultH: 3,  description: 'Highest resource-using containers' },
  { id: 'image-updates',      title: 'Image Updates',     iconName: 'Download',        defaultX: 12, defaultY: 25, defaultW: 6,  defaultH: 3,  description: 'Available image updates' },
  { id: 'backup-status',      title: 'Backup Status',     iconName: 'Archive',         defaultX: 18, defaultY: 25, defaultW: 6,  defaultH: 3,  description: 'Backup schedule and status' },
  { id: 'log-health',         title: 'Log Health',        iconName: 'FileText',        defaultX: 0,  defaultY: 28, defaultW: 8,  defaultH: 5,  description: 'Log error/warning counts' },
  { id: 'maintenance',        title: 'Maintenance',       iconName: 'Wrench',          defaultX: 8,  defaultY: 28, defaultW: 8,  defaultH: 5,  description: 'Docker cleanup status' },
  { id: 'notifications',      title: 'Notifications',     iconName: 'Bell',            defaultX: 16, defaultY: 28, defaultW: 8,  defaultH: 5,  description: 'Notification delivery status' },
  { id: 'automations',        title: 'Automations',       iconName: 'Zap',             defaultX: 0,  defaultY: 33, defaultW: 8,  defaultH: 5,  description: 'Active automation rules' },
  { id: 'recent-events',      title: 'Recent Events',     iconName: 'Clock',           defaultX: 8,  defaultY: 33, defaultW: 8,  defaultH: 5,  description: 'Docker event timeline' },
  { id: 'quick-actions',      title: 'Quick Actions',     iconName: 'Rocket',          defaultX: 16, defaultY: 33, defaultW: 8,  defaultH: 5,  description: 'Common management shortcuts' },
]

export function getDefaultLayout(): DashboardLayout {
  return {
    version: 9,
    labels: {},
    cards: CARD_REGISTRY.map((entry) => ({
      id: entry.id,
      visible: true,
      x: entry.defaultX,
      y: entry.defaultY,
      w: entry.defaultW,
      h: entry.defaultH,
    })),
  }
}

export function getCardEntry(id: string): CardRegistryEntry | undefined {
  return CARD_REGISTRY.find((e) => e.id === id)
}

export function clampW(w: number): number {
  return Math.max(1, Math.min(GRID_COLS, w))
}

export function clampH(h: number): number {
  return Math.max(1, Math.min(20, h))
}
