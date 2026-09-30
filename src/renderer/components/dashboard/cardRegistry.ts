// =============================================================================
// Card Registry — 24-column free-placement grid, 50px row height
// =============================================================================

import {
  LayoutDashboard, Layers, HeartPulse, Activity, Box, Monitor, HardDrive, TrendingUp, Zap, ArrowUpCircle, Archive, ScrollText,
  Wrench, Bell, Rocket, ShieldCheck, Boxes, Crosshair, Globe, StickyNote, Bookmark, BatteryCharging, Bot, Cpu, Server,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardLayout } from '../../../shared/types'
import { pageLabel } from '../../constants/pageTitles'

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

// Default layout with explicit x,y positions, each row starting where the one above ends:
// Row 0-3:   Overview (full width)
// Row 4-7:   Stack status (full width)
// Row 8-15:  Health (left half) + System resources (right half)
// Row 16-23: Containers + Server details + Disk usage (thirds)
// Row 24-26: Trends + Top consumers + Image updates + Backup status (quarters)
// Row 27-29: Log health + Maintenance + Notifications (thirds)
// Row 30-36: Automations + Recent events + Quick actions (thirds)
// Row 37-42: Protection + Stack controls + Container spotlight (thirds)
// Row 43-48: Routes & DNS + Notes + Bookmarks
// Row 49-55: Proxmox + Power
// (A saved layout keeps its own positions; these are what a new dashboard and "Reset" start from.)
// Card constraints: minW/minH prevent cards from being too small to read,
// maxW/maxH prevent cards from taking excessive space.
// Grid is 24 columns wide; H_UNIT = 50px per row.
export const CARD_REGISTRY: CardRegistryEntry[] = [
  //                                                                                                             minW minH maxW maxH
  { id: 'overview',           title: 'Overview',            iconName: 'LayoutDashboard', defaultX: 0,  defaultY: 0,  defaultW: 24, defaultH: 4,  minW: 4, minH: 2, maxW: 24, maxH: 6,  description: 'Container counts, uptime, health score sparklines' },
  { id: 'stack-grid',         title: 'Stack status',        iconName: 'Layers',          defaultX: 0,  defaultY: 4,  defaultW: 24, defaultH: 4,  minW: 4, minH: 2, maxW: 24, maxH: 8,  description: 'All stacks with status indicators' },
  { id: 'health-summary',     title: pageLabel('health'),   iconName: 'HeartPulse',      defaultX: 0,  defaultY: 8,  defaultW: 12, defaultH: 8,  minW: 4, minH: 2, maxW: 24, maxH: 14, description: 'Health score gauge + container status grid' },
  { id: 'resource-chart',     title: 'System resources',    iconName: 'Activity',        defaultX: 12, defaultY: 8,  defaultW: 12, defaultH: 8,  minW: 4, minH: 2, maxW: 24, maxH: 14, description: 'CPU, memory, disk donut charts' },
  { id: 'container-overview', title: pageLabel('containers'), iconName: 'Box',           defaultX: 0,  defaultY: 16, defaultW: 8,  defaultH: 8,  minW: 4,  minH: 2, maxW: 24, maxH: 14, description: 'Container status breakdown' },
  { id: 'server-info',        title: 'Server details',     iconName: 'Monitor',          defaultX: 8,  defaultY: 16, defaultW: 8,  defaultH: 8,  minW: 4,  minH: 2, maxW: 24, maxH: 14, description: 'System information' },
  { id: 'disk-monitor',       title: 'Disk usage',         iconName: 'HardDrive',       defaultX: 16, defaultY: 16, defaultW: 8,  defaultH: 8,  minW: 4,  minH: 2, maxW: 24, maxH: 14, description: 'Disk usage per mount' },
  { id: 'trends',             title: pageLabel('trends'),   iconName: 'TrendingUp',      defaultX: 0,  defaultY: 24, defaultW: 6,  defaultH: 3,  minW: 4,  minH: 2, maxW: 24, maxH: 10, description: 'Historical resource graphs' },
  { id: 'top-consumers',      title: 'Top consumers',      iconName: 'Cpu',             defaultX: 6,  defaultY: 24, defaultW: 6,  defaultH: 3,  minW: 4,  minH: 2, maxW: 24, maxH: 10, description: 'Highest resource-using containers' },
  { id: 'image-updates',      title: 'Image updates',      iconName: 'ArrowUpCircle',        defaultX: 12, defaultY: 24, defaultW: 6,  defaultH: 3,  minW: 4,  minH: 2, maxW: 24, maxH: 10, description: 'Available image updates' },
  { id: 'backup-status',      title: 'Backup status',      iconName: 'Archive',         defaultX: 18, defaultY: 24, defaultW: 6,  defaultH: 3,  minW: 4,  minH: 2, maxW: 24, maxH: 10, description: 'Backup schedule and status' },
  { id: 'log-health',         title: 'Log health',         iconName: 'ScrollText',        defaultX: 0,  defaultY: 27, defaultW: 8,  defaultH: 3,  minW: 3,  minH: 2, maxW: 24, maxH: 8,  description: 'Log error/warning counts' },
  { id: 'maintenance',        title: pageLabel('maintenance'), iconName: 'Wrench',      defaultX: 8,  defaultY: 27, defaultW: 8,  defaultH: 3,  minW: 4,  minH: 2, maxW: 24, maxH: 8,  description: 'Docker cleanup status' },
  { id: 'notifications',      title: pageLabel('notifications'), iconName: 'Bell',      defaultX: 16, defaultY: 27, defaultW: 8,  defaultH: 3,  minW: 4,  minH: 2, maxW: 24, maxH: 8,  description: 'Notification delivery status' },
  { id: 'automations',        title: pageLabel('automations'), iconName: 'Bot',         defaultX: 0,  defaultY: 30, defaultW: 8,  defaultH: 7,  minW: 4,  minH: 2, maxW: 24, maxH: 12, description: 'Active automation rules' },
  { id: 'recent-events',      title: 'Recent events',      iconName: 'Zap',           defaultX: 8,  defaultY: 30, defaultW: 8,  defaultH: 7,  minW: 4,  minH: 2, maxW: 24, maxH: 12, description: 'Docker event timeline' },
  { id: 'quick-actions',      title: 'Quick actions',      iconName: 'Rocket',          defaultX: 16, defaultY: 30, defaultW: 8,  defaultH: 7,  minW: 4,  minH: 2, maxW: 24, maxH: 12, description: 'Common management shortcuts' },
  { id: 'crowdsec',           title: 'Protection',         iconName: 'ShieldCheck',     defaultX: 0,  defaultY: 37, defaultW: 8,  defaultH: 6,  minW: 4,  minH: 2, maxW: 24, maxH: 12, description: 'CrowdSec bans, whitelist and one-click unban' },
  { id: 'stack-controls',     title: 'Stack controls',     iconName: 'Boxes',           defaultX: 8,  defaultY: 37, defaultW: 8,  defaultH: 6,  minW: 4,  minH: 2, maxW: 24, maxH: 16, description: 'Start, stop, restart or update any stack without leaving the dashboard' },
  { id: 'container-spotlight', title: 'Container spotlight', iconName: 'Crosshair',     defaultX: 16, defaultY: 37, defaultW: 8,  defaultH: 6,  minW: 4,  minH: 2, maxW: 24, maxH: 16, description: 'Pin the containers you care about and watch their state, health and load live' },
  { id: 'routes-dns',         title: pageLabel('dns'),      iconName: 'Globe',           defaultX: 0,  defaultY: 43, defaultW: 12, defaultH: 6,  minW: 4,  minH: 2, maxW: 24, maxH: 16, description: 'Every Traefik route one click away, with Cloudflare DNS status' },
  { id: 'notes',              title: 'Notes',              iconName: 'StickyNote',      defaultX: 12, defaultY: 43, defaultW: 6,  defaultH: 6,  minW: 4,  minH: 2, maxW: 24, maxH: 16, description: 'A scratchpad that stays on your dashboard' },
  { id: 'bookmarks',          title: pageLabel('bookmarks'), iconName: 'Bookmark',      defaultX: 18, defaultY: 43, defaultW: 6,  defaultH: 6,  minW: 4,  minH: 2, maxW: 24, maxH: 16, description: 'Your saved bookmarks as tiles' },
  { id: 'proxmox',            title: pageLabel('proxmox'),  iconName: 'Server',          defaultX: 0,  defaultY: 49, defaultW: 8,  defaultH: 7,  minW: 4,  minH: 3, maxW: 24, maxH: 16, description: 'Node load and every VM and container on your Proxmox host' },
  { id: 'power',              title: 'Power',              iconName: 'BatteryCharging', defaultX: 8,  defaultY: 49, defaultW: 6,  defaultH: 5,  minW: 4,  minH: 3, maxW: 24, maxH: 12, description: 'UPS at a glance: mains or battery, charge, runtime, and the clean stop before it runs out' },
]

/** The icons a registry entry can name: the header of the card and the picker in edit mode draw the same one */
export const CARD_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Layers, HeartPulse, Activity, Box, Monitor, HardDrive, TrendingUp, Zap, ArrowUpCircle, Archive, ScrollText,
  Wrench, Bell, Rocket, ShieldCheck, Boxes, Crosshair, Globe, StickyNote, Bookmark, BatteryCharging, Bot, Cpu, Server,
}

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

/** The card's icon, as the registry names it */
export function cardIcon(id: string): LucideIcon {
  return CARD_ICONS[getCardEntry(id)?.iconName ?? ''] ?? Box
}

/** The card's one name: its header, the edit-mode chip and the picker all write it (a card that mirrors a page is called what the page is) */
export function cardTitle(id: string): string {
  return getCardEntry(id)?.title ?? id
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
