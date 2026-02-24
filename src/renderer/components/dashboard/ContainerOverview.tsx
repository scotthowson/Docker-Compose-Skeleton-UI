// =============================================================================
// ContainerOverview — Live container status list for Dashboard
//                     with compact PieChart donut showing status breakdown
// =============================================================================

import React from 'react'
import { Box, CircleDot, Wifi, WifiOff } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useConnectionStore } from '../../stores/connectionStore'
import type { ContainerInfo } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusDot(state: string): string {
  switch (state) {
    case 'running': return 'bg-emerald-400'
    case 'exited': return 'bg-slate-500'
    case 'paused': return 'bg-amber-400'
    case 'restarting': return 'bg-amber-400 animate-pulse'
    default: return 'bg-rose-400'
  }
}

function healthBadge(health: string): { bg: string; text: string } {
  switch (health) {
    case 'healthy': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400' }
    case 'unhealthy': return { bg: 'bg-rose-500/10', text: 'text-rose-400' }
    case 'starting': return { bg: 'bg-amber-500/10', text: 'text-amber-400' }
    default: return { bg: 'bg-slate-500/10', text: 'text-slate-500' }
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}

// ---------------------------------------------------------------------------
// Donut colors for status breakdown
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  running: '#10b981',  // emerald-500
  stopped: '#f43f5e',  // rose-500
  paused: '#f59e0b',   // amber-500
  other: '#64748b',    // slate-500
}

// ---------------------------------------------------------------------------
// Status Donut — compact 80x80 breakdown chart
// ---------------------------------------------------------------------------

function StatusDonut({ containers }: { containers: ContainerInfo[] }) {
  const running = containers.filter((c) => c.state === 'running').length
  const stopped = containers.filter((c) => c.state === 'exited').length
  const paused = containers.filter((c) => c.state === 'paused').length
  const other = containers.length - running - stopped - paused

  const data = [
    { name: 'Running', value: running, color: STATUS_COLORS.running },
    { name: 'Stopped', value: stopped, color: STATUS_COLORS.stopped },
    { name: 'Paused', value: paused, color: STATUS_COLORS.paused },
    { name: 'Other', value: other, color: STATUS_COLORS.other },
  ].filter((d) => d.value > 0)

  // If no containers, show a single grey ring
  if (data.length === 0) {
    data.push({ name: 'None', value: 1, color: '#1e293b' })
  }

  const total = containers.length

  return (
    <div className="relative h-20 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={26}
            outerRadius={36}
            paddingAngle={data.length > 1 ? 3 : 0}
            dataKey="value"
            stroke="none"
            animationBegin={0}
            animationDuration={600}
          >
            {data.map((entry, index) => (
              <Cell key={`status-cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {/* Center: total count */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-white leading-none">{total}</span>
        <span className="text-[8px] text-slate-500 uppercase tracking-wider mt-0.5">total</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function ContainerOverview({ containers }: { containers: ContainerInfo[] }) {
  const connectionStatus = useConnectionStore((s) => s.status)
  const isDisconnected = connectionStatus !== 'connected'

  if (isDisconnected && containers.length === 0) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
          <Box size={14} className="text-cyan-400" />
          Containers
        </h3>
        <div className="flex flex-col items-center py-8 text-slate-500">
          <WifiOff size={24} className="opacity-40 mb-2" />
          <p className="text-xs">Connect to view containers</p>
        </div>
      </div>
    )
  }

  const running = containers.filter((c) => c.state === 'running')
  const stopped = containers.filter((c) => c.state !== 'running')
  const sorted = [...running, ...stopped]

  return (
    <div className="glass-card p-4 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Box size={14} className="text-cyan-400" />
          Containers
        </h3>
        <span className="text-[11px] text-slate-600">
          <span className="text-emerald-400">{running.length}</span>
          <span className="text-slate-700 mx-0.5">/</span>
          {containers.length}
        </span>
      </div>

      {/* Status donut breakdown */}
      {containers.length > 0 && (
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/5">
          <StatusDonut containers={containers} />
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px]">
            {running.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-slate-400">{running.length} running</span>
              </div>
            )}
            {stopped.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-slate-400">
                  {containers.filter((c) => c.state === 'exited').length} stopped
                </span>
              </div>
            )}
            {containers.filter((c) => c.state === 'paused').length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-slate-400">
                  {containers.filter((c) => c.state === 'paused').length} paused
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1 max-h-[320px] overflow-y-auto scrollbar-thin">
        {sorted.map((container) => {
          const hb = healthBadge(container.health)
          return (
            <div
              key={container.name}
              className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors group"
            >
              {/* Status dot */}
              <span className={`h-2 w-2 rounded-full ${statusDot(container.state)} shrink-0`} />

              {/* Name */}
              <span className="flex-1 text-xs font-mono text-slate-300 truncate group-hover:text-white transition-colors" title={container.name}>
                {container.name}
              </span>

              {/* Health badge */}
              {container.health && container.health !== 'none' && container.health !== '' && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${hb.bg} ${hb.text}`}>
                  {container.health}
                </span>
              )}

              {/* Uptime */}
              {container.state === 'running' && container.uptime_seconds > 0 && (
                <span className="text-[10px] text-slate-600 tabular-nums shrink-0">
                  {formatUptime(container.uptime_seconds)}
                </span>
              )}

              {/* Restart count */}
              {container.restart_count > 0 && (
                <span className="text-[10px] text-amber-500/60 shrink-0" title="Restart count">
                  R:{container.restart_count}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
