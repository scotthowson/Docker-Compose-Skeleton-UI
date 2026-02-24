// =============================================================================
// RecentEvents — Latest events feed for the Dashboard
// =============================================================================

import React, { useState } from 'react'
import { Box, Image, Network, Settings, Activity, Zap, ChevronDown } from 'lucide-react'
import { useLogStore } from '../../stores/logStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { EventEntry } from '../../../shared/types'

function eventTypeConfig(type: string): { icon: React.ReactNode; color: string; bg: string } {
  switch (type) {
    case 'container':
      return { icon: <Box className="h-3.5 w-3.5" />, color: 'text-cyan-400', bg: 'bg-cyan-500/10' }
    case 'image':
      return { icon: <Image className="h-3.5 w-3.5" />, color: 'text-violet-400', bg: 'bg-violet-500/10' }
    case 'network':
      return { icon: <Network className="h-3.5 w-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/10' }
    default:
      return { icon: <Settings className="h-3.5 w-3.5" />, color: 'text-slate-400', bg: 'bg-slate-500/10' }
  }
}

function actionBadge(action: string): string {
  switch (action) {
    case 'start':
    case 'create':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    case 'stop':
    case 'kill':
    case 'die':
    case 'destroy':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/20'
    case 'restart':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    case 'pull':
    case 'connect':
    case 'attach':
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
    default:
      return 'bg-slate-500/15 text-slate-400 border-slate-500/20'
  }
}

function formatTimestamp(ts: number): string {
  const now = Date.now() / 1000
  const diff = now - ts

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`

  const date = new Date(ts * 1000)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function EventRow({ event, index }: { event: EventEntry; index: number }) {
  const config = eventTypeConfig(event.type)

  return (
    <div
      className="flex items-center gap-3 py-2.5 px-2 rounded-lg group hover:bg-white/[0.02] transition-colors duration-150 animate-fade-in"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Type icon */}
      <div className={`flex-shrink-0 rounded-md p-1.5 ${config.bg} ${config.color}`}>
        {config.icon}
      </div>

      {/* Action badge */}
      <span className={`flex-shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${actionBadge(event.action)}`}>
        {event.action}
      </span>

      {/* Name */}
      <span className="min-w-0 flex-1 truncate text-sm text-slate-300 group-hover:text-white transition-colors font-mono text-xs">
        {event.name}
      </span>

      {/* Timestamp */}
      <span className="flex-shrink-0 text-[11px] text-slate-600 tabular-nums">
        {formatTimestamp(event.timestamp)}
      </span>
    </div>
  )
}

function EmptyState() {
  const connectionStatus = useConnectionStore((s) => s.status)
  const isDisconnected = connectionStatus !== 'connected'

  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
      {isDisconnected ? (
        <>
          <div className="rounded-xl bg-slate-800/40 p-4 mb-3">
            <Zap className="h-6 w-6 text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">No events available</p>
          <p className="text-xs text-slate-600 mt-1">Connect to API server to see Docker events</p>
        </>
      ) : (
        <>
          <div className="rounded-xl bg-slate-800/40 p-4 mb-3">
            <Activity className="h-6 w-6 text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">No recent events</p>
          <p className="text-xs text-slate-600 mt-1">Events will appear here as Docker activity occurs</p>
        </>
      )}
    </div>
  )
}

export default function RecentEvents({ collapsible = false }: { collapsible?: boolean }) {
  const events = useLogStore((s) => s.events)
  const loading = useLogStore((s) => s.loading)
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false
    try { return localStorage.getItem('dash-events-collapsed') === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('dash-events-collapsed', String(next)) } catch {}
  }

  // Take the last 10 events, most recent first
  const recentEvents = [...events].slice(-10).reverse()

  if (loading && events.length === 0) {
    return (
      <div className="glass-card p-4 md:p-6 animate-pulse">
        <div className="h-5 w-32 rounded bg-slate-700/50 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="h-7 w-7 rounded-md bg-slate-700/40" />
              <div className="h-5 w-14 rounded-md bg-slate-700/40" />
              <div className="h-4 flex-1 rounded bg-slate-800/40" />
              <div className="h-3 w-12 rounded bg-slate-800/40" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-4 md:p-6 animate-fade-in">
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer select-none' : ''} ${collapsed ? '' : 'mb-3'}`}
        onClick={collapsible ? toggleCollapsed : undefined}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          Recent Events
        </h3>
        <div className="flex items-center gap-2">
          {recentEvents.length > 0 && !collapsed && (
            <span className="text-[11px] text-slate-600 font-mono">
              {recentEvents.length} events
            </span>
          )}
          {collapsible && (
            <ChevronDown
              size={16}
              className={`text-slate-500 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
            />
          )}
        </div>
      </div>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${collapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}
      >
        {recentEvents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-h-[360px] overflow-y-auto scrollbar-thin space-y-0.5">
            {recentEvents.map((event, idx) => (
              <EventRow key={`${event.timestamp}-${event.name}-${idx}`} event={event} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
