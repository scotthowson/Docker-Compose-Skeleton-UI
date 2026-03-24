// =============================================================================
// HealthSummary — Unified health card: score gauge + status + containers
// =============================================================================

import React, { useState, useEffect } from 'react'
import {
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, CircleDot, Clock,
  Activity, HeartPulse, Cpu, MemoryStick, HardDrive, Timer,
} from 'lucide-react'
import { useHealthStore } from '../../stores/healthStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { fetchHealthScore } from '../../api/endpoints'
import type { HealthContainer, HealthScoreResponse } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Score gauge colors
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

// ---------------------------------------------------------------------------
// Health status config
// ---------------------------------------------------------------------------

const statusConfig = {
  healthy: {
    icon: ShieldCheck, label: 'Healthy',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    glow: 'glow-emerald',
  },
  degraded: {
    icon: ShieldAlert, label: 'Degraded',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    glow: 'glow-amber',
  },
  critical: {
    icon: ShieldX, label: 'Critical',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    glow: 'glow-rose',
  },
  unknown: {
    icon: ShieldQuestion, label: 'Unknown',
    badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    glow: '',
  },
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  if (seconds <= 0) return '--'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreGauge({ score, grade, loading }: { score: number; grade: string; loading: boolean }) {
  const size = 96
  const strokeWidth = 7
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
          <div className="w-6 h-6 rounded-full skeleton" />
        ) : (
          <>
            <span className="text-xl font-bold text-white leading-none">{score}</span>
            <span className={`text-[11px] font-semibold ${gradeColors[grade] || 'text-slate-400'}`}>{grade}</span>
          </>
        )}
      </div>
    </div>
  )
}

function FactorBar({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-500 w-[52px] shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] text-slate-400 w-6 text-right tabular-nums font-medium">{value}</span>
      {detail && <span className="text-[9px] text-slate-500 w-14 text-right truncate">{detail}</span>}
    </div>
  )
}

function SummaryBar({ healthy, unhealthy, stopped }: { healthy: number; unhealthy: number; stopped: number }) {
  const total = healthy + unhealthy + stopped
  if (total === 0) return null
  const healthyPct = (healthy / total) * 100
  const unhealthyPct = (unhealthy / total) * 100
  const stoppedPct = (stopped / total) * 100

  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800/60">
        {healthyPct > 0 && <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${healthyPct}%` }} title={`${healthy} healthy`} />}
        {unhealthyPct > 0 && <div className="bg-rose-500 transition-all duration-700" style={{ width: `${unhealthyPct}%` }} title={`${unhealthy} unhealthy`} />}
        {stoppedPct > 0 && <div className="bg-slate-600 transition-all duration-700" style={{ width: `${stoppedPct}%` }} title={`${stopped} stopped`} />}
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[10px]">
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="text-slate-500">{healthy} healthy</span></span>
        {unhealthy > 0 && <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" /><span className="text-slate-500">{unhealthy} unhealthy</span></span>}
        {stopped > 0 && <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-600" /><span className="text-slate-500">{stopped} stopped</span></span>}
      </div>
    </div>
  )
}

function ContainerRow({ container }: { container: HealthContainer }) {
  const isRunning = container.state === 'running'
  const isUnhealthy = container.health === 'unhealthy'
  const dotColor = isUnhealthy ? 'bg-rose-400' : isRunning ? 'bg-emerald-400' : 'bg-slate-500'

  return (
    <div className="flex items-center justify-between py-1 px-0.5 group">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor} shrink-0`} />
        <span className="text-[11px] text-slate-300 font-mono truncate">{container.name}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {container.health && container.health !== 'none' && (
          <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${
            container.health === 'healthy' ? 'bg-emerald-500/10 text-emerald-400'
              : container.health === 'unhealthy' ? 'bg-rose-500/10 text-rose-400'
              : 'bg-amber-500/10 text-amber-400'
          }`}>
            {container.health}
          </span>
        )}
        <span className={`text-[10px] ${isRunning ? 'text-slate-500' : 'text-slate-500'}`}>
          {container.state}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HealthSummary() {
  const report = useHealthStore((s) => s.report)
  const connectionStatus = useConnectionStore((s) => s.status)
  const isConnected = connectionStatus === 'connected'

  const [scoreData, setScoreData] = useState<HealthScoreResponse | null>(null)
  const [scoreLoading, setScoreLoading] = useState(true)

  useEffect(() => {
    if (!isConnected) return
    let mounted = true
    const load = async () => {
      try {
        const res = await fetchHealthScore()
        if (mounted) setScoreData(res)
      } catch { /* ignore */ }
      if (mounted) setScoreLoading(false)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [isConnected])

  // Skeleton
  if (!report && isConnected) {
    return (
      <div className="glass-card p-4 md:p-6 animate-pulse">
        <div className="h-4 w-32 rounded bg-slate-700/50 mb-4" />
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-slate-800/40 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded bg-slate-800/40" />
            <div className="h-3 rounded bg-slate-800/40 w-3/4" />
            <div className="h-3 rounded bg-slate-800/40 w-1/2" />
            <div className="h-3 rounded bg-slate-800/40 w-2/3" />
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-800/40" />
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-12 rounded-lg bg-slate-800/40" />)}
        </div>
        <div className="mt-4 space-y-1.5">
          {[1,2,3,4,5].map(i => <div key={i} className="h-5 rounded bg-slate-800/30" />)}
        </div>
      </div>
    )
  }

  const summary = report?.summary ?? { total: 0, healthy: 0, unhealthy: 0, stopped: 0 }
  const effectiveStatus: 'healthy' | 'degraded' | 'critical' | 'unknown' = (() => {
    if (!report) return 'unknown'
    if (summary.unhealthy >= 3) return 'critical'
    if (summary.unhealthy > 0) return 'degraded'
    return 'healthy'
  })()

  const config = statusConfig[effectiveStatus]
  const StatusIcon = config.icon
  const score = scoreData?.score ?? 0
  const grade = scoreData?.grade ?? getGrade(score)
  const factors = scoreData?.factors
  const containers = report?.containers ?? []
  const runningCount = containers.filter((c) => c.state === 'running').length

  return (
    <div className={`glass-card glass-hover gradient-border p-4 md:p-6 animate-fade-in flex flex-col ${config.glow}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Health</h3>
        </div>
        <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.badge}`}>
          <StatusIcon className="h-3 w-3" />
          <span className={effectiveStatus === 'healthy' ? 'neon-emerald' : ''}>{config.label}</span>
        </div>
      </div>

      {/* Score gauge + factors */}
      <div className="flex items-start gap-4">
        {/* Left: Gauge + grade */}
        <div className="flex flex-col items-center gap-1.5">
          <ScoreGauge score={score} grade={grade} loading={scoreLoading} />
          <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${gradeBg[grade] || 'bg-slate-500/10 border-slate-500/20'} ${gradeColors[grade] || 'text-slate-400'}`}>
            Grade {grade}
          </span>
        </div>

        {/* Right: Factors with detail callouts */}
        <div className="flex-1 min-w-0">
          {scoreLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-3.5 skeleton rounded" />)}
            </div>
          ) : factors ? (
            <div className="space-y-2">
              <FactorBar label="Stacks" value={factors.stacks.score} detail={`${factors.stacks.healthy}/${factors.stacks.total}`} />
              <FactorBar label="Resources" value={factors.resources.score} detail={`${factors.resources.cpu_pct}% cpu`} />
              <FactorBar label="Images" value={factors.images.score} detail={factors.images.stale > 0 ? `${factors.images.stale} stale` : 'fresh'} />
              <FactorBar label="Uptime" value={factors.uptime.score} detail={formatUptime(factors.uptime.seconds)} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Resource detail cards */}
      {factors && (
        <div className="grid grid-cols-4 gap-1.5 mt-3.5">
          <DetailCard icon={<Cpu size={11} />} label="CPU" value={`${factors.resources.cpu_pct}%`} color="text-amber-400" />
          <DetailCard icon={<MemoryStick size={11} />} label="Memory" value={`${factors.resources.mem_pct}%`} color="text-emerald-400" />
          <DetailCard icon={<HardDrive size={11} />} label="Images" value={`${factors.images.total - factors.images.stale}/${factors.images.total}`} color="text-cyan-400" />
          <DetailCard icon={<Timer size={11} />} label="Uptime" value={formatUptime(factors.uptime.seconds)} color="text-violet-400" />
        </div>
      )}

      {/* Distribution bar */}
      {report && (
        <div className="mt-3">
          <SummaryBar healthy={summary.healthy} unhealthy={summary.unhealthy} stopped={summary.stopped} />
        </div>
      )}

      {/* Container list — always visible, fills remaining height */}
      {containers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.03] flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Containers
            </span>
            <span className="text-[10px] text-slate-500 tabular-nums">
              {runningCount}/{containers.length} running
            </span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-0.5 max-h-[200px]">
            {/* Unhealthy first, then running, then stopped */}
            {containers
              .slice()
              .sort((a, b) => {
                const priority = (c: HealthContainer) =>
                  c.health === 'unhealthy' ? 0 : c.state === 'running' ? 1 : 2
                return priority(a) - priority(b)
              })
              .map((c) => <ContainerRow key={c.name} container={c} />)
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DetailCard — compact metric tile
// ---------------------------------------------------------------------------

function DetailCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-slate-800/40 px-2 py-2 border border-white/[0.03] text-center">
      <div className={`flex items-center justify-center gap-1 ${color} opacity-70 mb-0.5`}>
        {icon}
      </div>
      <p className={`text-xs font-semibold ${color}`}>{value}</p>
      <p className="text-[8px] text-slate-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatPill — compact inline stat (kept for potential reuse)
// ---------------------------------------------------------------------------

function StatPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-slate-800/40 px-2 py-1 border border-white/[0.03]">
      <span className={`${color} opacity-70`}>{icon}</span>
      <span className={`text-[11px] font-semibold ${color}`}>{value}</span>
      <span className="text-[9px] text-slate-500 uppercase">{label}</span>
    </div>
  )
}
