// =============================================================================
// ContainerRow — Table row + mobile card for a single container
// =============================================================================

import React from 'react'
import { ContainerInfo, ContainerStats } from '../../../shared/types'
import { useContainerStore } from '../../stores/containerStore'
import {
  Box, RefreshCw, CheckSquare, Square,
  Star, Cpu, MemoryStick, Clock, ChevronRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '\u2026'
}

function parseCpuPercent(cpuStr: string | undefined): number {
  if (!cpuStr || cpuStr === '--') return 0
  const match = cpuStr.match(/([\d.]+)/)
  return match ? parseFloat(match[1]) : 0
}

function parseMemPercent(memStr: string | undefined): number {
  if (!memStr || memStr === '--') return 0
  const match = memStr.match(/([\d.]+)/)
  return match ? parseFloat(match[1]) : 0
}

// ---------------------------------------------------------------------------
// Badge variants
// ---------------------------------------------------------------------------

type BadgeVariant = { bg: string; text: string; ring: string; dot: string }

const STATE_VARIANTS: Record<string, BadgeVariant> = {
  running: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20', dot: 'bg-emerald-400' },
  exited:  { bg: 'bg-rose-500/10', text: 'text-rose-400', ring: 'ring-rose-500/20', dot: 'bg-rose-400' },
  paused:  { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/20', dot: 'bg-amber-400' },
  restarting: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', ring: 'ring-cyan-500/20', dot: 'bg-cyan-400' },
  created: { bg: 'bg-slate-500/10', text: 'text-slate-400', ring: 'ring-slate-500/20', dot: 'bg-slate-400' },
}
const DEFAULT_STATE_VARIANT: BadgeVariant = { bg: 'bg-slate-500/10', text: 'text-slate-400', ring: 'ring-slate-500/20', dot: 'bg-slate-400' }

const HEALTH_VARIANTS: Record<string, BadgeVariant> = {
  healthy:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20', dot: 'bg-emerald-400' },
  unhealthy: { bg: 'bg-rose-500/10', text: 'text-rose-400', ring: 'ring-rose-500/20', dot: 'bg-rose-400' },
  starting:  { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/20', dot: 'bg-amber-400' },
}
const DEFAULT_HEALTH_VARIANT: BadgeVariant = { bg: 'bg-slate-500/10', text: 'text-slate-400', ring: 'ring-slate-500/20', dot: 'bg-slate-400' }

// ---------------------------------------------------------------------------
// Inline stats mini-bar
// ---------------------------------------------------------------------------

function MiniBar({ percent, label }: { percent: number; label: string }) {
  const color = percent > 80 ? 'bg-rose-400' : percent > 60 ? 'bg-amber-400' : 'bg-emerald-400'
  const textColor = percent > 80 ? 'text-rose-400' : percent > 60 ? 'text-amber-400' : 'text-slate-500'
  return (
    <div className="flex items-center gap-1" title={`${label}: ${percent.toFixed(1)}%`}>
      <div className="w-10 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <span className={`text-[9px] tabular-nums ${textColor}`}>{Math.round(percent)}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContainerRowProps {
  container: ContainerInfo
  isSelected: boolean
  onClick: (name: string) => void
  batchMode?: boolean
  batchSelected?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (name: string) => void
}

// ---------------------------------------------------------------------------
// Desktop table row
// ---------------------------------------------------------------------------

const ContainerRow: React.FC<ContainerRowProps> = ({
  container, isSelected, onClick,
  batchMode, batchSelected,
  isFavorite, onToggleFavorite,
}) => {
  const stats: ContainerStats | undefined = useContainerStore((s) => s.stats[container.name])

  const stateKey = container.state.toLowerCase()
  const sv = STATE_VARIANTS[stateKey] ?? DEFAULT_STATE_VARIANT
  const healthKey = container.health.toLowerCase()
  const hv = HEALTH_VARIANTS[healthKey] ?? DEFAULT_HEALTH_VARIANT

  const cpuPct = parseCpuPercent(stats?.cpu_percent)
  const memPct = parseMemPercent(stats?.memory_percent)
  const isRunning = stateKey === 'running'

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

      {/* Favorite star */}
      <td className="px-1 py-3 w-8">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(container.name) }}
          className="p-0.5 rounded transition-colors hover:bg-white/[0.06]"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            size={13}
            className={isFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-700 hover:text-slate-500'}
          />
        </button>
      </td>

      {/* Name */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <Box className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
          <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
            {container.name}
          </span>
        </div>
      </td>

      {/* State */}
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${sv.bg} ${sv.text} ${sv.ring}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${sv.dot} ${stateKey === 'running' ? 'animate-pulse' : ''}`} />
          {container.state}
        </span>
      </td>

      {/* CPU + Memory (inline stats) */}
      <td className="px-3 py-3">
        {isRunning && stats ? (
          <div className="flex flex-col gap-0.5">
            <MiniBar percent={cpuPct} label="CPU" />
            <MiniBar percent={memPct} label="Memory" />
          </div>
        ) : (
          <span className="text-xs text-slate-600">--</span>
        )}
      </td>

      {/* Image */}
      <td className="px-3 py-3 hidden lg:table-cell">
        <span className="text-xs text-slate-400 font-mono" title={container.image}>
          {truncate(container.image, 35)}
        </span>
      </td>

      {/* Uptime */}
      <td className="px-3 py-3 hidden xl:table-cell">
        <span className="text-sm text-slate-400">{formatUptime(container.uptime_seconds)}</span>
      </td>

      {/* Restarts */}
      <td className="px-3 py-3 text-center hidden xl:table-cell">
        <span className={`inline-flex items-center gap-1 text-sm ${container.restart_count > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
          {container.restart_count > 0 && <RefreshCw className="h-3 w-3" />}
          {container.restart_count}
        </span>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Mobile card view
// ---------------------------------------------------------------------------

export const ContainerCard: React.FC<ContainerRowProps> = ({
  container, isSelected, onClick,
  batchMode, batchSelected,
  isFavorite, onToggleFavorite,
}) => {
  const stats: ContainerStats | undefined = useContainerStore((s) => s.stats[container.name])

  const stateKey = container.state.toLowerCase()
  const sv = STATE_VARIANTS[stateKey] ?? DEFAULT_STATE_VARIANT
  const healthKey = container.health.toLowerCase()
  const hv = HEALTH_VARIANTS[healthKey] ?? DEFAULT_HEALTH_VARIANT

  const cpuPct = parseCpuPercent(stats?.cpu_percent)
  const memPct = parseMemPercent(stats?.memory_percent)
  const isRunning = stateKey === 'running'

  return (
    <div
      onClick={() => onClick(container.name)}
      className={`
        group cursor-pointer rounded-xl p-3.5 transition-all duration-200
        border
        ${batchMode && batchSelected
          ? 'bg-cyan-500/[0.08] border-cyan-500/20'
          : isSelected
            ? 'bg-emerald-500/[0.06] border-emerald-500/20'
            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] active:scale-[0.98]'
        }
      `}
    >
      {/* Top: name + state + favorite */}
      <div className="flex items-center gap-2.5">
        {batchMode && (
          <div className="flex-shrink-0">
            {batchSelected
              ? <CheckSquare size={16} className="text-cyan-400" />
              : <Square size={16} className="text-slate-600" />
            }
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(container.name) }}
          className="p-0.5 flex-shrink-0"
        >
          <Star
            size={14}
            className={isFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}
          />
        </button>
        <Box className="h-4 w-4 text-slate-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-slate-200 truncate flex-1">
          {container.name}
        </span>
        <ChevronRight className="h-4 w-4 text-slate-600 flex-shrink-0" />
      </div>

      {/* Middle: badges */}
      <div className="flex items-center gap-2 mt-2.5">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${sv.bg} ${sv.text} ${sv.ring}`}>
          <span className={`h-1 w-1 rounded-full ${sv.dot} ${stateKey === 'running' ? 'animate-pulse' : ''}`} />
          {container.state}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${hv.bg} ${hv.text} ${hv.ring}`}>
          <span className={`h-1 w-1 rounded-full ${hv.dot}`} />
          {container.health || 'none'}
        </span>
        {container.restart_count > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
            <RefreshCw size={9} /> {container.restart_count}
          </span>
        )}
      </div>

      {/* Bottom: stats + uptime */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04]">
        {isRunning && stats ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Cpu size={10} className="text-cyan-400" />
              <MiniBar percent={cpuPct} label="CPU" />
            </div>
            <div className="flex items-center gap-1">
              <MemoryStick size={10} className="text-emerald-400" />
              <MiniBar percent={memPct} label="Memory" />
            </div>
          </div>
        ) : (
          <span className="text-[10px] text-slate-600">No live stats</span>
        )}
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Clock size={9} />
          {formatUptime(container.uptime_seconds)}
        </div>
      </div>
    </div>
  )
}

export default ContainerRow
