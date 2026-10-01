// =============================================================================
// Live Events — the server's live event stream (Server-Sent Events): Docker
// events and metrics as they happen, with filtering and auto-scroll. On a hub
// the fleet chips choose what the stream carries:
// the hub's own docker events, every VM's too, or one VM's.
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { Badge, SegmentedControl } from '@mantine/core'
import { Radio, Trash2, ArrowDown, ArrowDownToLine } from 'lucide-react'
import { sseClient, fleetTagOf, type SSEMessage, type SSEEventType, type FleetTag } from '../lib/sse'
import { useFleetScope, type ScopeMember } from '../hooks/useFleetScope'
import FleetScopeChips from '../components/fleet/FleetScopeChips'
import VmCapsule from '../components/fleet/VmCapsule'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { EmptyState } from '../components/common/PageState'
import PageHeader from '../components/common/PageHeader'
import { BTN_TOOLBAR, TONE_QUIET } from '../lib/ui'
import { CARD, CARD_HOVER, FOCUS_RING } from '../lib/pageKit'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EVENTS = 500

type FilterKey = SSEEventType | 'all'

// (the stream only ever sends docker-event and metrics; log-line and health-score are in the protocol
// but nothing emits them, so a tab for them would stay empty for ever)
const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'docker-event', label: 'Docker events' },
  { key: 'metrics', label: 'Metrics' },
]

/** Docker events are the ones to watch (cyan); the rest is a steady stream, told apart by its label (slate) */
const TYPE_COLOR: Record<SSEEventType, 'cyan' | 'slate'> = {
  'docker-event': 'cyan',
  metrics: 'slate',
  'log-line': 'slate',
  'health-score': 'slate',
  keepalive: 'slate',
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
  const { scope, setScope, members, hasFleet, memberName } = useFleetScope()

  const [events, setEvents] = useState<FeedEvent[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [sseConnected, setSSEConnected] = useState(() => sseClient.isConnected())

  const feedRef = useRef<HTMLDivElement>(null)
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

  // The feed scrolls, not the page: scrollIntoView on a marker at its end would scroll every scrollable
  // ancestor too, and pull the page's own header out of view each time an event arrives.
  const scrollFeedToEnd = useCallback((smooth = true) => {
    const feed = feedRef.current
    if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // ---- Auto-scroll ----
  useEffect(() => {
    if (autoScroll) scrollFeedToEnd()
  }, [events, autoScroll, scrollFeedToEnd])

  // ---- Handlers ----
  const clearEvents = useCallback(() => setEvents([]), [])
  const toggleAutoScroll = useCallback(() => setAutoScroll((v) => !v), [])

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)

  // the page's own line (constants/pageTitles) unless it shows part of a fleet
  const subtitle = scope === 'all'
    ? `Docker events from the hub and its ${members.length} VM${members.length === 1 ? '' : 's'}, live`
    : scope !== 'hub'
      ? `Docker events from the VM ${memberName}, live`
      : undefined
  const waiting = scope === 'all'
    ? 'Waiting for events from the hub and its VMs…'
    : scope !== 'hub'
      ? `Waiting for events from the VM ${memberName}…`
      : 'Waiting for server events…'

  // ---- Render ----
  return (
    <div className="space-y-4 md:space-y-5 animate-fade-in">
      <DisconnectedBanner />

      {/* ---- Header ---- */}
      <PageHeader
        page="event-feed"
        subtitle={subtitle}
        badge={
          <Badge
            color={sseConnected ? 'emerald' : 'rose'}
            leftSection={<span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} aria-hidden />}
          >
            {sseConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        }
        actions={<>
          <button
            type="button"
            onClick={toggleAutoScroll}
            aria-pressed={autoScroll}
            className={`${BTN_TOOLBAR} ${FOCUS_RING} ${autoScroll ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25' : TONE_QUIET}`}
          >
            <ArrowDownToLine size={14} />
            Auto-scroll
          </button>
          <button type="button" onClick={clearEvents} className={`${BTN_TOOLBAR} ${TONE_QUIET} ${FOCUS_RING}`}>
            <Trash2 size={14} />
            Clear
          </button>
        </>}
      >
        {/* Fleet scope: under the line on a desktop, one swipeable row on a phone */}
        {hasFleet && <FleetScopeChips scope={scope} members={members} onChange={setScope} />}
      </PageHeader>

      {/* ---- Filter ---- */}
      <div className="min-w-0 max-w-full overflow-x-auto scrollbar-none">
        <SegmentedControl
          aria-label="Type of event"
          value={filter}
          onChange={(v) => setFilter(v as FilterKey)}
          data={FILTER_TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
        />
      </div>

      {/* ---- Event count ---- */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1 -mt-1" role="status">
        <span>
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          {filter !== 'all' && ` (${events.length} total)`}
        </span>
        {!autoScroll && filtered.length > 0 && (
          <button
            type="button"
            onClick={() => scrollFeedToEnd()}
            className={`flex h-8 items-center gap-1 rounded-lg px-2 text-cyan-400 hover:text-cyan-300 hover:bg-white/5 transition-colors ${FOCUS_RING}`}
          >
            <ArrowDown size={12} aria-hidden />
            Jump to latest
          </button>
        )}
      </div>

      {/* ---- Feed ---- */}
      <div
        ref={feedRef}
        role="log"
        aria-label="Live events"
        aria-live="off"
        className={`${CARD} p-3 sm:p-4 max-h-[calc(100vh-340px)] min-h-[16rem] overflow-y-auto scrollbar-thin space-y-2`}
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Radio size={30} />}
            title="No events yet"
            hint={sseConnected ? waiting : 'The live connection is down — events will appear once it is back.'}
          />
        ) : (
          filtered.map((event, idx) => {
            const tag = event.tag
            return (
              <div
                key={`${event.timestamp}-${idx}`}
                className={`${CARD_HOVER} p-3 sm:p-4`}
              >
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <Badge color={TYPE_COLOR[event.type] ?? 'cyan'}>
                    {event.type}
                  </Badge>
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
      </div>
    </div>
  )
}
