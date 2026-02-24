// =============================================================================
// Health — Container health monitoring page with status indicator and table
// =============================================================================

import React, { useState, useMemo } from 'react'
import { HeartPulse, Activity, AlertTriangle, XCircle, RefreshCw, WifiOff, Search, ArrowUpDown } from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { fetchHealthReport } from '../api/endpoints'
import { useHealthStore } from '../stores/healthStore'
import { useConnectionStore } from '../stores/connectionStore'
import type { HealthReport, HealthContainer } from '../../shared/types'

// ---------------------------------------------------------------------------
// Status Indicator Config — includes 'unknown' for disconnected / no data
// ---------------------------------------------------------------------------

type HealthStatus = HealthReport['status'] | 'unknown'

const statusConfig: Record<
  HealthStatus,
  { bg: string; ring: string; glow: string; text: string; label: string; Icon: React.ElementType }
> = {
  healthy: {
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-500/30',
    glow: 'glow-emerald',
    text: 'text-emerald-400',
    label: 'All Systems Healthy',
    Icon: HeartPulse,
  },
  degraded: {
    bg: 'bg-amber-500',
    ring: 'ring-amber-500/30',
    glow: 'glow-amber',
    text: 'text-amber-400',
    label: 'System Degraded',
    Icon: AlertTriangle,
  },
  critical: {
    bg: 'bg-rose-500',
    ring: 'ring-rose-500/30',
    glow: 'glow-rose',
    text: 'text-rose-400',
    label: 'Critical Issues Detected',
    Icon: XCircle,
  },
  unknown: {
    bg: 'bg-slate-500',
    ring: 'ring-slate-500/30',
    glow: '',
    text: 'text-slate-400',
    label: 'Unable to Connect',
    Icon: WifiOff,
  },
}

// ---------------------------------------------------------------------------
// Health badge for individual container health field
// ---------------------------------------------------------------------------

function healthBadge(health: string): React.ReactNode {
  const h = health.toLowerCase()
  if (h === 'healthy') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Healthy
      </span>
    )
  }
  if (h === 'unhealthy') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-400">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        Unhealthy
      </span>
    )
  }
  if (h === 'starting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        Starting
      </span>
    )
  }
  // no healthcheck or other
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/15 px-2.5 py-0.5 text-xs font-medium text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {health || 'N/A'}
    </span>
  )
}

function stateBadge(state: string): React.ReactNode {
  const s = state.toLowerCase()
  if (s === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
        Running
      </span>
    )
  }
  if (s === 'exited' || s === 'stopped') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/15 px-2.5 py-0.5 text-xs font-medium text-slate-400">
        Stopped
      </span>
    )
  }
  if (s === 'restarting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
        Restarting
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
      {state}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Health() {
  const setReport = useHealthStore((s) => s.setReport)
  const connectionStatus = useConnectionStore((s) => s.status)
  const isConnected = connectionStatus === 'connected'

  const { data, loading, error, refresh } = usePolling<HealthReport>(fetchHealthReport, 5000, {
    enabled: isConnected,
  })

  // Sync to store
  React.useEffect(() => {
    if (data) setReport(data)
  }, [data, setReport])

  // Also use the global store as fallback if the local poll hasn't returned yet
  const storeReport = useHealthStore((s) => s.report)
  const report = data ?? storeReport
  const isDisconnected = !report && !isConnected
  const hasError = !report && !!error
  // NEVER default to 'healthy' — only the API can say we're healthy
  const status: HealthStatus = report?.status ?? 'unknown'
  const cfg = statusConfig[status]
  const StatusIcon = cfg.Icon
  const summary = report?.summary ?? { total: 0, healthy: 0, unhealthy: 0, stopped: 0 }
  const containers: HealthContainer[] = report?.containers ?? []

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'unhealthy' | 'stopped'>('all')
  const [sortAsc, setSortAsc] = useState(true)

  // Filtered and sorted containers
  const filteredContainers = useMemo(() => {
    let result = containers
    if (healthFilter === 'healthy') result = result.filter((c) => c.health.toLowerCase() === 'healthy')
    else if (healthFilter === 'unhealthy') result = result.filter((c) => c.health.toLowerCase() === 'unhealthy')
    else if (healthFilter === 'stopped') result = result.filter((c) => c.state.toLowerCase() !== 'running')
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((c) => c.name.toLowerCase().includes(q) || c.health.toLowerCase().includes(q) || c.state.toLowerCase().includes(q))
    }
    result = [...result].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name)
      return sortAsc ? cmp : -cmp
    })
    return result
  }, [containers, searchQuery, healthFilter, sortAsc])

  // Proportions for health bar
  const total = summary.total || 1
  const healthyPct = (summary.healthy / total) * 100
  const unhealthyPct = (summary.unhealthy / total) * 100
  const stoppedPct = (summary.stopped / total) * 100

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Health Monitor</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Real-time container health status across all stacks
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="
            flex items-center gap-2 rounded-lg px-3.5 py-2
            text-sm font-medium text-slate-300
            bg-white/5 border border-white/10
            hover:bg-white/10 hover:border-white/15
            disabled:opacity-50 transition-all duration-200
          "
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass rounded-xl p-4 border-rose-500/30">
          <p className="text-sm text-rose-400">Failed to fetch health data: {error.message}</p>
        </div>
      )}

      {/* Large status indicator */}
      <div className={`glass rounded-xl p-8 flex flex-col items-center gap-4 ${cfg.glow}`}>
        <div className={`relative flex items-center justify-center`}>
          <span
            className={`absolute h-20 w-20 rounded-full ${cfg.bg} opacity-20 animate-ping`}
            style={{ animationDuration: '2s' }}
          />
          <span
            className={`relative flex items-center justify-center h-20 w-20 rounded-full ${cfg.bg}/20 ring-4 ${cfg.ring}`}
          >
            <StatusIcon size={36} className={cfg.text} strokeWidth={2} />
          </span>
        </div>
        <div className="text-center">
          <p className={`text-xl font-bold ${cfg.text}`}>{cfg.label}</p>
          <p className="text-sm text-slate-400 mt-1">
            {summary.total} container{summary.total !== 1 ? 's' : ''} monitored
          </p>
        </div>
      </div>

      {/* Summary stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {([
          { label: 'Total', value: summary.total, color: 'text-slate-100', bg: 'bg-slate-500/10' },
          { label: 'Healthy', value: summary.healthy, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Unhealthy', value: summary.unhealthy, color: 'text-rose-400', bg: 'bg-rose-500/10' },
          { label: 'Stopped', value: summary.stopped, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        ] as const).map((item) => (
          <div key={item.label} className="glass-subtle rounded-xl p-4 text-center">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{item.label}</p>
            <p className={`mt-2 text-3xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Visual health bar */}
      {summary.total > 0 && (
        <div className="glass-subtle rounded-xl p-5">
          <p className="text-sm font-medium text-slate-300 mb-3">Health Distribution</p>
          <div className="flex h-4 rounded-full overflow-hidden bg-slate-800">
            {healthyPct > 0 && (
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${healthyPct}%` }}
                title={`Healthy: ${summary.healthy}`}
              />
            )}
            {unhealthyPct > 0 && (
              <div
                className="bg-rose-500 transition-all duration-500"
                style={{ width: `${unhealthyPct}%` }}
                title={`Unhealthy: ${summary.unhealthy}`}
              />
            )}
            {stoppedPct > 0 && (
              <div
                className="bg-slate-600 transition-all duration-500"
                style={{ width: `${stoppedPct}%` }}
                title={`Stopped: ${summary.stopped}`}
              />
            )}
          </div>
          <div className="flex items-center gap-6 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Healthy ({summary.healthy})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Unhealthy ({summary.unhealthy})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-600" /> Stopped ({summary.stopped})
            </span>
          </div>
        </div>
      )}

      {/* Container health table */}
      <div className="glass-subtle rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 shrink-0">
            <Activity size={16} className="text-emerald-400" />
            Container Health
            <span className="text-xs font-normal text-slate-500">
              ({filteredContainers.length}{filteredContainers.length !== containers.length ? ` / ${containers.length}` : ''})
            </span>
          </h3>
          <div className="flex items-center gap-2 flex-1 justify-end">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.04] rounded-lg p-0.5">
              {([
                { key: 'all', label: 'All' },
                { key: 'healthy', label: 'Healthy' },
                { key: 'unhealthy', label: 'Unhealthy' },
                { key: 'stopped', label: 'Stopped' },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setHealthFilter(f.key)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                    healthFilter === f.key
                      ? f.key === 'healthy' ? 'bg-emerald-500/15 text-emerald-400'
                        : f.key === 'unhealthy' ? 'bg-rose-500/15 text-rose-400'
                        : f.key === 'stopped' ? 'bg-slate-500/15 text-slate-400'
                        : 'bg-cyan-500/15 text-cyan-400'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative w-48">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter containers..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white/[0.03] border border-white/[0.06] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 transition-all"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th
                  className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  <span className="inline-flex items-center gap-1">
                    Container
                    <ArrowUpDown size={10} className="text-slate-600" />
                  </span>
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  State
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Health Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredContainers.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                    No container data available
                  </td>
                </tr>
              )}
              {loading && containers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                    <RefreshCw size={16} className="inline animate-spin mr-2" />
                    Loading health data...
                  </td>
                </tr>
              )}
              {filteredContainers.map((c) => (
                <tr
                  key={c.name}
                  className="hover:bg-white/[0.03] transition-colors duration-150"
                >
                  <td className="px-5 py-3 font-mono text-slate-200 text-xs">
                    {c.name}
                  </td>
                  <td className="px-5 py-3">{stateBadge(c.state)}</td>
                  <td className="px-5 py-3">{healthBadge(c.health)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
