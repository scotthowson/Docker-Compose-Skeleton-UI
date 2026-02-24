// =============================================================================
// ContainerRow — Table row component for a single container
// =============================================================================

import React from 'react'
import { ContainerInfo } from '../../../shared/types'
import { Box, RefreshCw, CheckSquare, Square } from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format seconds into a human-readable uptime string, e.g. "2d 5h 30m". */
function formatUptime(seconds: number): string {
  if (seconds <= 0) return '--'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)

  return parts.join(' ')
}

/** Truncate a string to maxLen characters, appending ellipsis if needed. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '\u2026'
}

// ---------------------------------------------------------------------------
// State badge color mappings
// ---------------------------------------------------------------------------

type BadgeVariant = {
  bg: string
  text: string
  ring: string
  dot: string
}

const STATE_VARIANTS: Record<string, BadgeVariant> = {
  running: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  exited: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    ring: 'ring-rose-500/20',
    dot: 'bg-rose-400',
  },
  paused: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-400',
  },
  restarting: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    ring: 'ring-cyan-500/20',
    dot: 'bg-cyan-400',
  },
  created: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    ring: 'ring-slate-500/20',
    dot: 'bg-slate-400',
  },
}

const DEFAULT_STATE_VARIANT: BadgeVariant = {
  bg: 'bg-slate-500/10',
  text: 'text-slate-400',
  ring: 'ring-slate-500/20',
  dot: 'bg-slate-400',
}

const HEALTH_VARIANTS: Record<string, BadgeVariant> = {
  healthy: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  unhealthy: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    ring: 'ring-rose-500/20',
    dot: 'bg-rose-400',
  },
  starting: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-400',
  },
}

const DEFAULT_HEALTH_VARIANT: BadgeVariant = {
  bg: 'bg-slate-500/10',
  text: 'text-slate-400',
  ring: 'ring-slate-500/20',
  dot: 'bg-slate-400',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContainerRowProps {
  container: ContainerInfo
  isSelected: boolean
  onClick: (name: string) => void
  batchMode?: boolean
  batchSelected?: boolean
}

const ContainerRow: React.FC<ContainerRowProps> = ({ container, isSelected, onClick, batchMode, batchSelected }) => {
  const stateKey = container.state.toLowerCase()
  const sv = STATE_VARIANTS[stateKey] ?? DEFAULT_STATE_VARIANT

  const healthKey = container.health.toLowerCase()
  const hv = HEALTH_VARIANTS[healthKey] ?? DEFAULT_HEALTH_VARIANT

  return (
    <tr
      onClick={() => onClick(container.name)}
      className={`
        group cursor-pointer transition-all duration-200 border-b border-white/[0.04]
        ${batchMode && batchSelected
          ? 'bg-cyan-500/[0.08] border-l-2 border-l-cyan-400'
          : isSelected
            ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400'
            : 'hover:bg-white/[0.04] border-l-2 border-l-transparent'
        }
      `}
    >
      {/* Batch checkbox */}
      {batchMode && (
        <td className="px-3 py-3 w-10">
          {batchSelected
            ? <CheckSquare size={15} className="text-cyan-400" />
            : <Square size={15} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
          }
        </td>
      )}
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Box className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
          <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
            {container.name}
          </span>
        </div>
      </td>

      {/* State */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${sv.bg} ${sv.text} ${sv.ring}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${sv.dot} ${stateKey === 'running' ? 'animate-pulse' : ''}`} />
          {container.state}
        </span>
      </td>

      {/* Health */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${hv.bg} ${hv.text} ${hv.ring}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${hv.dot}`} />
          {container.health || 'none'}
        </span>
      </td>

      {/* Image */}
      <td className="px-4 py-3">
        <span className="text-sm text-slate-400 font-mono" title={container.image}>
          {truncate(container.image, 40)}
        </span>
      </td>

      {/* Uptime */}
      <td className="px-4 py-3">
        <span className="text-sm text-slate-400">
          {formatUptime(container.uptime_seconds)}
        </span>
      </td>

      {/* Ports */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500 font-mono" title={container.ports}>
          {container.ports ? truncate(container.ports, 30) : '--'}
        </span>
      </td>

      {/* Restart Count */}
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-flex items-center gap-1 text-sm ${
            container.restart_count > 0 ? 'text-amber-400' : 'text-slate-500'
          }`}
        >
          {container.restart_count > 0 && (
            <RefreshCw className="h-3 w-3" />
          )}
          {container.restart_count}
        </span>
      </td>
    </tr>
  )
}

export default ContainerRow
