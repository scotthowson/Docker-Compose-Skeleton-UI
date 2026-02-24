// =============================================================================
// LiveLogViewer — Real-time log tailing with auto-scroll, search, level colors
// =============================================================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Play, Pause, Search, Download, Trash2, X,
  ArrowDown, Filter, Loader2, RefreshCw,
  AlertTriangle, AlertCircle, Info, Bug,
} from 'lucide-react'
import { fetchContainerLogsLive, fetchAppLogsLive } from '../../api/endpoints'
import { useConnectionStore } from '../../stores/connectionStore'
import type { LogStreamEntry, LiveLogsResponse } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveLogViewerProps {
  /** Container name (omit for DCS app logs) */
  containerName?: string
  /** Number of initial lines to fetch */
  initialLines?: number
  /** Polling interval in ms */
  pollInterval?: number
  /** Max lines to keep in buffer */
  maxLines?: number
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'unknown'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectLevel(entry: LogStreamEntry): LogLevel {
  if (entry.level) {
    const l = entry.level.toLowerCase()
    if (l.includes('error') || l.includes('fatal') || l.includes('crit')) return 'error'
    if (l.includes('warn')) return 'warn'
    if (l.includes('info') || l.includes('notice')) return 'info'
    if (l.includes('debug') || l.includes('trace')) return 'debug'
  }
  // Fallback: check the line content
  const line = entry.line.toLowerCase()
  if (/\b(error|fatal|crit|exception|panic)\b/.test(line)) return 'error'
  if (/\b(warn|warning)\b/.test(line)) return 'warn'
  if (/\b(info|notice)\b/.test(line)) return 'info'
  if (/\b(debug|trace)\b/.test(line)) return 'debug'
  return 'unknown'
}

const levelConfig: Record<LogLevel, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  error: {
    color: 'text-rose-400',
    bg: 'bg-rose-500/8 border-l-2 border-l-rose-500/40',
    icon: <AlertCircle size={12} />,
    label: 'ERROR',
  },
  warn: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/5 border-l-2 border-l-amber-500/30',
    icon: <AlertTriangle size={12} />,
    label: 'WARN',
  },
  info: {
    color: 'text-cyan-400',
    bg: 'border-l-2 border-l-transparent',
    icon: <Info size={12} />,
    label: 'INFO',
  },
  debug: {
    color: 'text-slate-500',
    bg: 'border-l-2 border-l-transparent opacity-60',
    icon: <Bug size={12} />,
    label: 'DEBUG',
  },
  unknown: {
    color: 'text-slate-400',
    bg: 'border-l-2 border-l-transparent',
    icon: null,
    label: '',
  },
}

function formatTimestamp(ts: string): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts.slice(11, 19)
  }
}

// ---------------------------------------------------------------------------
// LiveLogViewer
// ---------------------------------------------------------------------------

export default function LiveLogViewer({
  containerName,
  initialLines = 100,
  pollInterval = 2000,
  maxLines = 5000,
}: LiveLogViewerProps) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')

  const [lines, setLines] = useState<LogStreamEntry[]>([])
  const [isLive, setIsLive] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastTimestampRef = useRef<string>('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const userScrolledRef = useRef(false)

  // Fetch function
  const fetchLogs = useCallback(async (since?: string) => {
    try {
      let data: LiveLogsResponse
      if (containerName) {
        data = await fetchContainerLogsLive(containerName, since ? 50 : initialLines, since)
      } else {
        data = await fetchAppLogsLive(since ? 50 : initialLines, since)
      }
      return data
    } catch {
      return null
    }
  }, [containerName, initialLines])

  // Initial fetch
  useEffect(() => {
    if (!isConnected) return
    setLoading(true)
    fetchLogs().then((data) => {
      if (data?.entries) {
        setLines(data.entries)
        const last = data.entries[data.entries.length - 1]
        if (last?.timestamp) lastTimestampRef.current = last.timestamp
      }
      setLoading(false)
    })
  }, [isConnected, fetchLogs])

  // Live polling
  useEffect(() => {
    if (!isLive || !isConnected) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(async () => {
      const data = await fetchLogs(lastTimestampRef.current || undefined)
      if (data?.entries && data.entries.length > 0) {
        setLines((prev) => {
          const combined = [...prev, ...data.entries]
          // Trim to maxLines
          if (combined.length > maxLines) {
            return combined.slice(combined.length - maxLines)
          }
          return combined
        })
        const last = data.entries[data.entries.length - 1]
        if (last?.timestamp) lastTimestampRef.current = last.timestamp
      }
    }, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isLive, isConnected, fetchLogs, pollInterval, maxLines])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && !userScrolledRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  // Detect user scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    userScrolledRef.current = !isAtBottom
    setAutoScroll(isAtBottom)
  }, [])

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setAutoScroll(true)
      userScrolledRef.current = false
    }
  }, [])

  // Filter entries
  const filteredLines = useMemo(() => {
    return lines.filter((entry) => {
      // Level filter
      if (levelFilter !== 'all') {
        const level = detectLevel(entry)
        if (level !== levelFilter) return false
      }
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!entry.line.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [lines, levelFilter, search])

  // Export logs
  const handleExport = useCallback(() => {
    const text = filteredLines.map((e) => `${e.timestamp || ''} ${e.line}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${containerName || 'app'}-${new Date().toISOString().slice(0, 19)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredLines, containerName])

  // Clear buffer
  const handleClear = useCallback(() => {
    setLines([])
    lastTimestampRef.current = ''
  }, [])

  // Level counts
  const levelCounts = useMemo(() => {
    const counts = { error: 0, warn: 0, info: 0, debug: 0, unknown: 0 }
    for (const entry of lines) {
      counts[detectLevel(entry)]++
    }
    return counts
  }, [lines])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-md border border-white/[0.05] rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          {/* Live toggle */}
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
              isLive
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            {isLive ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-50 animate-ping" style={{ animationDuration: '2s' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                Live
              </>
            ) : (
              <>
                <Pause size={12} />
                Paused
              </>
            )}
          </button>

          {/* Level filter badges */}
          <div className="flex items-center gap-1 ml-2">
            {levelCounts.error > 0 && (
              <button
                onClick={() => setLevelFilter(levelFilter === 'error' ? 'all' : 'error')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                  levelFilter === 'error'
                    ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30'
                    : 'bg-rose-500/10 text-rose-400/70 hover:bg-rose-500/15'
                }`}
              >
                <AlertCircle size={10} />
                {levelCounts.error}
              </button>
            )}
            {levelCounts.warn > 0 && (
              <button
                onClick={() => setLevelFilter(levelFilter === 'warn' ? 'all' : 'warn')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                  levelFilter === 'warn'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                    : 'bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/15'
                }`}
              >
                <AlertTriangle size={10} />
                {levelCounts.warn}
              </button>
            )}
          </div>

          {/* Line count */}
          <span className="text-[10px] text-slate-600 ml-2 tabular-nums">
            {filteredLines.length} / {lines.length} lines
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter..."
              className="w-40 pl-7 pr-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/30 focus:w-56 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
              >
                <X size={10} />
              </button>
            )}
          </div>

          {/* Filter dropdown */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded-lg border transition-all ${
              levelFilter !== 'all'
                ? 'bg-violet-500/15 text-violet-400 border-violet-500/20'
                : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
            title="Level filter"
          >
            <Filter size={13} />
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="p-1.5 rounded-lg bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-400 transition-all"
            title="Export logs"
          >
            <Download size={13} />
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:bg-white/[0.06] hover:text-rose-400 transition-all"
            title="Clear buffer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Level filter dropdown */}
      {showFilters && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
          <span className="text-[10px] text-slate-600 uppercase tracking-wider mr-2">Level:</span>
          {(['all', 'error', 'warn', 'info', 'debug'] as const).map((level) => (
            <button
              key={level}
              onClick={() => { setLevelFilter(level); setShowFilters(false) }}
              className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                levelFilter === level
                  ? 'bg-white/[0.08] text-slate-200 border-white/[0.1]'
                  : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:bg-white/[0.06]'
              }`}
            >
              {level === 'all' ? 'All' : level.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin font-mono text-[11px] leading-relaxed"
      >
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-slate-600" />
          </div>
        )}

        {!loading && filteredLines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <RefreshCw size={18} className="text-slate-700" />
            <p className="text-xs text-slate-600">
              {search || levelFilter !== 'all' ? 'No lines match your filter' : 'Waiting for log output...'}
            </p>
          </div>
        )}

        {filteredLines.map((entry, idx) => {
          const level = detectLevel(entry)
          const cfg = levelConfig[level]
          return (
            <div
              key={idx}
              className={`flex items-start gap-2 px-4 py-0.5 hover:bg-white/[0.02] ${cfg.bg} transition-colors`}
            >
              {/* Timestamp */}
              {entry.timestamp && (
                <span className="text-slate-600 shrink-0 select-none tabular-nums">
                  {formatTimestamp(entry.timestamp)}
                </span>
              )}

              {/* Level badge */}
              {cfg.label && (
                <span className={`shrink-0 flex items-center gap-0.5 ${cfg.color} select-none w-12`}>
                  {cfg.icon}
                  <span className="text-[9px] font-bold">{cfg.label}</span>
                </span>
              )}

              {/* Log line */}
              <span className={`flex-1 break-all ${level === 'error' ? 'text-rose-300' : level === 'warn' ? 'text-amber-300' : 'text-slate-300'}`}>
                {search ? highlightSearch(entry.line, search) : entry.line}
              </span>
            </div>
          )
        })}
      </div>

      {/* Scroll to bottom FAB */}
      {!autoScroll && (
        <div className="absolute bottom-4 right-4">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/90 text-slate-300 border border-white/[0.1] shadow-lg hover:bg-slate-700/90 transition-all animate-fade-in"
          >
            <ArrowDown size={14} />
            <span className="text-[11px] font-medium">Scroll to bottom</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search highlight helper
// ---------------------------------------------------------------------------

function highlightSearch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-amber-500/30 text-amber-200 rounded px-0.5">{part}</mark>
      : part
  )
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
