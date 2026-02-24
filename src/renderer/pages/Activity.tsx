// =============================================================================
// Activity — Gorgeous vertical timeline of Docker events with filtering
// =============================================================================

import React, { useState, useMemo, useCallback } from 'react'
import {
  Play, Square, Plus, Trash2, RefreshCw, Download,
  Box, Network, HardDrive, Database,
  Clock, Filter, Search, Activity as ActivityIcon,
  Zap, WifiOff, Server, Loader2, X,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { fetchEvents } from '../api/endpoints'
import { useConnectionStore } from '../stores/connectionStore'
import { useLogStore } from '../stores/logStore'
import type { EventEntry, EventsResponse } from '../../shared/types'

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

type FilterType = 'all' | 'container' | 'network' | 'volume' | 'image'

const FILTER_TABS: { key: FilterType; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All', icon: <ActivityIcon size={13} /> },
  { key: 'container', label: 'Containers', icon: <Box size={13} /> },
  { key: 'network', label: 'Networks', icon: <Network size={13} /> },
  { key: 'volume', label: 'Volumes', icon: <HardDrive size={13} /> },
  { key: 'image', label: 'Images', icon: <Database size={13} /> },
]

/** Icon for each event action */
function actionIcon(action: string): React.ReactNode {
  switch (action) {
    case 'start':
      return <Play size={14} />
    case 'stop':
    case 'kill':
    case 'die':
      return <Square size={14} />
    case 'create':
      return <Plus size={14} />
    case 'destroy':
    case 'remove':
      return <Trash2 size={14} />
    case 'restart':
      return <RefreshCw size={14} />
    case 'pull':
      return <Download size={14} />
    default:
      return <Zap size={14} />
  }
}

/** Color config per action */
function actionColors(action: string): {
  dot: string
  icon: string
  bg: string
  border: string
  glow: string
} {
  switch (action) {
    case 'start':
    case 'create':
      return {
        dot: 'bg-emerald-400',
        icon: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        glow: 'shadow-[0_0_8px_rgba(52,211,153,0.3)]',
      }
    case 'stop':
    case 'kill':
    case 'die':
    case 'destroy':
    case 'remove':
      return {
        dot: 'bg-rose-400',
        icon: 'text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/20',
        glow: 'shadow-[0_0_8px_rgba(251,113,133,0.3)]',
      }
    case 'restart':
      return {
        dot: 'bg-amber-400',
        icon: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        glow: 'shadow-[0_0_8px_rgba(251,191,36,0.3)]',
      }
    case 'pull':
    case 'connect':
    case 'attach':
      return {
        dot: 'bg-cyan-400',
        icon: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/20',
        glow: 'shadow-[0_0_8px_rgba(34,211,238,0.3)]',
      }
    default:
      return {
        dot: 'bg-slate-400',
        icon: 'text-slate-400',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/20',
        glow: 'shadow-[0_0_8px_rgba(148,163,184,0.2)]',
      }
  }
}

/** Type badge config */
function typeBadge(type: string): { label: string; color: string; bg: string; border: string; icon: React.ReactNode } {
  switch (type) {
    case 'container':
      return { label: 'container', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: <Box size={10} /> }
    case 'network':
      return { label: 'network', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: <Network size={10} /> }
    case 'volume':
      return { label: 'volume', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: <HardDrive size={10} /> }
    case 'image':
      return { label: 'image', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <Database size={10} /> }
    default:
      return { label: type, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: <Zap size={10} /> }
  }
}

/** Relative time string */
function relativeTime(ts: number): string {
  const now = Date.now() / 1000
  const diff = now - ts
  if (diff < 5) return 'just now'
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return `${mins} min${mins !== 1 ? 's' : ''} ago`
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  }
  const days = Math.floor(diff / 86400)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

/** Absolute timestamp string */
function absoluteTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Day grouping key */
function dayGroup(ts: number): 'Today' | 'Yesterday' | 'Older' {
  const now = new Date()
  const eventDate = new Date(ts * 1000)

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000
  const eventMs = eventDate.getTime()

  if (eventMs >= todayStart) return 'Today'
  if (eventMs >= yesterdayStart) return 'Yesterday'
  return 'Older'
}

// ---------------------------------------------------------------------------
// Disconnected empty state
// ---------------------------------------------------------------------------

function DisconnectedState() {
  const connectionStatus = useConnectionStore((s) => s.status)
  const connect = useConnectionStore((s) => s.connect)
  const isConnecting = connectionStatus === 'connecting'

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] relative">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-48 h-48 rounded-full bg-emerald-500/[0.03] blur-3xl animate-breathe" />
        <div className="absolute bottom-1/3 right-1/3 w-56 h-56 rounded-full bg-cyan-500/[0.03] blur-3xl animate-breathe" style={{ animationDelay: '3s' }} />
      </div>

      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-slate-800/60 border border-white/[0.06] flex items-center justify-center">
          {isConnecting ? (
            <Loader2 size={32} className="text-amber-400 animate-spin" />
          ) : (
            <WifiOff size={32} className="text-slate-500" />
          )}
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-300 mb-2">
        {isConnecting ? 'Connecting...' : 'No Activity Data'}
      </h3>
      <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
        {isConnecting
          ? 'Establishing connection to the API server...'
          : 'Connect to your Docker API server to see the activity timeline.'
        }
      </p>

      {!isConnecting && (
        <button
          onClick={() => connect()}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Server size={15} />
          Connect
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar({ events }: { events: EventEntry[] }) {
  const counts = useMemo(() => {
    const c = { container: 0, network: 0, volume: 0, image: 0, other: 0 }
    for (const e of events) {
      if (e.type in c) (c as Record<string, number>)[e.type]++
      else c.other++
    }
    return c
  }, [events])

  const stats = [
    { label: 'Total', value: events.length, color: 'text-slate-200', iconColor: 'text-emerald-400', icon: <ActivityIcon size={14} /> },
    { label: 'Containers', value: counts.container, color: 'text-cyan-400', iconColor: 'text-cyan-400', icon: <Box size={14} /> },
    { label: 'Networks', value: counts.network, color: 'text-amber-400', iconColor: 'text-amber-400', icon: <Network size={14} /> },
    { label: 'Volumes', value: counts.volume, color: 'text-violet-400', iconColor: 'text-violet-400', icon: <HardDrive size={14} /> },
    { label: 'Images', value: counts.image, color: 'text-emerald-400', iconColor: 'text-emerald-400', icon: <Database size={14} /> },
  ]

  return (
    <div className="grid grid-cols-5 gap-3 animate-fade-in">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-3 transition-all duration-200 hover:border-white/[0.1]"
        >
          <div className={`${stat.iconColor} opacity-60`}>{stat.icon}</div>
          <div className="min-w-0">
            <div className={`text-lg font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline card
// ---------------------------------------------------------------------------

function TimelineCard({ event, index }: { event: EventEntry; index: number }) {
  const colors = actionColors(event.action)
  const badge = typeBadge(event.type)

  return (
    <div
      className="relative pl-10 pb-8 last:pb-0 group animate-fade-in"
      style={{ animationDelay: `${Math.min(index * 40, 600)}ms` }}
    >
      {/* Vertical connector line (hidden on last) */}
      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gradient-to-b from-white/[0.08] to-transparent group-last:hidden" />

      {/* Timeline dot */}
      <div className="absolute left-0 top-1 z-10">
        <div className={`
          w-[23px] h-[23px] rounded-full border-2 border-slate-900
          flex items-center justify-center
          ${colors.bg} ${colors.glow}
          transition-all duration-300 group-hover:scale-110
        `}>
          <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
        </div>
      </div>

      {/* Card */}
      <div className="
        bg-slate-900/60 backdrop-blur-md border border-white/5
        rounded-xl p-4
        hover:border-white/[0.1] hover:bg-slate-900/80
        transition-all duration-300
        group-hover:translate-x-0.5
      ">
        <div className="flex items-start justify-between gap-3">
          {/* Left content */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Action icon */}
            <div className={`
              flex-shrink-0 w-8 h-8 rounded-lg
              ${colors.bg} ${colors.border} border
              flex items-center justify-center
              ${colors.icon}
            `}>
              {actionIcon(event.action)}
            </div>

            <div className="min-w-0 flex-1">
              {/* Action + type row */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`
                  inline-flex items-center rounded-md border px-2 py-0.5
                  text-[11px] font-semibold uppercase tracking-wide
                  ${colors.bg} ${colors.border} ${colors.icon}
                `}>
                  {event.action}
                </span>
                <span className={`
                  inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5
                  text-[10px] font-medium
                  ${badge.bg} ${badge.border} ${badge.color}
                `}>
                  {badge.icon}
                  {badge.label}
                </span>
              </div>

              {/* Resource name */}
              <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
                {event.name}
              </p>
            </div>
          </div>

          {/* Right: time */}
          <div className="flex-shrink-0 text-right">
            <div className="text-xs font-medium text-slate-400 tabular-nums">
              {relativeTime(event.timestamp)}
            </div>
            <div className="text-[10px] text-slate-600 tabular-nums mt-0.5">
              {absoluteTime(event.timestamp)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day group header
// ---------------------------------------------------------------------------

function DayHeader({ label }: { label: string }) {
  return (
    <div className="relative pl-10 pb-4 pt-2 animate-fade-in">
      {/* Dot on the timeline */}
      <div className="absolute left-[7px] top-3 z-10">
        <div className="w-[9px] h-[9px] rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 ring-2 ring-slate-950" />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
          {label}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty events state (connected but no events)
// ---------------------------------------------------------------------------

function EmptyEvents() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <div className="rounded-2xl bg-slate-800/40 p-5 mb-4">
        <Clock className="h-8 w-8 text-slate-600" />
      </div>
      <p className="text-sm font-medium text-slate-400">No events yet</p>
      <p className="text-xs text-slate-600 mt-1">
        Docker events will appear here as activity occurs
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity page
// ---------------------------------------------------------------------------

export default function Activity() {
  const connectionStatus = useConnectionStore((s) => s.status)
  const isConnected = connectionStatus === 'connected'
  const reportPollSuccess = useConnectionStore((s) => s.reportPollSuccess)
  const reportPollFailure = useConnectionStore((s) => s.reportPollFailure)

  const setEvents = useLogStore((s) => s.setEvents)
  const events = useLogStore((s) => s.events)

  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Poll /events every 3s
  const onPollSuccess = useCallback(() => {
    reportPollSuccess()
  }, [reportPollSuccess])

  const onPollError = useCallback(() => {
    reportPollFailure()
  }, [reportPollFailure])

  const eventsPoll = usePolling<EventsResponse>(fetchEvents, 3000, {
    enabled: isConnected,
    onError: onPollError,
  })

  React.useEffect(() => {
    if (eventsPoll.data) {
      setEvents(eventsPoll.data.events)
      onPollSuccess()
    }
  }, [eventsPoll.data, setEvents, onPollSuccess])

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = [...events]

    // Type filter
    if (activeFilter !== 'all') {
      result = result.filter((e) => e.type === activeFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q),
      )
    }

    // Sort by timestamp descending (newest first)
    result.sort((a, b) => b.timestamp - a.timestamp)

    return result
  }, [events, activeFilter, searchQuery])

  // Group events by day
  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: EventEntry[] }[] = []
    let currentGroup: string | null = null

    for (const event of filteredEvents) {
      const group = dayGroup(event.timestamp)
      if (group !== currentGroup) {
        groups.push({ label: group, events: [] })
        currentGroup = group
      }
      groups[groups.length - 1].events.push(event)
    }

    return groups
  }, [filteredEvents])

  // Determine UI state
  const hasNoData = events.length === 0
  const showDisconnected = !isConnected && hasNoData

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-gradient">Activity Timeline</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time Docker events across all resources
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-xs font-medium text-emerald-400">Streaming</span>
            </div>
          )}
          {isConnected && (
            <button
              onClick={eventsPoll.refresh}
              disabled={eventsPoll.loading}
              className="
                flex items-center gap-1.5 rounded-lg px-3 py-2
                text-xs font-medium text-slate-300
                bg-white/5 border border-white/10
                hover:bg-white/10 hover:border-white/15
                disabled:opacity-50 transition-all duration-200
              "
            >
              <RefreshCw size={13} className={eventsPoll.loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {showDisconnected ? (
        <DisconnectedState />
      ) : (
        <>
          {/* Stats bar */}
          <StatsBar events={events} />

          {/* Filters row */}
          <div className="flex items-center gap-3 flex-wrap animate-fade-in">
            {/* Type filter tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/[0.06]">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`
                    flex items-center gap-1.5 rounded-lg px-3 py-1.5
                    text-xs font-medium transition-all duration-200
                    ${activeFilter === tab.key
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-sm'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
                    }
                  `}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  w-full rounded-lg pl-9 pr-4 py-2
                  text-sm text-slate-200 placeholder-slate-600
                  bg-slate-900/60 border border-white/[0.08]
                  focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20
                  transition-all duration-200
                "
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Result count */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto">
              <Filter size={13} />
              <span>
                {filteredEvents.length === events.length
                  ? `${events.length} events`
                  : `${filteredEvents.length} of ${events.length}`
                }
              </span>
            </div>
          </div>

          {/* Timeline */}
          {filteredEvents.length === 0 ? (
            <EmptyEvents />
          ) : (
            <div className="relative animate-fade-in">
              {/* Main timeline line (gradient) */}
              <div
                className="absolute left-[11px] top-0 bottom-0 w-px"
                style={{
                  background: 'linear-gradient(to bottom, rgba(52,211,153,0.3), rgba(34,211,238,0.15), transparent)',
                }}
              />

              {/* Grouped events */}
              <div className="relative">
                {groupedEvents.map((group) => (
                  <div key={group.label}>
                    <DayHeader label={group.label} />
                    {group.events.map((event, idx) => (
                      <TimelineCard
                        key={`${event.timestamp}-${event.name}-${event.action}-${idx}`}
                        event={event}
                        index={idx}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Bottom fade */}
              <div className="h-8 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
