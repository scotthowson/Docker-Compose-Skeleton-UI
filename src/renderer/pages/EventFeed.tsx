// =============================================================================
// EventFeed — Live SSE event feed with filtering, auto-scroll, and connection
// status indicator. On a hub the fleet chips choose what the stream carries:
// the hub's own docker events, every VM's too, or one VM's.
// =============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Radio, Trash2, Pause, Play, ArrowDown } from 'lucide-react'
import { sseClient, fleetTagOf, type SSEMessage, type SSEEventType, type FleetTag } from '../lib/sse'
import { useConnectionStore } from '../stores/connectionStore'
import { useFleetScope, type ScopeMember } from '../hooks/useFleetScope'
import FleetScopeChips from '../components/fleet/FleetScopeChips'
import VmCapsule from '../components/fleet/VmCapsule'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EVENTS = 500

type FilterKey = SSEEventType | 'all'

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'docker-event', label: 'Docker Events' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'log-line', label: 'Logs' },
  { key: 'health-score', label: 'Health' },
]

const TYPE_COLORS: Record<SSEEventType, { badge: string; dot: string }> = {
  'docker-event': {
    badge: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    dot: 'bg-cyan-400',
  },
  metrics: {
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  'log-line': {
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    dot: 'bg-amber-400',
  },
  'health-score': {
    badge: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
    dot: 'bg-violet-400',
  },
  keepalive: {
    badge: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
    dot: 'bg-slate-400',
  },
}

/** An event as the feed keeps it: the message plus where it happened (fleet view only) */
interface FeedEvent extends SSEMessage {
  tag: FleetTag | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  } catch {
    return iso
  }
}

function prettyJSON(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

/**
 * Where a docker event happened: the tag the hub put on it, else what the
 * stream's scope implies — the hub itself in the fleet view, the chosen VM in
 * a VM view, nothing on a hub-only stream (no capsule then).
 */
function tagFor(event: SSEMessage, scope: string, members: ScopeMember[]): FleetTag | null {
  if (event.type !== 'docker-event') return null
  const own = fleetTagOf(event.data)
  if (own) return own
  if (scope === 'all') return { member: null }
  if (scope === 'hub') return null
  const m = members.find((x) => x.id === scope)
  return { member: scope, member_name: m?.name, vmid: m?.vmid ?? null }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventFeed() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { scope, setScope, members, hasFleet, memberName } = useFleetScope()

  const [events, setEvents] = useState<FeedEvent[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [sseConnected, setSSEConnected] = useState(() => sseClient.isConnected())

  const feedRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // read when an event arrives (the listener below is subscribed once)
  const scopeRef = useRef(scope)
  const membersRef = useRef(members)
  membersRef.current = members

  // ---- Scope → stream ----
  // The choice is shared with the other fleet pages and kept when this page
  // unmounts; the stream simply carries on with it.
  useEffect(() => {
    scopeRef.current = scope
    sseClient.setScope(scope)
  }, [scope])

  // ---- SSE subscription ----
  useEffect(() => {
    const unsub = sseClient.on('*', (event: SSEMessage) => {
      const entry: FeedEvent = { ...event, tag: tagFor(event, scopeRef.current, membersRef.current) }
      setEvents((prev) => {
        const next = [...prev, entry]
        return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next
      })
    })

    // Poll SSE connection status
    const statusInterval = setInterval(() => {
      setSSEConnected(sseClient.isConnected())
    }, 1000)

    return () => {
      unsub()
      clearInterval(statusInterval)
    }
  }, [])

  // ---- Auto-scroll ----
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events, autoScroll])

  // ---- Handlers ----
  const clearEvents = useCallback(() => setEvents([]), [])
  const toggleAutoScroll = useCallback(() => setAutoScroll((v) => !v), [])

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)

  const subtitle = scope === 'all'
    ? `Docker events from the hub and its ${members.length} VM${members.length === 1 ? '' : 's'}, live`
    : scope !== 'hub'
      ? `Docker events from the VM ${memberName}, live`
      : 'Real-time server events via SSE'
  const waiting = scope === 'all'
    ? 'Waiting for events from the hub and its VMs...'
    : scope !== 'hub'
      ? `Waiting for events from the VM ${memberName}...`
      : 'Waiting for server events...'

  // ---- Render ----
  return (
    <div className="space-y-6 animate-fade-in">
      <DisconnectedBanner />

      {/* ---- Header ---- */}
      <div className="space-y-2">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <Radio size={20} className="text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight"><span className="text-gradient">Live Event Feed</span></h1>
            <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
          </div>

          {/* Connection indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span
              className={`w-2 h-2 rounded-full ${
                sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className="text-xs font-medium text-slate-300">
              {sseConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        {/* Fleet scope: under the title on a desktop, one swipeable row on a phone */}
        {hasFleet && <div className="sm:pl-14"><FleetScopeChips scope={scope} members={members} onChange={setScope} /></div>}
      </div>

      {/* ---- Toolbar ---- */}
      <div className="glass rounded-xl p-4 border border-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  filter === tab.key
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutoScroll}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1.5"
              title={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
            >
              {autoScroll ? <Pause size={13} /> : <Play size={13} />}
              {autoScroll ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={clearEvents}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={13} />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* ---- Event count ---- */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          {filter !== 'all' && ` (${events.length} total)`}
        </span>
        {!autoScroll && filtered.length > 0 && (
          <button
            onClick={() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowDown size={12} />
            Jump to latest
          </button>
        )}
      </div>

      {/* ---- Feed ---- */}
      <div
        ref={feedRef}
        className="glass rounded-xl border border-white/5 p-4 max-h-[calc(100vh-340px)] overflow-y-auto scrollbar-thin space-y-2"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Radio size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No events yet</p>
            <p className="text-xs mt-1 text-slate-500">
              {sseConnected ? waiting : 'SSE is disconnected — events will appear once reconnected'}
            </p>
          </div>
        ) : (
          filtered.map((event, idx) => {
            const colors = TYPE_COLORS[event.type] ?? TYPE_COLORS['docker-event']
            const tag = event.tag
            return (
              <div
                key={`${event.timestamp}-${idx}`}
                className="glass rounded-xl border border-white/5 p-4 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colors.badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                    {event.type}
                  </span>
                  {tag && (
                    <VmCapsule member={tag.member} name={tag.member_name} vmid={tag.vmid} size="xs" onClick={() => setScope(tag.member ?? 'hub')} />
                  )}
                </div>
                <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all leading-relaxed bg-black/20 rounded-lg p-3 max-h-48 overflow-y-auto scrollbar-thin">
                  {prettyJSON(event.data)}
                </pre>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
