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
  minW: number
  minH: number
  maxW: number
  maxH: number
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
// Card constraints: minW/minH prevent cards from being too small to read,
// maxW/maxH prevent cards from taking excessive space.
// Grid is 24 columns wide; H_UNIT = 50px per row.
export const CARD_REGISTRY: CardRegistryEntry[] = [
  //                                                                                                             minW minH maxW maxH
  { id: 'overview',           title: 'Overview',          iconName: 'LayoutDashboard', defaultX: 0,  defaultY: 0,  defaultW: 24, defaultH: 4,  minW: 12, minH: 4, maxW: 24, maxH: 6,  description: 'Container counts, uptime, health score sparklines' },
  { id: 'stack-grid',         title: 'Stack Status',      iconName: 'Layers',          defaultX: 0,  defaultY: 4,  defaultW: 24, defaultH: 4,  minW: 12, minH: 4, maxW: 24, maxH: 8,  description: 'All stacks with status indicators' },
  { id: 'health-summary',     title: 'Health Monitor',    iconName: 'HeartPulse',      defaultX: 0,  defaultY: 8,  defaultW: 12, defaultH: 9,  minW: 12, minH: 8, maxW: 24, maxH: 14, description: 'Health score gauge + container status grid' },
  { id: 'resource-chart',     title: 'System Resources',  iconName: 'Activity',        defaultX: 12, defaultY: 8,  defaultW: 12, defaultH: 9,  minW: 12, minH: 8, maxW: 24, maxH: 14, description: 'CPU, memory, disk donut charts' },
  { id: 'container-overview', title: 'Containers',        iconName: 'Box',             defaultX: 0,  defaultY: 17, defaultW: 8,  defaultH: 8,  minW: 8,  minH: 6, maxW: 24, maxH: 14, description: 'Container status breakdown' },
  { id: 'server-info',        title: 'Server Info',       iconName: 'Server',          defaultX: 8,  defaultY: 17, defaultW: 8,  defaultH: 8,  minW: 8,  minH: 8, maxW: 24, maxH: 14, description: 'System information' },
  { id: 'disk-monitor',       title: 'Disk Monitor',      iconName: 'HardDrive',       defaultX: 16, defaultY: 17, defaultW: 8,  defaultH: 8,  minW: 8,  minH: 8, maxW: 24, maxH: 14, description: 'Disk usage per mount' },
  { id: 'trends',             title: 'Resource Trends',   iconName: 'TrendingUp',      defaultX: 0,  defaultY: 25, defaultW: 6,  defaultH: 3,  minW: 6,  minH: 3, maxW: 24, maxH: 10, description: 'Historical resource graphs' },
  { id: 'top-consumers',      title: 'Top Consumers',     iconName: 'Zap',             defaultX: 6,  defaultY: 25, defaultW: 6,  defaultH: 3,  minW: 6,  minH: 3, maxW: 24, maxH: 10, description: 'Highest resource-using containers' },
  { id: 'image-updates',      title: 'Image Updates',     iconName: 'Download',        defaultX: 12, defaultY: 25, defaultW: 6,  defaultH: 3,  minW: 6,  minH: 3, maxW: 24, maxH: 10, description: 'Available image updates' },
  { id: 'backup-status',      title: 'Backup Status',     iconName: 'Archive',         defaultX: 18, defaultY: 25, defaultW: 6,  defaultH: 3,  minW: 6,  minH: 3, maxW: 24, maxH: 10, description: 'Backup schedule and status' },
  { id: 'log-health',         title: 'Log Health',        iconName: 'FileText',        defaultX: 0,  defaultY: 28, defaultW: 8,  defaultH: 3,  minW: 3,  minH: 3, maxW: 24, maxH: 8,  description: 'Log error/warning counts' },
  { id: 'maintenance',        title: 'Maintenance',       iconName: 'Wrench',          defaultX: 8,  defaultY: 28, defaultW: 8,  defaultH: 3,  minW: 8,  minH: 3, maxW: 24, maxH: 8,  description: 'Docker cleanup status' },
  { id: 'notifications',      title: 'Notifications',     iconName: 'Bell',            defaultX: 16, defaultY: 28, defaultW: 8,  defaultH: 3,  minW: 8,  minH: 3, maxW: 24, maxH: 8,  description: 'Notification delivery status' },
  { id: 'automations',        title: 'Automations',       iconName: 'Zap',             defaultX: 0,  defaultY: 31, defaultW: 8,  defaultH: 7,  minW: 8,  minH: 3, maxW: 24, maxH: 12, description: 'Active automation rules' },
  { id: 'recent-events',      title: 'Recent Events',     iconName: 'Clock',           defaultX: 8,  defaultY: 31, defaultW: 8,  defaultH: 7,  minW: 8,  minH: 3, maxW: 24, maxH: 12, description: 'Docker event timeline' },
  { id: 'quick-actions',      title: 'Quick Actions',     iconName: 'Rocket',          defaultX: 16, defaultY: 31, defaultW: 8,  defaultH: 7,  minW: 8,  minH: 3, maxW: 24, maxH: 12, description: 'Common management shortcuts' },
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

/** Clamp width and height to per-card min/max constraints */
export function clampCardSize(id: string, w: number, h: number, overrides?: { minW?: number; minH?: number; maxW?: number; maxH?: number }): { w: number; h: number } {
  const entry = getCardEntry(id)
  const constraints = overrides || (entry ? { minW: entry.minW, minH: entry.minH, maxW: entry.maxW, maxH: entry.maxH } : { minW: 3, minH: 2, maxW: GRID_COLS, maxH: 16 })
  w = Math.max(constraints.minW ?? 1, Math.min(constraints.maxW ?? GRID_COLS, w))
  h = Math.max(constraints.minH ?? 1, Math.min(constraints.maxH ?? 20, h))
  // Also enforce global bounds
  w = Math.max(1, Math.min(GRID_COLS, w))
  h = Math.max(1, Math.min(20, h))
  return { w, h }
}

/** Get size constraints for a card (used by resize handles in the grid) */
export function getCardConstraints(id: string): { minW: number; minH: number; maxW: number; maxH: number } {
  const entry = getCardEntry(id)
  if (entry) return { minW: entry.minW, minH: entry.minH, maxW: entry.maxW, maxH: entry.maxH }
  // Plugin cards / custom cards: sensible defaults
  return { minW: 3, minH: 2, maxW: GRID_COLS, maxH: 16 }
}
