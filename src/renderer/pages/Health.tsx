// =============================================================================
// Health — container health monitoring with enriched data, a resource overview
// and a mobile-friendly layout
// =============================================================================

import React, { useState, useMemo } from 'react'
import {
  HeartPulse,
  Activity,
  AlertTriangle,
  XCircle,
  RefreshCw,
  WifiOff,
  Search,
  Download,
  Clock,
  RotateCcw,
  Box,
  Cpu,
  MemoryStick,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Layers,
  Gauge,
} from 'lucide-react'
import { Badge, SegmentedControl } from '@mantine/core'
import { usePolling } from '../hooks/usePolling'
import { useFleetScope } from '../hooks/useFleetScope'
import FleetScopeChips from '../components/fleet/FleetScopeChips'
import VmCapsule from '../components/fleet/VmCapsule'
import { fetchHealthReport, fetchContainers, fetchSystemMetrics, fetchHealthScore } from '../api/endpoints'
import { useStackCounts } from '../hooks/useStackCounts'
import { useHealthStore } from '../stores/healthStore'
import { useConnectionStore } from '../stores/connectionStore'
import type { HealthReport, HealthContainer, ContainerInfo, SystemMetricsResponse, HealthScoreResponse } from '../../shared/types'
import { useApiLink, sinceText, type ApiLinkState } from '../hooks/useApiLink'
import { OnDemandMissingBanner } from '../components/common/OnDemandMissingBanner'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import PageHeader from '../components/common/PageHeader'
import SortableTh from '../components/common/SortableTh'
import { EmptyState } from '../components/common/PageState'
import { Panel, StatTile, pctTone, TONE_FILL, TONE_TEXT, type Tone } from '../components/dashboard/cardShared'
import { BTN_TOOLBAR_QUIET } from '../lib/ui'

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
// Status indicator config — includes 'unknown' for disconnected / no data
// ---------------------------------------------------------------------------

type HealthStatus = HealthReport['status'] | 'unknown'
interface StatusLook { bg: string; ring: string; text: string; edge: string; label: string; Icon: React.ElementType }

const statusConfig: Record<HealthStatus, StatusLook> = {
  healthy: { bg: 'bg-emerald-500', ring: 'ring-emerald-500/30', text: 'text-emerald-400', edge: '', label: 'All systems healthy', Icon: HeartPulse },
  degraded: { bg: 'bg-amber-500', ring: 'ring-amber-500/30', text: 'text-amber-400', edge: 'border-amber-500/30', label: 'System degraded', Icon: AlertTriangle },
  critical: { bg: 'bg-rose-500', ring: 'ring-rose-500/30', text: 'text-rose-400', edge: 'border-rose-500/30', label: 'Critical issues detected', Icon: XCircle },
  unknown: { bg: 'bg-slate-500', ring: 'ring-slate-500/30', text: 'text-slate-400', edge: '', label: 'Unable to connect', Icon: WifiOff },
}

// The big indicator while the API does not answer: a health report is a fact about the moment it was taken,
// so the last "All systems healthy" must not stay on screen as if it were the present
const linkConfig: Record<Exclude<ApiLinkState, 'live'>, StatusLook> = {
  trouble: { bg: 'bg-amber-500', ring: 'ring-amber-500/30', text: 'text-amber-400', edge: 'border-amber-500/30', label: 'API not answering', Icon: HeartPulse },
  reconnecting: { bg: 'bg-rose-500', ring: 'ring-rose-500/30', text: 'text-rose-400', edge: 'border-rose-500/30', label: 'API reconnecting…', Icon: HeartPulse },
  offline: { bg: 'bg-rose-500', ring: 'ring-rose-500/30', text: 'text-rose-400', edge: 'border-rose-500/30', label: 'API not connected', Icon: WifiOff },
}

// ---------------------------------------------------------------------------
// Badges for a container's health and state: fine is emerald, unhealthy a problem,
// starting or restarting needs a look, stopped is neutral, "on demand" is Sablier's indigo
// ---------------------------------------------------------------------------

const ON_DEMAND_HINT = 'Stopped on purpose: Sablier starts it on the first request'

function healthBadge(health: string): React.ReactNode {
  const h = health.toLowerCase()
  if (h === 'healthy') return <Badge component="span" color="emerald">Healthy</Badge>
  if (h === 'unhealthy') return <Badge component="span" color="rose">Unhealthy</Badge>
  if (h === 'starting') return <Badge component="span" color="amber">Starting</Badge>
  if (h === 'sleeping') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300" title={ON_DEMAND_HINT}>
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden />
        Sleeping
      </span>
    )
  }
  return <Badge component="span" color="slate">{health || 'N/A'}</Badge>
}

function stateBadge(state: string, onDemand?: boolean): React.ReactNode {
  const s = state.toLowerCase()
  if (s === 'running') return <Badge component="span" color="emerald">Running</Badge>
  if ((s === 'exited' || s === 'stopped' || s === 'created') && onDemand) {
    return (
      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300" title={ON_DEMAND_HINT}>
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden />
        On demand
      </span>
    )
  }
  if (s === 'exited' || s === 'stopped') return <Badge component="span" color="slate">Stopped</Badge>
  if (s === 'restarting') return <Badge component="span" color="amber">Restarting</Badge>
  if (s === 'paused') return <Badge component="span" color="amber">Paused</Badge>
  if (s === 'dead') return <Badge component="span" color="rose">Dead</Badge>
  return <Badge component="span" color="slate">{state ? state.charAt(0).toUpperCase() + state.slice(1) : 'Unknown'}</Badge>
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
// Resource gauge: a number and its bar, amber from 75 %, rose from 90 %
// ---------------------------------------------------------------------------

function ResourceGauge({ label, value, icon: Icon, detail }: {
  label: string
  value: string
  icon: React.ElementType
  detail?: string
}) {
  // Parse percentage from value like "23%" or "23.5%"
  const pct = parseFloat(value) || 0
  const clampedPct = Math.min(100, Math.max(0, pct))
  const tone = pctTone(pct)
  return (
    <div className="glass-subtle p-3 md:p-4 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-slate-400" aria-hidden />
        <span className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl md:text-2xl font-bold tabular-nums ${tone === 'ok' ? 'text-slate-100' : TONE_TEXT[tone]}`}>{value}</p>
      <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clampedPct)}>
        <div className={`h-full rounded-full transition-all duration-500 ${TONE_FILL[tone]}`} style={{ width: `${clampedPct}%` }} />
      </div>
      {detail && <p className="text-[11px] text-slate-500 mt-1.5">{detail}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Health score — grade colors + gauge (consistent with the Dashboard's Health card)
// ---------------------------------------------------------------------------

const gradeColors: Record<string, string> = {
  A: 'text-emerald-400', B: 'text-cyan-400', C: 'text-amber-400', D: 'text-orange-400', F: 'text-rose-400',
}
const gradeStroke: Record<string, string> = {
  A: '#10b981', B: '#06b6d4', C: '#f59e0b', D: '#f97316', F: '#f43f5e',
}
const gradeBadge: Record<string, string> = { A: 'emerald', B: 'cyan', C: 'amber', D: 'orange', F: 'rose' }

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
    <div className="relative shrink-0" role="img" aria-label={loading ? 'Health score loading' : `Health score ${score} out of 100, grade ${grade}`}>
      <svg width={size} height={size} className="transform -rotate-90" aria-hidden>
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
      <span className="text-xs text-slate-500 w-[68px] shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-7 text-right tabular-nums font-medium">{value}</span>
      {detail && <span className="text-[11px] text-slate-500 w-24 text-right truncate hidden sm:block" title={detail}>{detail}</span>}
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

  // a hub: everywhere (the hub and every VM), the hub alone, or one VM — the choice the Images and Updates pages share
  const { scope, setScope, member: scopeMember, memberName, members: scopeMembers, hasFleet } = useFleetScope()
  const fetchScopedReport = React.useCallback(() => fetchHealthReport(scope), [scope])

  // Poll health report (the whole fleet is asked a little less often)
  const { data, loading, error, refresh } = usePolling<HealthReport>(fetchScopedReport, scope === 'all' ? 15000 : 5000, {
    enabled: isConnected,
  })
  const scopeRef = React.useRef(scope)
  React.useEffect(() => { if (scopeRef.current !== scope) { scopeRef.current = scope; refresh() } }, [scope, refresh])

  // Poll full container list for enriched data (image, uptime, restart count)
  const { data: containerData } = usePolling<{ containers: ContainerInfo[] }>(fetchContainers, 10000, {
    enabled: isConnected,
  })

  // Poll system metrics for resource overview
  const { data: metrics } = usePolling<SystemMetricsResponse>(fetchSystemMetrics, 10000, {
    enabled: isConnected,
  })

  // Poll health score for scoring + factor breakdown
  const fetchScopedScore = React.useCallback(() => fetchHealthScore(scope), [scope])
  // the stacks, so the page can say how many run where — the same numbers the dashboard shows
  const stackCounts = useStackCounts(scope)
  const { data: healthScoreData, loading: scoreLoading, refresh: refreshScore } = usePolling<HealthScoreResponse>(fetchScopedScore, 15000, {
    enabled: isConnected,
  })
  const scoreScopeRef = React.useRef(scope)
  React.useEffect(() => { if (scoreScopeRef.current !== scope) { scoreScopeRef.current = scope; refreshScore() } }, [scope, refreshScore])

  // Sync to store (one VM's report is not this server's: it stays on this page)
  React.useEffect(() => {
    if (data && !scopeMember) setReport(data)
  }, [data, setReport, scopeMember])

  // Also use the global store as fallback if the local poll hasn't returned yet
  const storeReport = useHealthStore((s) => s.report)
  const report = data ?? storeReport
  // NEVER default to 'healthy' — only the API can say we're healthy
  const status: HealthStatus = report?.status ?? 'unknown'
  // while the API does not answer the page says so, in place of the last verdict
  const link = useApiLink()
  const stale = !link.live
  const reconnect = useConnectionStore((s) => s.connect)
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (!stale) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [stale])
  // Docker itself not answering: every container is down (the API says critical) and this is the reason worth naming
  const dockerDown = !stale && report?.docker?.reachable === false
  const silentVms = !stale ? (report?.unreachable ?? 0) : 0
  const cfg = stale
    ? linkConfig[link.state as Exclude<ApiLinkState, 'live'>]
    : dockerDown
      ? { ...statusConfig.critical, label: 'Docker not answering', Icon: XCircle }
      : statusConfig[status]
  const StatusIcon = cfg.Icon
  const summary = report?.summary ?? { total: 0, healthy: 0, unhealthy: 0, stopped: 0 }
  // a VM's own report carries no member tag: the rows belong to the VM asked for
  const healthContainers: HealthContainer[] = useMemo(
    () => (report?.containers ?? []).map((c) => (c.member === undefined && scopeMember ? { ...c, member: scopeMember, member_name: memberName } : c)),
    [report, scopeMember, memberName],
  )
  const rowKey = (c: { member?: string | null; name: string }) => `${c.member ?? ''}|${c.name}`

  // Merge health data with container info (a hub's /containers already carries every VM's, tagged)
  const containerMap = useMemo(() => {
    const map = new Map<string, ContainerInfo>()
    if (containerData?.containers) {
      for (const c of containerData.containers) {
        map.set(rowKey(c as { member?: string | null; name: string }), c)
      }
    }
    return map
  }, [containerData])

  const enrichedContainers: EnrichedContainer[] = useMemo(() => {
    return healthContainers.map((hc) => {
      const info = containerMap.get(rowKey(hc))
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
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'unhealthy' | 'stopped' | 'ondemand'>('all')
  const [sortAsc, setSortAsc] = useState(true)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Filtered and sorted containers
  const filteredContainers = useMemo(() => {
    let result = enrichedContainers
    if (healthFilter === 'healthy') result = result.filter((c) => c.health.toLowerCase() === 'healthy')
    else if (healthFilter === 'unhealthy') result = result.filter((c) => c.health.toLowerCase() === 'unhealthy')
    else if (healthFilter === 'stopped') result = result.filter((c) => c.state.toLowerCase() !== 'running' && !c.on_demand)
    else if (healthFilter === 'ondemand') result = result.filter((c) => !!c.on_demand)
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
  const sleepingPct = ((summary.sleeping ?? 0) / total) * 100
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

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'unhealthy', label: 'Unhealthy' },
    { value: 'stopped', label: 'Stopped' },
    { value: 'ondemand', label: 'On demand' },
  ]
  const tileTone = (n: number, tone: Tone): Tone => (n > 0 ? tone : 'neutral')

  return (
    <div className="space-y-4 md:space-y-5 animate-fade-in">
      <DisconnectedBanner />
      <OnDemandMissingBanner />
      <PageHeader
        page="health"
        badge={scopeMember ? <VmCapsule member={scopeMember} name={memberName} vmid={scopeMembers.find((m) => m.id === scopeMember)?.vmid} /> : undefined}
        subtitle={scope === 'all'
          ? `Every container on the hub and its ${scopeMembers.length} VM${scopeMembers.length === 1 ? '' : 's'}, live`
          : scopeMember ? `The containers inside the VM ${memberName}, live` : undefined}
        actions={<>
          <button type="button" onClick={exportHealthReport} disabled={!report} aria-label="Export the report" className={BTN_TOOLBAR_QUIET}>
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh" className={BTN_TOOLBAR_QUIET}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </>}
      >
        {hasFleet && <FleetScopeChips scope={scope} members={scopeMembers} onChange={setScope} busy={loading && !!report} />}
      </PageHeader>

      {/* Error state */}
      {error && !stale && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-xs text-rose-300" role="alert">
          Could not load the health data: {error.message}
        </div>
      )}

      {/* Everywhere: how each DCS is doing */}
      {scope === 'all' && report?.members && report.members.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap">
          {report.members.map((mb) => {
            const dot = !mb.reachable ? 'bg-slate-600' : mb.status === 'critical' ? 'bg-rose-400' : mb.status === 'degraded' ? 'bg-amber-400' : 'bg-emerald-400'
            const label = !mb.reachable ? 'not answering' : mb.summary ? `${mb.summary.healthy}/${mb.summary.total} healthy${mb.summary.unhealthy ? ` · ${mb.summary.unhealthy} unhealthy` : ''}${mb.summary.stopped ? ` · ${mb.summary.stopped} stopped` : ''}` : mb.status
            return (
              <button
                key={mb.id ?? 'hub'}
                type="button"
                onClick={() => setScope(mb.id ?? 'hub')}
                title={mb.reachable ? `Only ${mb.id ? `the VM ${mb.name}` : 'the hub'}` : mb.error || 'not answering'}
                className={`inline-flex items-center gap-2 h-7 px-2.5 rounded-full border text-[11px] transition-colors shrink-0 whitespace-nowrap ${!mb.reachable ? 'border-white/[0.06] text-slate-500' : mb.status === 'critical' ? 'bg-rose-500/[0.06] border-rose-500/20 text-rose-200' : mb.status === 'degraded' ? 'bg-amber-500/[0.06] border-amber-500/20 text-amber-200' : 'bg-white/[0.03] border-white/[0.06] text-slate-300 hover:bg-white/[0.06]'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden />
                <span className="font-medium">{mb.id ? `VM${mb.vmid ? ` #${mb.vmid}` : ''} · ${mb.name}` : 'Hub'}</span>
                <span className="text-slate-500">{label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Status indicator + summary stats — side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Large status indicator */}
        <div className={`glass-card p-6 md:p-8 flex flex-col items-center justify-center gap-3 ${cfg.edge}`}>
          <div className="relative flex items-center justify-center">
            <span
              className={`absolute h-16 w-16 md:h-20 md:w-20 rounded-full ${cfg.bg} opacity-20 animate-ping`}
              style={{ animationDuration: stale && link.state === 'reconnecting' ? '1s' : '2s' }}
              aria-hidden
            />
            <span
              className={`relative flex items-center justify-center h-16 w-16 md:h-20 md:w-20 rounded-full ${cfg.bg}/20 ring-4 ${cfg.ring}`}
              aria-hidden
            >
              <StatusIcon size={28} className={`${cfg.text} md:hidden ${stale && link.state === 'reconnecting' ? 'animate-pulse' : ''}`} strokeWidth={2} />
              <StatusIcon size={36} className={`${cfg.text} hidden md:block ${stale && link.state === 'reconnecting' ? 'animate-pulse' : ''}`} strokeWidth={2} />
            </span>
          </div>
          <div className="text-center">
            <p className={`text-lg md:text-xl font-bold ${cfg.text}`} role="status">{cfg.label}</p>
            {stale ? (
              <>
                <p className="text-xs md:text-sm text-slate-400 mt-1">{link.detail}</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {report ? `${link.note}${link.lastConnected ? ` · answered ${sinceText(link.lastConnected)}` : ''}` : 'No report yet'}
                </p>
                {link.state === 'offline' && (
                  <button type="button" onClick={() => { void reconnect() }} className={`${BTN_TOOLBAR_QUIET} mt-3 mx-auto`}>
                    <RefreshCw size={14} /> Retry
                  </button>
                )}
              </>
            ) : dockerDown ? (
              <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-xs">
                {report?.docker?.error || 'Docker does not answer'} — every container on this server is down
              </p>
            ) : (
              <>
                <p className="text-xs md:text-sm text-slate-400 mt-1">
                  {summary.total} container{summary.total !== 1 ? 's' : ''} monitored
                </p>
                {silentVms > 0 && (
                  <p className="text-[11px] text-amber-300 mt-1">{silentVms} VM{silentVms === 1 ? '' : 's'} not answering</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Summary stats grid */}
        <div className={`lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3 transition-all duration-500 ${stale ? 'opacity-50 saturate-50' : ''}`}>
          <StatTile icon={Layers} label="Stacks" value={`${stackCounts.running}/${stackCounts.total}`} tone={stackCounts.running === stackCounts.total ? 'ok' : 'attention'} />
          <StatTile icon={HeartPulse} label="Healthy" value={summary.healthy} tone={tileTone(summary.healthy, 'ok')} />
          <StatTile icon={XCircle} label="Unhealthy" value={summary.unhealthy} tone={tileTone(summary.unhealthy, 'problem')} />
          <StatTile icon={Box} label="Stopped" value={summary.stopped} />
          {!!summary.sleeping && <StatTile icon={Box} label="On demand" value={summary.sleeping} />}
          <StatTile icon={RotateCcw} label="Restarting" value={restartingCount} tone={tileTone(restartingCount, 'attention')} />
          <StatTile icon={RefreshCw} label="Total restarts" value={totalRestarts} tone={totalRestarts > 10 ? 'attention' : 'neutral'} />
          <StatTile icon={Activity} label="Running" value={summary.total - summary.stopped - (summary.sleeping ?? 0)} tone="ok" />
        </div>
      </div>

      <div className={`space-y-4 md:space-y-5 transition-all duration-500 ${stale ? 'opacity-50 saturate-50' : ''}`}>
        {/* Health score — gauge + factor breakdown */}
        <Panel
          icon={HeartPulse}
          title="Health score"
          badge={!scoreLoading && healthScoreData ? <Badge component="span" color={gradeBadge[grade] ?? 'slate'}>Grade {grade}</Badge> : undefined}
        >
          <div className="flex items-start gap-5 md:gap-8">
            <div className="flex flex-col items-center gap-2">
              <ScoreGauge score={score} grade={grade} loading={scoreLoading && !healthScoreData} />
            </div>

            <div className="flex-1 min-w-0 pt-2">
              {scoreLoading && !healthScoreData ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-4" />)}
                </div>
              ) : factors ? (
                <div className="space-y-3">
                  <ScoreFactorBar label="Containers" value={factors.stacks.score} detail={`${factors.stacks.healthy}/${factors.stacks.total} healthy${scope === 'all' ? ' · whole fleet' : ''}`} />
                  <ScoreFactorBar label="Resources" value={factors.resources.score} detail={`${factors.resources.cpu_pct}% cpu`} />
                  <ScoreFactorBar label="Images" value={factors.images.score} detail={factors.images.stale > 0 ? `${factors.images.stale} stale` : 'fresh'} />
                  <ScoreFactorBar label="Uptime" value={factors.uptime.score} detail={formatUptime(factors.uptime.seconds)} />
                </div>
              ) : (
                <p className="text-xs text-slate-500">Health scoring data is not available yet.</p>
              )}
            </div>
          </div>

          {/* Per-stack scores */}
          {healthScoreData?.stacks && healthScoreData.stacks.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2.5">Stack scores</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {healthScoreData.stacks.map((stack) => {
                  const sg = stack.grade || getGrade(stack.score)
                  return (
                    <div key={`${stack.member ?? ''}|${stack.stack}`} className="rounded-lg bg-white/[0.03] px-3 py-2 border border-white/5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] text-slate-300 font-mono truncate flex items-center gap-1.5 min-w-0"><span className="truncate">{stack.stack}</span>{scope === 'all' && <VmCapsule member={stack.member} name={stack.member_name} vmid={stack.vmid} size="xs" onClick={() => setScope(stack.member ?? 'hub')} />}</span>
                        <span className={`text-[11px] font-semibold ${gradeColors[sg] || 'text-slate-400'}`}>{sg}</span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${stack.score >= 80 ? 'bg-emerald-500' : stack.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${stack.score}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 tabular-nums">{stack.score}/100</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Panel>

        {/* Resource overview — CPU / Memory / Disk from system metrics */}
        {metrics && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ResourceGauge
              label="CPU load"
              value={metrics.cpu ? `${(metrics.cpu.load_average[0] / metrics.cpu.count * 100).toFixed(0)}%` : '0%'}
              icon={Cpu}
              detail={`${metrics.cpu?.count ?? '?'} cores — load ${metrics.cpu?.load_average[0].toFixed(1) ?? '?'}`}
            />
            <ResourceGauge
              label="Memory"
              value={metrics.memory ? `${((metrics.memory.used_mb / metrics.memory.total_mb) * 100).toFixed(0)}%` : '0%'}
              icon={MemoryStick}
              detail={metrics.memory ? `${(metrics.memory.used_mb / 1024).toFixed(1)}G / ${(metrics.memory.total_mb / 1024).toFixed(1)}G` : undefined}
            />
            <ResourceGauge
              label="Disk"
              value={metrics.disks?.[0]?.percent ?? '0%'}
              icon={HardDrive}
              detail={metrics.disks?.[0] ? `${metrics.disks[0].used} / ${metrics.disks[0].total}` : undefined}
            />
          </div>
        )}

        {/* Visual health bar */}
        {summary.total > 0 && (
          <Panel icon={Gauge} title="Health distribution">
            <div className="flex h-3 md:h-4 rounded-full overflow-hidden bg-slate-800">
              {healthyPct > 0 && <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${healthyPct}%` }} title={`Healthy: ${summary.healthy}`} />}
              {unhealthyPct > 0 && <div className="bg-rose-500 transition-all duration-500" style={{ width: `${unhealthyPct}%` }} title={`Unhealthy: ${summary.unhealthy}`} />}
              {stoppedPct > 0 && <div className="bg-slate-600 transition-all duration-500" style={{ width: `${stoppedPct}%` }} title={`Stopped: ${summary.stopped}`} />}
              {sleepingPct > 0 && <div className="bg-indigo-400/70 transition-all duration-500" style={{ width: `${sleepingPct}%` }} title={`Sleeping: ${summary.sleeping}`} />}
            </div>
            <div className="flex flex-wrap items-center gap-3 md:gap-6 mt-3 text-[11px] md:text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-emerald-500" aria-hidden /> Healthy ({summary.healthy})</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-rose-500" aria-hidden /> Unhealthy ({summary.unhealthy})</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-slate-600" aria-hidden /> Stopped ({summary.stopped})</span>
              {!!summary.sleeping && <span className="flex items-center gap-1.5" title={ON_DEMAND_HINT}><span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-indigo-400" aria-hidden /> Sleeping ({summary.sleeping})</span>}
            </div>
          </Panel>
        )}

        {/* Container health table */}
        <Panel
          flush
          icon={Activity}
          title="Container health"
          meta={`${filteredContainers.length}${filteredContainers.length !== enrichedContainers.length ? ` / ${enrichedContainers.length}` : ''}`}
        >
          <div className="px-4 py-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="max-w-full overflow-x-auto scrollbar-none">
              <SegmentedControl
                aria-label="Filter the containers"
                value={healthFilter}
                onChange={(v) => setHealthFilter(v as typeof healthFilter)}
                data={filterOptions}
              />
            </div>
            <div className="relative flex-1 min-w-0 sm:max-w-xs sm:ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                type="text"
                aria-label="Search the containers"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, image or state…"
                className="w-full pl-9 pr-3 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30 transition-all"
              />
            </div>
          </div>

          {/* Desktop table (hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <SortableTh label="Container" active direction={sortAsc ? 'asc' : 'desc'} onSort={() => setSortAsc(!sortAsc)} />
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Image</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">State</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Health</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Uptime</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Restarts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading && enrichedContainers.length === 0 ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i}><td colSpan={6} className="px-3 py-1.5"><div className="skeleton h-10" role="status" aria-label="Loading the containers" /></td></tr>
                  ))
                ) : filteredContainers.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState compact icon={<Box size={28} />} title={searchQuery || healthFilter !== 'all' ? 'No container matches' : 'No containers found'} hint={searchQuery || healthFilter !== 'all' ? 'Try another search or filter.' : 'Start a stack and its containers appear here.'} />
                    </td>
                  </tr>
                ) : filteredContainers.map((c) => (
                  <tr
                    key={rowKey(c)}
                    className={`hover:bg-white/[0.03] transition-colors duration-150 ${c.health.toLowerCase() === 'unhealthy' ? 'bg-rose-500/[0.04]' : ''}`}
                  >
                    <td className="px-3 py-3 font-mono text-slate-200 text-xs max-w-[260px]" title={c.name}>
                      <span className="inline-flex items-center gap-2 max-w-full">
                        <span className="truncate">{c.name}</span>
                        {scope === 'all' && <VmCapsule member={c.member} name={c.member_name} vmid={c.vmid} size="xs" onClick={() => setScope(c.member ?? 'hub')} />}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400 max-w-[200px] truncate font-mono" title={c.image}>
                      {c.image ? c.image.split(':')[0].split('/').pop() : '--'}
                      {c.image?.includes(':') && (
                        <span className="text-slate-500">:{c.image.split(':').pop()}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{stateBadge(c.state, c.on_demand)}</td>
                    <td className="px-3 py-3">{healthBadge(c.health)}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} className="text-slate-500" aria-hidden />
                        {formatUptime(c.uptime_seconds ?? 0)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {(c.restart_count ?? 0) > 0 ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${(c.restart_count ?? 0) > 5 ? 'text-amber-400' : 'text-slate-400'}`}>
                          <RotateCcw size={10} aria-hidden />
                          {c.restart_count}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list (shown only on mobile) */}
          <div className="md:hidden divide-y divide-white/[0.03]">
            {loading && enrichedContainers.length === 0 ? (
              <div className="p-4 space-y-2" role="status" aria-label="Loading the containers">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton h-12" />)}
              </div>
            ) : filteredContainers.length === 0 ? (
              <EmptyState compact icon={<Box size={28} />} title={searchQuery || healthFilter !== 'all' ? 'No container matches' : 'No containers found'} hint={searchQuery || healthFilter !== 'all' ? 'Try another search or filter.' : 'Start a stack and its containers appear here.'} />
            ) : filteredContainers.map((c) => {
              const isExpanded = expandedRow === rowKey(c)
              return (
                <div key={rowKey(c)} className={`px-4 py-3 hover:bg-white/[0.03] transition-colors ${c.health.toLowerCase() === 'unhealthy' ? 'bg-rose-500/[0.04]' : ''}`}>
                  {scope === 'all' && <div className="mb-1"><VmCapsule member={c.member} name={c.member_name} vmid={c.vmid} size="xs" /></div>}
                  <button
                    type="button"
                    onClick={() => setExpandedRow(isExpanded ? null : rowKey(c))}
                    aria-expanded={isExpanded}
                    className="w-full flex items-center justify-between gap-2 min-h-8"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${
                        c.health.toLowerCase() === 'healthy' ? 'bg-emerald-400'
                        : c.health.toLowerCase() === 'unhealthy' ? 'bg-rose-400'
                        : c.state.toLowerCase() === 'running' ? 'bg-emerald-400/60'
                        : 'bg-slate-500'
                      }`} aria-hidden />
                      <span className="font-mono text-xs text-slate-200 truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {stateBadge(c.state, c.on_demand)}
                      {isExpanded ? <ChevronUp size={14} className="text-slate-500" aria-hidden /> : <ChevronDown size={14} className="text-slate-500" aria-hidden />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 pl-4 space-y-1.5 animate-fade-in">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Health</span>
                        {healthBadge(c.health)}
                      </div>
                      {c.image && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Image</span>
                          <span className="text-slate-400 font-mono truncate ml-2 max-w-[180px]">{c.image}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Uptime</span>
                        <span className="text-slate-400">{formatUptime(c.uptime_seconds ?? 0)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Restarts</span>
                        <span className={`${(c.restart_count ?? 0) > 5 ? 'text-amber-400' : 'text-slate-400'}`}>{c.restart_count ?? 0}</span>
                      </div>
                      {c.ports && c.ports !== '' && (
                        <div className="flex items-center justify-between text-[11px]">
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
        </Panel>
      </div>
    </div>
  )
}
