// =============================================================================
// ContainerOverview — Live container status list for Dashboard
// =============================================================================

import React from 'react'
import { Box, CircleDot, Wifi, WifiOff } from 'lucide-react'
import { useConnectionStore } from '../../stores/connectionStore'
import type { ContainerInfo } from '../../../shared/types'

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

export default function ContainerOverview({ containers }: { containers: ContainerInfo[] }) {
  const connectionStatus = useConnectionStore((s) => s.status)
  const isDisconnected = connectionStatus !== 'connected'

  if (isDisconnected && containers.length === 0) {
    return (
      <div className="glass-card p-6 animate-fade-in">
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
    <div className="glass-card p-6 animate-fade-in">
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
