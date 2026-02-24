// =============================================================================
// HealthSummary — Detailed health overview panel for the Dashboard
// =============================================================================

import React from 'react'
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, CircleDot, Clock, RotateCw, Activity } from 'lucide-react'
import { useHealthStore } from '../../stores/healthStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { HealthContainer } from '../../../shared/types'

const statusConfig = {
  healthy: {
    icon: ShieldCheck,
    label: 'All Systems Healthy',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    iconColor: 'text-emerald-400',
    glow: 'glow-emerald',
    description: 'All containers are running and responding normally.',
  },
  degraded: {
    icon: ShieldAlert,
    label: 'System Degraded',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    iconColor: 'text-amber-400',
    glow: 'glow-amber',
    description: 'Some containers are reporting issues or not responding.',
  },
  critical: {
    icon: ShieldX,
    label: 'System Critical',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    iconColor: 'text-rose-400',
    glow: 'glow-rose',
    description: 'Multiple containers are down or unhealthy. Immediate attention required.',
  },
  unknown: {
    icon: ShieldQuestion,
    label: 'Unavailable',
    badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    iconColor: 'text-slate-500',
    glow: '',
    description: 'Health data is not available. Connect to the API server.',
  },
} as const

function SummaryBar({ healthy, unhealthy, stopped }: { healthy: number; unhealthy: number; stopped: number }) {
  const total = healthy + unhealthy + stopped
  if (total === 0) return null

  const healthyPct = (healthy / total) * 100
  const unhealthyPct = (unhealthy / total) * 100
  const stoppedPct = (stopped / total) * 100

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider">
        <span>Health Distribution</span>
        <span>{total} total</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800/60">
        {healthyPct > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-700 ease-out"
            style={{ width: `${healthyPct}%` }}
            title={`${healthy} healthy (${healthyPct.toFixed(1)}%)`}
          />
        )}
        {unhealthyPct > 0 && (
          <div
            className="bg-rose-500 transition-all duration-700 ease-out"
            style={{ width: `${unhealthyPct}%` }}
            title={`${unhealthy} unhealthy (${unhealthyPct.toFixed(1)}%)`}
          />
        )}
        {stoppedPct > 0 && (
          <div
            className="bg-slate-600 transition-all duration-700 ease-out"
            style={{ width: `${stoppedPct}%` }}
            title={`${stopped} stopped (${stoppedPct.toFixed(1)}%)`}
          />
        )}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-slate-400">Healthy ({healthy})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
          <span className="text-slate-400">Unhealthy ({unhealthy})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-slate-600" />
          <span className="text-slate-400">Stopped ({stopped})</span>
        </span>
      </div>
    </div>
  )
}

function StatBadge({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-800/40 px-3 py-2 border border-white/[0.03]">
      <span className={`${color} opacity-70`}>{icon}</span>
      <div className="flex flex-col">
        <span className={`text-sm font-bold ${color}`}>{value}</span>
        <span className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
    </div>
  )
}

function ContainerIssueRow({ container }: { container: HealthContainer }) {
  const isUnhealthy = container.health === 'unhealthy' || container.state !== 'running'
  const stateColor = container.state === 'running'
    ? 'text-emerald-400'
    : container.state === 'exited'
      ? 'text-slate-400'
      : 'text-rose-400'

  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 border border-white/[0.03] hover:border-white/[0.06] transition-colors">
      <div className="flex items-center gap-2">
        <CircleDot className={`h-3.5 w-3.5 ${isUnhealthy ? 'text-rose-400' : 'text-slate-400'}`} />
        <span className="text-xs font-medium text-slate-200 font-mono">{container.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-medium ${stateColor}`}>
          {container.state}
        </span>
        {container.health && container.health !== 'none' && (
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
            container.health === 'healthy'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-rose-500/10 text-rose-400'
          }`}>
            {container.health}
          </span>
        )}
      </div>
    </div>
  )
}

export default function HealthSummary() {
  const report = useHealthStore((s) => s.report)
  const connectionStatus = useConnectionStore((s) => s.status)

  // Show skeleton while connected but no data has arrived yet
  if (!report && connectionStatus === 'connected') {
    return (
      <div className="glass-card p-4 md:p-6 animate-pulse">
        <div className="h-5 w-40 rounded bg-slate-700/50 mb-4" />
        <div className="h-16 rounded-lg bg-slate-800/40" />
        <div className="mt-4 h-2.5 rounded-full bg-slate-800/60" />
        <div className="mt-4 space-y-2">
          <div className="h-8 rounded-lg bg-slate-800/40" />
          <div className="h-8 rounded-lg bg-slate-800/40" />
        </div>
      </div>
    )
  }

  const isDisconnected = !report && connectionStatus !== 'connected'

  const summary = report?.summary ?? { total: 0, healthy: 0, unhealthy: 0, stopped: 0 }

  // Smart status override: stopped containers are normal/expected and shouldn't trigger alerts.
  // Only containers that are actually "unhealthy" (failed healthcheck) matter for health status.
  const effectiveStatus: 'healthy' | 'degraded' | 'critical' | 'unknown' = (() => {
    if (!report) return 'unknown'
    if (summary.unhealthy >= 3) return 'critical'
    if (summary.unhealthy > 0) return 'degraded'
    return 'healthy'
  })()

  const config = statusConfig[effectiveStatus]
  const StatusIcon = config.icon

  // Only show containers with real health issues (actually unhealthy via healthcheck)
  // Stopped containers appear separately — they're not "issues" unless they crashed
  const unhealthyContainers = (report?.containers ?? []).filter(
    (c) => c.health === 'unhealthy',
  )
  const stoppedContainers = (report?.containers ?? []).filter(
    (c) => c.state !== 'running' && c.health !== 'unhealthy',
  )

  // Count containers by state
  const runningCount = (report?.containers ?? []).filter((c) => c.state === 'running').length

  return (
    <div className={`glass-card p-4 md:p-6 animate-fade-in ${config.glow}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Health Overview
        </h3>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${config.badge}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {config.label}
        </div>
      </div>

      {/* Large status icon + description */}
      <div className="mt-5 flex items-center gap-4">
        <div className={`rounded-xl bg-slate-800/50 p-3.5 ${config.iconColor} border border-white/[0.03]`}>
          <StatusIcon className="h-9 w-9" />
        </div>
        <div className="flex-1">
          {isDisconnected ? (
            <>
              <p className="text-lg font-bold text-slate-300">No Health Data</p>
              <p className="text-sm text-slate-500">API server is not reachable</p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-white">
                {summary.unhealthy > 0 ? (
                  <>{summary.unhealthy} <span className="text-sm font-normal text-rose-400">unhealthy container{summary.unhealthy !== 1 ? 's' : ''} detected</span></>
                ) : (
                  <>{runningCount} <span className="text-sm font-normal text-slate-400">of</span>{' '}
                  {runningCount} <span className="text-sm font-normal text-slate-400">running containers healthy</span></>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {summary.stopped > 0 && summary.unhealthy === 0
                  ? `${summary.stopped} container${summary.stopped !== 1 ? 's' : ''} stopped — all running containers are healthy.`
                  : config.description}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Stats badges */}
      {report && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          <StatBadge
            icon={<Activity size={12} />}
            label="Running"
            value={runningCount}
            color="text-emerald-400"
          />
          <StatBadge
            icon={<ShieldCheck size={12} />}
            label="Healthy"
            value={summary.healthy}
            color="text-emerald-400"
          />
          <StatBadge
            icon={<ShieldX size={12} />}
            label="Unhealthy"
            value={summary.unhealthy}
            color={summary.unhealthy > 0 ? 'text-rose-400' : 'text-slate-500'}
          />
          <StatBadge
            icon={<Clock size={12} />}
            label="Stopped"
            value={summary.stopped}
            color={summary.stopped > 0 ? 'text-amber-400' : 'text-slate-500'}
          />
        </div>
      )}

      {/* Stacked bar */}
      <SummaryBar
        healthy={summary.healthy}
        unhealthy={summary.unhealthy}
        stopped={summary.stopped}
      />

      {/* Unhealthy containers — real issues */}
      {unhealthyContainers.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-rose-500">
            Unhealthy Containers
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
            {unhealthyContainers.map((container) => (
              <ContainerIssueRow key={container.name} container={container} />
            ))}
          </div>
        </div>
      )}

      {/* Stopped containers — informational, not critical */}
      {stoppedContainers.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Stopped Containers
          </p>
          <div className="space-y-1.5 max-h-28 overflow-y-auto scrollbar-thin">
            {stoppedContainers.map((container) => (
              <ContainerIssueRow key={container.name} container={container} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
