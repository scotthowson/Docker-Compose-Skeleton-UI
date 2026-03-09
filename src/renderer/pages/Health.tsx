// =============================================================================
// Health — Container health monitoring with enriched data, resource overview,
// and mobile-responsive layout
// =============================================================================

import React, { useState, useMemo } from 'react'
import {
  HeartPulse, Activity, AlertTriangle, XCircle, RefreshCw, WifiOff,
  Search, ArrowUpDown, Download, Clock, RotateCcw, Box, Cpu, MemoryStick,
  HardDrive, ChevronDown, ChevronUp,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { fetchHealthReport, fetchContainers, fetchSystemMetrics, fetchHealthScore } from '../api/endpoints'
import { useHealthStore } from '../stores/healthStore'
import { useConnectionStore } from '../stores/connectionStore'
import type { HealthReport, HealthContainer, ContainerInfo, SystemMetricsResponse, HealthScoreResponse } from '../../shared/types'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  if (seconds <= 0) return '--'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

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
// Enriched container — health + container info merged
// ---------------------------------------------------------------------------

interface EnrichedContainer extends HealthContainer {
  image?: string
  uptime_seconds?: number
  restart_count?: number
  ports?: string
}

// ---------------------------------------------------------------------------
// Resource Gauge component
// ---------------------------------------------------------------------------

function ResourceGauge({ label, value, icon: Icon, color, detail }: {
  label: string
  value: string
  icon: React.ElementType
  color: string
  detail?: string
}) {
  // Parse percentage from value like "23%" or "23.5%"
  const pct = parseFloat(value) || 0
  const clampedPct = Math.min(100, Math.max(0, pct))
  const barColor = pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : `bg-${color}-500`

  return (
    <div className="glass-subtle rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={`text-${color}-400`} />
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={`text-xl md:text-2xl font-bold text-slate-100`}>{value}</p>
      <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
      {detail && <p className="text-[10px] text-slate-500 mt-1.5">{detail}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Health Score — grade colors + gauge (consistent with Dashboard HealthSummary)
// ---------------------------------------------------------------------------

const gradeColors: Record<string, string> = {
  A: 'text-emerald-400', B: 'text-cyan-400', C: 'text-amber-400', D: 'text-orange-400', F: 'text-rose-400',
}
const gradeStroke: Record<string, string> = {
  A: '#10b981', B: '#06b6d4', C: '#f59e0b', D: '#f97316', F: '#f43f5e',
}
const gradeBg: Record<string, string> = {
  A: 'bg-emerald-500/10 border-emerald-500/20', B: 'bg-cyan-500/10 border-cyan-500/20',
  C: 'bg-amber-500/10 border-amber-500/20', D: 'bg-orange-500/10 border-orange-500/20',
  F: 'bg-rose-500/10 border-rose-500/20',
}

function getGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function ScoreGauge({ score, grade, loading, size = 140 }: { score: number; grade: string; loading: boolean; size?: number }) {
  const strokeWidth = 9
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const stroke = gradeStroke[grade] || '#64748b'

  return (
    <div className="relative shrink-0">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        {!loading && (
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {loading ? (
          <div className="w-8 h-8 rounded-full skeleton" />
        ) : (
          <>
            <span className="text-3xl font-bold text-white leading-none">{score}</span>
            <span className={`text-sm font-semibold mt-0.5 ${gradeColors[grade] || 'text-slate-400'}`}>{grade}</span>
          </>
        )}
      </div>
    </div>
  )
}

function ScoreFactorBar({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-slate-500 w-[60px] shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-7 text-right tabular-nums font-medium">{value}</span>
      {detail && <span className="text-[10px] text-slate-600 w-16 text-right truncate">{detail}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Health() {
  const setReport = useHealthStore((s) => s.setReport)
  const connectionStatus = useConnectionStore((s) => s.status)
  const isConnected = connectionStatus === 'connected'

  // Poll health report
  const { data, loading, error, refresh } = usePolling<HealthReport>(fetchHealthReport, 5000, {
    enabled: isConnected,
  })

  // Poll full container list for enriched data (image, uptime, restart count)
  const { data: containerData } = usePolling<{ containers: ContainerInfo[] }>(fetchContainers, 10000, {
    enabled: isConnected,
  })

  // Poll system metrics for resource overview
  const { data: metrics } = usePolling<SystemMetricsResponse>(fetchSystemMetrics, 10000, {
    enabled: isConnected,
  })

  // Poll health score for scoring + factor breakdown
  const { data: healthScoreData, loading: scoreLoading } = usePolling<HealthScoreResponse>(fetchHealthScore, 15000, {
    enabled: isConnected,
  })

  // Sync to store
  React.useEffect(() => {
    if (data) setReport(data)
  }, [data, setReport])

  // Also use the global store as fallback if the local poll hasn't returned yet
  const storeReport = useHealthStore((s) => s.report)
  const report = data ?? storeReport
  // NEVER default to 'healthy' — only the API can say we're healthy
  const status: HealthStatus = report?.status ?? 'unknown'
  const cfg = statusConfig[status]
  const StatusIcon = cfg.Icon
  const summary = report?.summary ?? { total: 0, healthy: 0, unhealthy: 0, stopped: 0 }
  const healthContainers: HealthContainer[] = report?.containers ?? []

  // Merge health data with container info
  const containerMap = useMemo(() => {
    const map = new Map<string, ContainerInfo>()
    if (containerData?.containers) {
      for (const c of containerData.containers) {
        map.set(c.name, c)
      }
    }
    return map
  }, [containerData])

  const enrichedContainers: EnrichedContainer[] = useMemo(() => {
    return healthContainers.map((hc) => {
      const info = containerMap.get(hc.name)
      return {
        ...hc,
        image: info?.image,
        uptime_seconds: info?.uptime_seconds,
        restart_count: info?.restart_count,
        ports: info?.ports,
      }
    })
  }, [healthContainers, containerMap])

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'unhealthy' | 'stopped'>('all')
  const [sortAsc, setSortAsc] = useState(true)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Filtered and sorted containers
  const filteredContainers = useMemo(() => {
    let result = enrichedContainers
    if (healthFilter === 'healthy') result = result.filter((c) => c.health.toLowerCase() === 'healthy')
    else if (healthFilter === 'unhealthy') result = result.filter((c) => c.health.toLowerCase() === 'unhealthy')
    else if (healthFilter === 'stopped') result = result.filter((c) => c.state.toLowerCase() !== 'running')
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.health.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        (c.image && c.image.toLowerCase().includes(q))
      )
    }
    result = [...result].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name)
      return sortAsc ? cmp : -cmp
    })
    return result
  }, [enrichedContainers, searchQuery, healthFilter, sortAsc])

  // Computed stats
  const total = summary.total || 1
  const healthyPct = (summary.healthy / total) * 100
  const unhealthyPct = (summary.unhealthy / total) * 100
  const stoppedPct = (summary.stopped / total) * 100
  const totalRestarts = enrichedContainers.reduce((sum, c) => sum + (c.restart_count ?? 0), 0)
  const restartingCount = enrichedContainers.filter((c) => c.state.toLowerCase() === 'restarting').length

  // Health score data
  const score = healthScoreData?.score ?? 0
  const grade = healthScoreData?.grade ?? getGrade(score)
  const factors = healthScoreData?.factors

  // Export health report as JSON file
  const exportHealthReport = () => {
    if (!report) return
    const exportData = {
      ...report,
      exportedAt: new Date().toISOString(),
      containers: enrichedContainers,
      metrics: metrics ?? null,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const date = new Date().toISOString().slice(0, 10)
    const a = document.createElement('a')
    a.href = url
    a.download = `health-report-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <DisconnectedBanner />
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base md:text-xl font-bold text-slate-100">Health Monitor</h2>
          <p className="mt-0.5 text-xs md:text-sm text-slate-500">
            Real-time container health and system resource monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportHealthReport}
            disabled={!report}
            className="
              flex items-center gap-1.5 rounded-lg px-3 py-2
              text-xs font-medium text-cyan-400
              bg-cyan-500/10 border border-cyan-500/20
              hover:bg-cyan-500/20 hover:border-cyan-500/30
              disabled:opacity-50 transition-all duration-200
            "
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="
              flex items-center gap-1.5 rounded-lg px-3 py-2
              text-xs font-medium text-slate-300
              bg-white/5 border border-white/10
              hover:bg-white/10 hover:border-white/15
              disabled:opacity-50 transition-all duration-200
            "
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass rounded-xl p-4 border-rose-500/30">
          <p className="text-sm text-rose-400">Failed to fetch health data: {error.message}</p>
        </div>
      )}

      {/* Status indicator + summary stats — side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Large status indicator */}
        <div className={`glass rounded-xl p-6 md:p-8 flex flex-col items-center justify-center gap-3 ${cfg.glow}`}>
          <div className="relative flex items-center justify-center">
            <span
              className={`absolute h-16 w-16 md:h-20 md:w-20 rounded-full ${cfg.bg} opacity-20 animate-ping`}
              style={{ animationDuration: '2s' }}
            />
            <span
              className={`relative flex items-center justify-center h-16 w-16 md:h-20 md:w-20 rounded-full ${cfg.bg}/20 ring-4 ${cfg.ring}`}
            >
              <StatusIcon size={28} className={`${cfg.text} md:hidden`} strokeWidth={2} />
              <StatusIcon size={36} className={`${cfg.text} hidden md:block`} strokeWidth={2} />
            </span>
          </div>
          <div className="text-center">
            <p className={`text-lg md:text-xl font-bold ${cfg.text}`}>{cfg.label}</p>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              {summary.total} container{summary.total !== 1 ? 's' : ''} monitored
            </p>
          </div>
        </div>

        {/* Summary stats grid */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
          {([
            { label: 'Healthy', value: summary.healthy, color: 'text-emerald-400', icon: HeartPulse, iconColor: 'text-emerald-400' },
            { label: 'Unhealthy', value: summary.unhealthy, color: 'text-rose-400', icon: XCircle, iconColor: 'text-rose-400' },
            { label: 'Stopped', value: summary.stopped, color: 'text-slate-400', icon: Box, iconColor: 'text-slate-400' },
            { label: 'Restarting', value: restartingCount, color: 'text-amber-400', icon: RotateCcw, iconColor: 'text-amber-400' },
            { label: 'Total Restarts', value: totalRestarts, color: totalRestarts > 10 ? 'text-amber-400' : 'text-slate-100', icon: RefreshCw, iconColor: totalRestarts > 10 ? 'text-amber-400' : 'text-slate-400' },
            { label: 'Running', value: summary.total - summary.stopped, color: 'text-cyan-400', icon: Activity, iconColor: 'text-cyan-400' },
          ] as const).map((item) => (
            <div key={item.label} className="glass-subtle rounded-xl p-3 md:p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon size={12} className={item.iconColor} />
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{item.label}</p>
              </div>
              <p className={`text-xl md:text-2xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Health Score — gauge + factor breakdown */}
      <div className="glass-subtle rounded-xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HeartPulse size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">Health Score</h3>
          </div>
          {!scoreLoading && healthScoreData && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${gradeBg[grade] || 'bg-slate-500/10 border-slate-500/20'} ${gradeColors[grade] || 'text-slate-400'}`}>
              Grade {grade}
            </span>
          )}
        </div>

        <div className="flex items-start gap-6 md:gap-8">
          {/* Score gauge */}
          <div className="flex flex-col items-center gap-2">
            <ScoreGauge score={score} grade={grade} loading={scoreLoading && !healthScoreData} />
          </div>

          {/* Factor breakdown */}
          <div className="flex-1 min-w-0 pt-2">
            {scoreLoading && !healthScoreData ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-4 skeleton rounded" />)}
              </div>
            ) : factors ? (
              <div className="space-y-3">
                <ScoreFactorBar label="Stacks" value={factors.stacks.score} detail={`${factors.stacks.healthy}/${factors.stacks.total}`} />
                <ScoreFactorBar label="Resources" value={factors.resources.score} detail={`${factors.resources.cpu_pct}% cpu`} />
                <ScoreFactorBar label="Images" value={factors.images.score} detail={factors.images.stale > 0 ? `${factors.images.stale} stale` : 'fresh'} />
                <ScoreFactorBar label="Uptime" value={factors.uptime.score} detail={formatUptime(factors.uptime.seconds)} />
              </div>
            ) : (
              <p className="text-xs text-slate-500">Health scoring data unavailable</p>
            )}
          </div>
        </div>

        {/* Per-stack scores */}
        {healthScoreData?.stacks && healthScoreData.stacks.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/[0.04]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2.5">Stack Scores</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {healthScoreData.stacks.map((stack) => {
                const sg = stack.grade || getGrade(stack.score)
                return (
                  <div key={stack.stack} className="rounded-lg bg-slate-800/40 px-3 py-2 border border-white/[0.03]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-slate-300 font-mono truncate">{stack.stack}</span>
                      <span className={`text-[10px] font-semibold ${gradeColors[sg] || 'text-slate-400'}`}>{sg}</span>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          stack.score >= 80 ? 'bg-emerald-500' : stack.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${stack.score}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 tabular-nums">{stack.score}/100</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Resource overview — CPU / Memory / Disk from system metrics */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResourceGauge
            label="CPU Load"
            value={metrics.cpu ? `${(metrics.cpu.load_average[0] / metrics.cpu.count * 100).toFixed(0)}%` : '0%'}
            icon={Cpu}
            color="cyan"
            detail={`${metrics.cpu?.count ?? '?'} cores — load ${metrics.cpu?.load_average[0].toFixed(1) ?? '?'}`}
          />
          <ResourceGauge
            label="Memory"
            value={metrics.memory ? `${((metrics.memory.used_mb / metrics.memory.total_mb) * 100).toFixed(0)}%` : '0%'}
            icon={MemoryStick}
            color="violet"
            detail={metrics.memory ? `${(metrics.memory.used_mb / 1024).toFixed(1)}G / ${(metrics.memory.total_mb / 1024).toFixed(1)}G` : undefined}
          />
          <ResourceGauge
            label="Disk"
            value={metrics.disks?.[0]?.percent ?? '0%'}
            icon={HardDrive}
            color="amber"
            detail={metrics.disks?.[0] ? `${metrics.disks[0].used} / ${metrics.disks[0].total}` : undefined}
          />
        </div>
      )}

      {/* Visual health bar */}
      {summary.total > 0 && (
        <div className="glass-subtle rounded-xl p-4 md:p-5">
          <p className="text-xs md:text-sm font-medium text-slate-300 mb-3">Health Distribution</p>
          <div className="flex h-3 md:h-4 rounded-full overflow-hidden bg-slate-800">
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
          <div className="flex flex-wrap items-center gap-3 md:gap-6 mt-3 text-[10px] md:text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-emerald-500" /> Healthy ({summary.healthy})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-rose-500" /> Unhealthy ({summary.unhealthy})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-slate-600" /> Stopped ({summary.stopped})
            </span>
          </div>
        </div>
      )}

      {/* Container health table */}
      <div className="glass-subtle rounded-xl overflow-hidden">
        {/* Header with filters */}
        <div className="px-4 md:px-5 py-3 md:py-4 border-b border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 shrink-0">
            <Activity size={16} className="text-emerald-400" />
            Container Health
            <span className="text-xs font-normal text-slate-500">
              ({filteredContainers.length}{filteredContainers.length !== enrichedContainers.length ? ` / ${enrichedContainers.length}` : ''})
            </span>
          </h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Filter tabs */}
            <div className="flex items-center gap-0.5 bg-white/[0.02] border border-white/[0.04] rounded-lg p-0.5 shrink-0 overflow-x-auto">
              {([
                { key: 'all', label: 'All' },
                { key: 'healthy', label: 'OK' },
                { key: 'unhealthy', label: 'Bad' },
                { key: 'stopped', label: 'Off' },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setHealthFilter(f.key)}
                  className={`px-2 md:px-2.5 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${
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
            <div className="relative flex-1 min-w-0 sm:w-48 sm:flex-none">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white/[0.03] border border-white/[0.06] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Desktop table (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto">
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
                  Image
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  State
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Health
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Uptime
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Restarts
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredContainers.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No container data available
                  </td>
                </tr>
              )}
              {loading && enrichedContainers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
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
                  <td className="px-5 py-3 font-mono text-slate-200 text-xs max-w-[200px] truncate" title={c.name}>
                    {c.name}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400 max-w-[200px] truncate font-mono" title={c.image}>
                    {c.image ? c.image.split(':')[0].split('/').pop() : '--'}
                    {c.image?.includes(':') && (
                      <span className="text-slate-600">:{c.image.split(':').pop()}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">{stateBadge(c.state)}</td>
                  <td className="px-5 py-3">{healthBadge(c.health)}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={10} className="text-slate-600" />
                      {formatUptime(c.uptime_seconds ?? 0)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {(c.restart_count ?? 0) > 0 ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        (c.restart_count ?? 0) > 5 ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        <RotateCcw size={10} />
                        {c.restart_count}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list (shown only on mobile) */}
        <div className="md:hidden divide-y divide-white/[0.04]">
          {filteredContainers.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-slate-500 text-xs">
              No container data available
            </div>
          )}
          {loading && enrichedContainers.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500 text-xs">
              <RefreshCw size={14} className="inline animate-spin mr-2" />
              Loading health data...
            </div>
          )}
          {filteredContainers.map((c) => {
            const isExpanded = expandedRow === c.name
            return (
              <div
                key={c.name}
                className="px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedRow(isExpanded ? null : c.name)}
                  className="w-full flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${
                      c.health.toLowerCase() === 'healthy' ? 'bg-emerald-400'
                      : c.health.toLowerCase() === 'unhealthy' ? 'bg-rose-400'
                      : c.state.toLowerCase() === 'running' ? 'bg-cyan-400'
                      : 'bg-slate-500'
                    }`} />
                    <span className="font-mono text-xs text-slate-200 truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {stateBadge(c.state)}
                    {isExpanded ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="mt-2 pl-4 space-y-1.5 animate-fade-in">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Health</span>
                      {healthBadge(c.health)}
                    </div>
                    {c.image && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Image</span>
                        <span className="text-slate-400 font-mono truncate ml-2 max-w-[180px]">{c.image}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Uptime</span>
                      <span className="text-slate-400">{formatUptime(c.uptime_seconds ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Restarts</span>
                      <span className={`${(c.restart_count ?? 0) > 5 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {c.restart_count ?? 0}
                      </span>
                    </div>
                    {c.ports && c.ports !== '' && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Ports</span>
                        <span className="text-slate-400 font-mono truncate ml-2 max-w-[180px]">{c.ports}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
