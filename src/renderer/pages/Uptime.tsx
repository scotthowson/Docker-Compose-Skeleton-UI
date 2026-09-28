// =============================================================================
// Uptime — Container availability monitor with timeline bars and incident log
// =============================================================================

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Clock,
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowUp,
  Timer,
  Server,
  ChevronRight,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useFleetScope } from '../hooks/useFleetScope'
import { fetchContainersScoped, scopeContainerRows, fetchHealthScoped, fetchEventsScoped, rowKey } from '../api/fleetScoped'
import { useConnectionStore } from '../stores/connectionStore'
import type { ContainerInfo, HealthReport, EventEntry, EventsResponse, FleetHealthMember } from '../../shared/types'
import type { FleetContainerListResponse, ScopeMemberTag } from '../../shared/fleetScoped'
import FleetScopeChips from '../components/fleet/FleetScopeChips'
import VmCapsule from '../components/fleet/VmCapsule'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { OnDemandMissingBanner } from '../components/common/OnDemandMissingBanner'
import { LoadingState, EmptyState } from '../components/common/PageState'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEGMENT_COUNT = 30
const COLORS = {
  running: '#10b981',
  stopped: '#ef4444',
  unknown: '#334155',
} as const

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function calculateAvailability(container: ContainerInfo): number {
  // An on-demand container is available: Sablier starts it on the first request
  if (container.state !== 'running') return container.on_demand ? 100 : 0
  if (container.restart_count === 0) return 100
  // Assume each restart caused ~30s downtime
  const estimatedDowntime = container.restart_count * 30
  const totalTime = container.uptime_seconds + estimatedDowntime
  return totalTime > 0 ? Math.round((container.uptime_seconds / totalTime) * 10000) / 100 : 100
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return 'Offline'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatAverageUptime(seconds: number): string {
  if (seconds <= 0) return '0m'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${Math.floor(seconds)}s`
}

function truncateImage(image: string, maxLen = 30): string {
  if (image.length <= maxLen) return image
  // Try to show the meaningful part (after last /)
  const parts = image.split('/')
  const last = parts[parts.length - 1]
  if (last.length <= maxLen) return last
  return last.slice(0, maxLen - 3) + '...'
}

function availabilityColor(pct: number): string {
  if (pct >= 100) return 'text-emerald-400'
  if (pct >= 95) return 'text-amber-400'
  return 'text-rose-400'
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() / 1000) - ts)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ---------------------------------------------------------------------------
// Segment builder — creates the 30-segment uptime bar per container
// ---------------------------------------------------------------------------

interface Segment {
  status: 'running' | 'stopped' | 'unknown'
  label: string
}

function buildSegments(
  container: ContainerInfo,
  events: EventEntry[],
): Segment[] {
  const segments: Segment[] = []
  const now = Date.now() / 1000
  const currentlyRunning = container.state === 'running'

  // Filter events for this container
  const containerEvents = events
    .filter((e) => e.name === container.name)
    .sort((a, b) => a.timestamp - b.timestamp)

  // Time window: last ~30 minutes (each segment = 1 min)
  const windowSec = SEGMENT_COUNT * 60
  const startTime = now - windowSec

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const segStart = startTime + i * 60
    const segEnd = segStart + 60
    const segMidLabel = new Date(segStart * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })

    // Check if any events fell in this segment
    const segEvents = containerEvents.filter(
      (e) => e.timestamp >= segStart && e.timestamp < segEnd,
    )

    if (segEvents.length > 0) {
      // If there's a stop/die event, mark as stopped
      const hasStop = segEvents.some(
        (e) => e.action === 'stop' || e.action === 'die' || e.action === 'kill',
      )
      const hasStart = segEvents.some(
        (e) => e.action === 'start' || e.action === 'restart',
      )
      if (hasStop && !hasStart) {
        segments.push({ status: 'stopped', label: `${segMidLabel} - Stopped` })
      } else if (hasStart) {
        segments.push({ status: 'running', label: `${segMidLabel} - Started` })
      } else {
        segments.push({
          status: currentlyRunning ? 'running' : 'stopped',
          label: `${segMidLabel} - Event: ${segEvents[0].action}`,
        })
      }
    } else {
      // No events in this window — infer from uptime
      const uptimeStart = now - container.uptime_seconds
      if (currentlyRunning && segEnd >= uptimeStart) {
        segments.push({ status: 'running', label: `${segMidLabel} - Running` })
      } else if (currentlyRunning && segEnd < uptimeStart) {
        // Before the container started — check restart_count to decide
        if (container.restart_count > 0) {
          // Distribute estimated downtime segments
          const estimatedDowntimeSegments = Math.min(
            container.restart_count,
            SEGMENT_COUNT - i,
          )
          const downSegmentIdx = Math.floor(
            (SEGMENT_COUNT - i) / (estimatedDowntimeSegments + 1),
          )
          if (downSegmentIdx > 0 && i % downSegmentIdx === 0 && i < SEGMENT_COUNT / 2) {
            segments.push({ status: 'stopped', label: `${segMidLabel} - Restart downtime` })
          } else {
            segments.push({ status: 'unknown', label: `${segMidLabel} - No data` })
          }
        } else {
          segments.push({ status: 'unknown', label: `${segMidLabel} - No data` })
        }
      } else {
        // Container is stopped
        segments.push({ status: 'stopped', label: `${segMidLabel} - Offline` })
      }
    }
  }

  return segments
}

// ---------------------------------------------------------------------------
// Tooltip component
// ---------------------------------------------------------------------------

function SegmentTooltip({ text, status, x, y }: { text: string; status: Segment['status']; x: number; y: number }) {
  // Rendered on document.body: the timeline cards animate in with a transform,
  // and a fixed tooltip inside one would be positioned against the card
  const tone = status === 'running' ? 'text-emerald-300' : status === 'stopped' ? 'text-rose-300' : 'text-slate-400'
  const label = status === 'running' ? 'running' : status === 'stopped' ? 'stopped' : 'no data'
  return createPortal(
    <div
      className="uptime-tip fixed z-[9999] px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-[11px] text-slate-200 shadow-xl shadow-black/40 pointer-events-none whitespace-nowrap"
      style={{ left: x, top: y + 8, transform: 'translateX(-50%)' }}
    >
      <span className="font-mono">{text.split(' - ')[0]}</span>
      <span className="text-slate-600"> · </span>
      <span className={tone}>{label}</span>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// UptimeBar — individual container timeline bar
// ---------------------------------------------------------------------------

function UptimeBar({ segments }: { segments: Segment[] }) {
  const [tooltip, setTooltip] = useState<{ text: string; status: Segment['status']; x: number; y: number } | null>(null)

  return (
    <>
      <div className="uptime-bar flex gap-[2px] h-7 items-center">
        {segments.map((seg, i) => {
          const live = i === segments.length - 1 && seg.status === 'running'
          return (
          <div
            key={`${seg.status}-${i}`}
            className={`uptime-seg flex-1 h-full rounded-[3px] transition-all duration-300 ease-out hover:scale-y-125 hover:brightness-125 cursor-default ${seg.status === 'running' ? 'uptime-seg-up' : ''} ${live ? 'uptime-seg-live' : ''}`}
            style={{ backgroundColor: COLORS[seg.status], animationDelay: `${i * 18}ms` }}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              setTooltip({ text: seg.label, status: seg.status, x: rect.left + rect.width / 2, y: rect.bottom })
            }}
            onMouseLeave={() => setTooltip(null)}
          />
          )
        })}
      </div>
      {tooltip && <SegmentTooltip text={tooltip.text} status={tooltip.status} x={tooltip.x} y={tooltip.y} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ state, health, onDemand }: { state: string; health: string; onDemand?: boolean }) {
  const s = state.toLowerCase()
  const h = health.toLowerCase()

  if (s !== 'running' && onDemand) {
    return (
      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-[10px] font-semibold text-indigo-300" title="Stopped on purpose: Sablier starts it on the first request">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
        On demand
      </span>
    )
  }

  if (s === 'running' && h === 'healthy') {
    return (
      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-[10px] font-semibold text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Healthy
      </span>
    )
  }
  if (s === 'running' && h === 'unhealthy') {
    return (
      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-[10px] font-semibold text-rose-400">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        Unhealthy
      </span>
    )
  }
  if (s === 'running') {
    return (
      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-[10px] font-semibold text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Running
      </span>
    )
  }
  if (s === 'restarting') {
    return (
      <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-[10px] font-semibold text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Restarting
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/15 text-[10px] font-semibold text-slate-400">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
      Stopped
    </span>
  )
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delay,
  neon,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
  delay: number
  neon?: string
}) {
  return (
    <div
      className="bg-slate-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-xl p-5 animate-fade-in-up hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all duration-300"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className={`text-lg md:text-2xl font-bold tabular-nums ${color} ${neon ?? ''}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Uptime() {
  const connectionStatus = useConnectionStore((s) => s.status)
  const isConnected = connectionStatus === 'connected'

  // a hub: everywhere (the hub and every VM), the hub alone, or one VM — the choice every fleet-aware page shares
  const { scope, setScope, member: scopeMember, memberName, members: scopeMembers, hasFleet } = useFleetScope()
  const vmTag = useMemo<ScopeMemberTag | null>(
    () => (scopeMember ? { id: scopeMember, name: memberName, vmid: scopeMembers.find((m) => m.id === scopeMember)?.vmid ?? null } : null),
    [scopeMember, memberName, scopeMembers],
  )

  // Fetch data via polling. Everywhere: a hub's own container list already
  // carries every VM's rows, and the health report and the events are asked
  // for the whole fleet in one answer (the hub asks every VM in parallel and
  // says which did not answer); a VM is asked through the hub's proxy. Each
  // answer is tagged with the scope it was asked for, so a switch never shows
  // the old rows under the new label.
  const fetchScopedContainers = useCallback(async () => ({ scope, res: await fetchContainersScoped(scope) }), [scope])
  const fetchScopedHealth = useCallback(async () => ({ scope, res: await fetchHealthScoped(scope) }), [scope])
  const fetchScopedEvents = useCallback(async () => ({ scope, res: await fetchEventsScoped(scope) }), [scope])
  const fleetWide = scope === 'all'

  const {
    data: containerTagged,
    loading: containersLoading,
    error: containersError,
    refresh: refreshContainers,
  } = usePolling<{ scope: string; res: FleetContainerListResponse }>(fetchScopedContainers, fleetWide ? 15000 : 10000, { enabled: isConnected })

  const {
    data: healthTagged,
    loading: healthLoading,
    refresh: refreshHealth,
  } = usePolling<{ scope: string; res: HealthReport }>(fetchScopedHealth, fleetWide ? 15000 : 10000, { enabled: isConnected })

  const {
    data: eventsTagged,
    loading: eventsLoading,
    refresh: refreshEvents,
  } = usePolling<{ scope: string; res: EventsResponse }>(fetchScopedEvents, fleetWide ? 20000 : 15000, { enabled: isConnected })

  const containerData = containerTagged && containerTagged.scope === scope ? containerTagged.res : null
  const healthData = healthTagged && healthTagged.scope === scope ? healthTagged.res : null
  const eventsData = eventsTagged && eventsTagged.scope === scope ? eventsTagged.res : null

  const loading = containersLoading || healthLoading || eventsLoading || !containerData
  const containers: ContainerInfo[] = useMemo(
    () => scopeContainerRows(scope, containerData?.containers ?? [], vmTag),
    [scope, containerData, vmTag],
  )
  const events: EventEntry[] = eventsData?.events ?? []
  // Everywhere: how each DCS answered (a VM that did not answer is shown as such)
  const fleetMembers: FleetHealthMember[] | undefined = fleetWide ? healthData?.members : undefined

  const refresh = useCallback(() => {
    refreshContainers()
    refreshHealth()
    refreshEvents()
  }, [refreshContainers, refreshHealth, refreshEvents])
  const scopeRef = useRef(scope)
  useEffect(() => { if (scopeRef.current !== scope) { scopeRef.current = scope; refresh() } }, [scope, refresh])

  // Listen for global refresh
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('app-refresh', handler)
    return () => window.removeEventListener('app-refresh', handler)
  }, [refresh])

  // An event belongs to the server it is tagged with (the fleet view); a VM's own list carries no tag
  const eventsFor = useCallback((c: ContainerInfo): EventEntry[] => {
    const owner = c.member ?? null
    return events.filter((e) => e.name === c.name && (e.member ?? scopeMember ?? null) === owner)
  }, [events, scopeMember])

  // ---------------------------------------------------------------------------
  // Computed stats
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => {
    const total = containers.length
    const running = containers.filter((c) => c.state === 'running').length
    const overallAvailability = total > 0 ? Math.round((running / total) * 10000) / 100 : 0
    const healthyInRows = containers.filter(
      (c) => c.state === 'running' && (c.health === 'healthy' || c.health === '' || c.health === 'none'),
    ).length
    // the report's own count covers exactly this scope for the fleet and for a VM; a hub's plain report is read from the rows
    const healthyCount = scope === 'hub' ? healthyInRows : (healthData?.summary?.healthy ?? healthyInRows)
    const avgUptimeSec = total > 0
      ? containers.reduce((sum, c) => sum + c.uptime_seconds, 0) / total
      : 0
    const totalRestarts = containers.reduce((sum, c) => sum + c.restart_count, 0)

    return { total, running, overallAvailability, healthyCount, avgUptimeSec, totalRestarts }
  }, [containers, healthData, scope])

  // Build segments map (rows keyed by server and name: two servers may each run a container of the same name)
  const segmentsMap = useMemo(() => {
    const map = new Map<string, Segment[]>()
    for (const c of containers) {
      map.set(rowKey(c), buildSegments(c, eventsFor(c)))
    }
    return map
  }, [containers, eventsFor])

  // Sort containers: running first, then by name
  const sortedContainers = useMemo(() => {
    return [...containers].sort((a, b) => {
      if (a.state === 'running' && b.state !== 'running') return -1
      if (a.state !== 'running' && b.state === 'running') return 1
      return a.name.localeCompare(b.name)
    })
  }, [containers])

  // Incidents: containers with restart_count > 0 or unhealthy
  const incidents = useMemo(() => {
    return containers.filter(
      (c) =>
        c.restart_count > 0 ||
        c.health.toLowerCase() === 'unhealthy' ||
        c.state === 'restarting',
    ).sort((a, b) => b.restart_count - a.restart_count)
  }, [containers])

  // Get last event for a container
  const getLastEvent = useCallback(
    (c: ContainerInfo): EventEntry | undefined => {
      return eventsFor(c).sort((a, b) => b.timestamp - a.timestamp)[0]
    },
    [eventsFor],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      <OnDemandMissingBanner />
      {/* Page header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold tracking-tight"><span className="text-gradient">Uptime Monitor</span>{scopeMember && <span className="ml-2 text-sm font-medium text-amber-200/90">· VM {memberName}</span>}</h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-[10px] font-semibold text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {fleetWide && hasFleet
              ? `Availability of every container on the hub and its ${scopeMembers.length} VM${scopeMembers.length === 1 ? '' : 's'}`
              : scopeMember
                ? `Availability of the containers inside the VM ${memberName}`
                : 'Container availability and uptime tracking across all stacks'}
          </p>
          {hasFleet && <div className="mt-2"><FleetScopeChips scope={scope} members={scopeMembers} onChange={setScope} busy={containersLoading && !!containerData} /></div>}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="
            flex items-center gap-2 rounded-lg px-3 py-2
            text-xs font-medium text-slate-300
            bg-white/5 border border-white/10
            hover:bg-white/10 hover:border-white/15
            disabled:opacity-50 transition-all duration-200
          "
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Everywhere: how each DCS answered */}
      {fleetMembers && fleetMembers.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap">
          {fleetMembers.map((mb) => (
            <button
              key={mb.id ?? 'hub'}
              type="button"
              onClick={() => { if (mb.reachable) setScope(mb.id ?? 'hub') }}
              title={mb.reachable ? `Only ${mb.id ? `the VM ${mb.name}` : 'the hub'}` : mb.error || 'not answering'}
              className={`inline-flex items-center gap-2 h-7 px-2.5 rounded-full border text-[11px] transition-colors shrink-0 whitespace-nowrap ${!mb.reachable ? 'border-white/[0.06] text-slate-500 cursor-default' : 'bg-white/[0.03] border-white/[0.06] text-slate-300 hover:bg-white/[0.06]'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${!mb.reachable ? 'bg-slate-600' : mb.id ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className="font-medium">{mb.id ? `VM${mb.vmid ? ` #${mb.vmid}` : ''} · ${mb.name}` : 'Hub'}</span>
              <span className="text-slate-500">{mb.reachable ? `${mb.summary?.total ?? 0} monitored` : 'not answering'}</span>
            </button>
          ))}
        </div>
      )}

      {/* Error state */}
      {containersError && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-rose-500/20 rounded-xl p-4">
          <p className="text-sm text-rose-400">Failed to fetch {scopeMember ? `the containers of the VM ${memberName}` : 'data'}: {containersError.message}</p>
        </div>
      )}

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4 stagger-children">
        <StatCard
          label="Overall Availability"
          value={`${stats.overallAvailability}%`}
          sub={`${stats.running} of ${stats.total} running`}
          icon={ArrowUp}
          color={availabilityColor(stats.overallAvailability)}
          delay={0}
          neon={stats.overallAvailability >= 99 ? 'neon-emerald' : stats.overallAvailability >= 95 ? 'neon-amber' : 'neon-rose'}
        />
        <StatCard
          label="Healthy Containers"
          value={stats.healthyCount}
          sub={`of ${stats.total} total`}
          icon={CheckCircle}
          color="text-emerald-400"
          delay={60}
        />
        <StatCard
          label="Average Uptime"
          value={formatAverageUptime(stats.avgUptimeSec)}
          sub="across all containers"
          icon={Timer}
          color="text-cyan-400"
          delay={120}
        />
        <StatCard
          label="Incidents"
          value={stats.totalRestarts}
          sub={`${incidents.length} container${incidents.length !== 1 ? 's' : ''} affected`}
          icon={AlertTriangle}
          color={stats.totalRestarts > 0 ? 'text-amber-400' : 'text-slate-400'}
          delay={180}
        />
      </div>

      {/* Container Uptime Bars */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden">
        {/* Section header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Activity size={16} className="text-emerald-400" />
            Container Uptime
            <span className="text-xs font-normal text-slate-500">
              ({containers.length} monitored)
            </span>
          </h3>
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.running }} />
              Running
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.stopped }} />
              Stopped
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.unknown }} />
              No Data
            </span>
          </div>
        </div>

        {/* Loading state */}
        {loading && containers.length === 0 && <LoadingState label="Loading uptime data…" />}

        {/* No containers */}
        {!loading && containers.length === 0 && (
          <EmptyState compact icon={<Server size={22} />} title="No containers found" hint={scopeMember ? `Nothing runs inside the VM ${memberName} yet.` : 'Uptime is tracked for every container Docker reports on this host.'} />
        )}

        {/* Container rows */}
        <div className="divide-y divide-white/[0.03]">
          {sortedContainers.map((container, idx) => {
            const segments = segmentsMap.get(rowKey(container)) ?? []
            const availability = calculateAvailability(container)

            return (
              <div
                key={rowKey(container)}
                className={`grid grid-cols-1 md:grid-cols-[220px_1fr_140px] items-center gap-2 md:gap-4 px-4 md:px-5 py-3 hover:bg-white/[0.03] transition-colors duration-150 animate-fade-in-up${container.state === 'running' && (container.health === 'healthy' || container.health === '' || container.health === 'none') ? ' glow-emerald' : ''}`}
                style={{
                  animationDelay: `${Math.min(idx * 30, 600)}ms`,
                  animationFillMode: 'both',
                }}
              >
                {/* Left: name + image + status */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-mono text-sm text-slate-200 truncate">
                      {container.name}
                    </p>
                    {fleetWide && <VmCapsule member={container.member} name={container.member_name} vmid={container.vmid} size="xs" onClick={() => setScope(container.member ?? 'hub')} />}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-500 font-mono truncate min-w-0" title={container.image}>
                      {truncateImage(container.image)}
                    </p>
                    <StatusBadge state={container.state} health={container.health} onDemand={container.on_demand} />
                  </div>
                </div>

                {/* Center: uptime bar */}
                <div className="min-w-0">
                  <UptimeBar segments={segments} />
                </div>

                {/* Right: uptime + availability */}
                <div className="text-right">
                  <p className={`text-sm font-bold tabular-nums ${availabilityColor(availability)}`}>
                    {availability}%
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {formatUptime(container.uptime_seconds)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Time labels */}
        {containers.length > 0 && (
          <div className="px-5 py-2 border-t border-white/[0.03] flex justify-between text-[9px] text-slate-500">
            <span>30 min ago</span>
            <span>Now</span>
          </div>
        )}
      </div>

      {/* Incident Log */}
      {incidents.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Incident Log
            </h3>
            <span className="text-xs font-normal text-slate-500">
              ({incidents.length} container{incidents.length !== 1 ? 's' : ''})
            </span>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {incidents.map((container, idx) => {
              const lastEvent = getLastEvent(container)

              return (
                <div
                  key={rowKey(container)}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors duration-150 animate-fade-in-up"
                  style={{
                    animationDelay: `${idx * 60}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  {/* Status icon */}
                  <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                    container.health.toLowerCase() === 'unhealthy'
                      ? 'bg-rose-500/10'
                      : container.state === 'restarting'
                        ? 'bg-amber-500/10'
                        : 'bg-amber-500/10'
                  }`}>
                    {container.health.toLowerCase() === 'unhealthy' ? (
                      <XCircle size={18} className="text-rose-400" />
                    ) : container.state === 'restarting' ? (
                      <RefreshCw size={18} className="text-amber-400 animate-spin" />
                    ) : (
                      <AlertTriangle size={18} className="text-amber-400" />
                    )}
                  </div>

                  {/* Container info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm text-slate-200 truncate min-w-0 flex items-center gap-2"><span className="truncate">{container.name}</span>{fleetWide && <VmCapsule member={container.member} name={container.member_name} vmid={container.vmid} size="xs" />}</p>
                      <StatusBadge state={container.state} health={container.health} onDemand={container.on_demand} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                      {container.restart_count > 0 && (
                        <span className="flex items-center gap-1">
                          <RefreshCw size={10} />
                          {container.restart_count} restart{container.restart_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {lastEvent && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          Last event: {lastEvent.action} {relativeTime(lastEvent.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Availability */}
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${availabilityColor(calculateAvailability(container))}`}>
                      {calculateAvailability(container)}%
                    </p>
                  </div>

                  <ChevronRight size={14} className="text-slate-500 shrink-0" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All clear message */}
      {incidents.length === 0 && containers.length > 0 && !loading && (
        <div
          className="bg-slate-900/60 backdrop-blur-md border border-emerald-500/10 rounded-xl p-6 text-center animate-fade-in-up"
          style={{ animationDelay: '200ms', animationFillMode: 'both' }}
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mx-auto mb-3">
            <Shield size={24} className="text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-emerald-400">All Clear</p>
          <p className="text-xs text-slate-500 mt-1">
            No incidents detected. All containers are running without restarts.
          </p>
        </div>
      )}
    </div>
  )
}
