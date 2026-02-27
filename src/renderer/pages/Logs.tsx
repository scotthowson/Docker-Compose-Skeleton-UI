// =============================================================================
// Logs — Advanced log viewer with level filtering, color coding, and export
// Enhanced with server-side filtering, log stats, and archive browser
// =============================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  ScrollText, Search, ArrowDownToLine, RefreshCw, FileText,
  Download, Copy, Check, Filter, X, BarChart3, Archive, ChevronDown,
  Radio,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { fetchLogsFiltered, fetchLogStats, fetchLogArchives } from '../api/endpoints'
import { useLogStore } from '../stores/logStore'
import { useConnectionStore } from '../stores/connectionStore'
import LiveLogViewer from '../components/logs/LiveLogViewer'
import type { LogsResponse, LogStatsResponse, LogArchivesResponse } from '../../shared/types'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

// ---------------------------------------------------------------------------
// Log level config
// ---------------------------------------------------------------------------

const LOG_LEVELS = ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'DEBUG', 'CRITICAL', 'TIMING', 'STEP', 'FOCUS', 'STATUS'] as const
type LogLevel = typeof LOG_LEVELS[number]

const LINE_COUNT_OPTIONS = [100, 500, 1000, 2000, 5000] as const

const levelColors: Record<string, { text: string; bg: string; border: string }> = {
  INFO: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  SUCCESS: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  WARNING: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  ERROR: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  DEBUG: { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  CRITICAL: { text: 'text-rose-500', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  TIMING: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  STEP: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  FOCUS: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  STATUS: { text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
}

/** Map level names to the stat-level key used in LogStatsResponse */
const levelStatKey: Record<string, keyof LogStatsResponse['levels']> = {
  ERROR: 'error',
  CRITICAL: 'critical',
  WARNING: 'warning',
  SUCCESS: 'success',
  INFO: 'info',
  DEBUG: 'debug',
  STEP: 'step',
  TIMING: 'timing',
}

function getLineLevel(line: string): string | null {
  const match = line.match(/\[([A-Z]+)\]/)
  if (match && match[1] in levelColors) return match[1]
  return null
}

function getLineColorClass(line: string): string {
  const level = getLineLevel(line)
  if (!level) return 'text-slate-400'
  return levelColors[level]?.text ?? 'text-slate-400'
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type TabId = 'logs' | 'live' | 'archives'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Logs() {
  const [searchQuery, setSearchQuery] = useState('')
  const [serverSearch, setServerSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [activeLevels, setActiveLevels] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [copied, setCopied] = useState(false)
  const [lineCount, setLineCount] = useState(500)
  const [serverLevel, setServerLevel] = useState('')
  const [showStats, setShowStats] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('logs')
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Stats & archives state (fetched on demand)
  const [stats, setStats] = useState<LogStatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<Error | null>(null)
  const [archives, setArchives] = useState<LogArchivesResponse | null>(null)
  const [archivesLoading, setArchivesLoading] = useState(false)
  const [archivesError, setArchivesError] = useState<Error | null>(null)

  const setLogs = useLogStore((s) => s.setLogs)
  const isConnected = useConnectionStore((s) => s.status) === 'connected'

  // Server-side filtered fetch function
  const fetchFn = useCallback(() => {
    return fetchLogsFiltered({
      lines: lineCount,
      level: serverLevel || undefined,
      search: serverSearch || undefined,
    })
  }, [lineCount, serverLevel, serverSearch])

  const { data, loading, error, refresh } = usePolling<LogsResponse>(fetchFn, 3000, {
    enabled: isConnected,
  })

  // Sync to store
  useEffect(() => {
    if (data) setLogs(data.logs, data.log_file)
  }, [data, setLogs])

  const rawLogs = data?.logs ?? ''
  const logFile = data?.log_file ?? ''

  // Split into lines for filtering and counting
  const allLines = useMemo(() => {
    if (!rawLogs) return []
    return rawLogs.split('\n').filter((l) => l.length > 0)
  }, [rawLogs])

  // Level statistics (client-side from visible lines)
  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const line of allLines) {
      const level = getLineLevel(line)
      if (level) counts[level] = (counts[level] ?? 0) + 1
    }
    return counts
  }, [allLines])

  // Filtered lines based on search and level filters (client-side)
  const filteredLines = useMemo(() => {
    let lines = allLines
    // Level filter (client-side, in addition to server-side)
    if (activeLevels.size > 0) {
      lines = lines.filter((line) => {
        const level = getLineLevel(line)
        return level ? activeLevels.has(level) : false
      })
    }
    // Text search (client-side)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      lines = lines.filter((line) => line.toLowerCase().includes(q))
    }
    return lines
  }, [allLines, searchQuery, activeLevels])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [filteredLines, autoScroll])

  // Detect manual scroll to auto-disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return
    const el = logContainerRef.current
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (autoScroll && !isAtBottom) {
      setAutoScroll(false)
    }
  }, [autoScroll])

  const scrollToBottom = useCallback(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
    setAutoScroll(true)
  }, [])

  // Toggle level filter — also pass to server for performance
  const toggleLevel = useCallback((level: string) => {
    setActiveLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)

      // If exactly one level is active, pass it to server for server-side filtering
      if (next.size === 1) {
        const [only] = next
        setServerLevel(only)
      } else {
        setServerLevel('')
      }

      return next
    })
  }, [])

  // Copy logs to clipboard
  const handleCopy = useCallback(() => {
    const text = filteredLines.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [filteredLines])

  // Download logs as file
  const handleDownload = useCallback(() => {
    const text = filteredLines.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `docker-services-${new Date().toISOString().slice(0, 10)}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [filteredLines])

  // Fetch stats on demand
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const result = await fetchLogStats()
      setStats(result)
    } catch (err: unknown) {
      setStatsError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // Toggle stats panel
  const handleToggleStats = useCallback(() => {
    const willOpen = !showStats
    setShowStats(willOpen)
    if (willOpen) loadStats()
  }, [showStats, loadStats])

  // Fetch archives on demand
  const loadArchives = useCallback(async () => {
    setArchivesLoading(true)
    setArchivesError(null)
    try {
      const result = await fetchLogArchives()
      setArchives(result)
    } catch (err: unknown) {
      setArchivesError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setArchivesLoading(false)
    }
  }, [])

  // Load archives when switching to that tab
  useEffect(() => {
    if (activeTab === 'archives') loadArchives()
  }, [activeTab, loadArchives])

  const hasFilters = activeLevels.size > 0 || searchQuery.trim().length > 0

  // Compute max level count for proportional bars in stats
  const statsMaxCount = useMemo(() => {
    if (!stats) return 1
    const counts = Object.values(stats.levels)
    return Math.max(...counts, 1)
  }, [stats])

  return (
    <div className="space-y-4 flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
      <DisconnectedBanner />
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base md:text-xl font-bold text-slate-100">Log Viewer</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {logFile ? (
              <span className="font-mono text-xs">{logFile}</span>
            ) : (
              'Application log output'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats toggle */}
          <button
            onClick={handleToggleStats}
            className={`
              flex items-center gap-1.5 rounded-lg px-3 py-2
              text-xs font-medium border transition-all duration-200
              ${showStats
                ? 'text-violet-400 bg-violet-500/10 border-violet-500/20'
                : 'text-slate-300 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/15'
              }
            `}
            title="Toggle log statistics"
          >
            <BarChart3 size={14} />
            Stats
          </button>
          <button
            onClick={handleCopy}
            className="
              flex items-center gap-1.5 rounded-lg px-3 py-2
              text-xs font-medium text-slate-300
              bg-white/5 border border-white/10
              hover:bg-white/10 hover:border-white/15
              transition-all duration-200
            "
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            disabled={filteredLines.length === 0}
            className="
              flex items-center gap-1.5 rounded-lg px-3 py-2
              text-xs font-medium text-slate-300
              bg-white/5 border border-white/10
              hover:bg-white/10 hover:border-white/15
              disabled:opacity-50 transition-all duration-200
            "
            title="Download logs"
          >
            <Download size={14} />
            Export
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
            Refresh
          </button>
        </div>
      </div>

      {/* Stats panel (collapsible) */}
      {showStats && (
        <div className="glass-subtle rounded-xl overflow-hidden shrink-0 animate-fade-in">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-200">Log Statistics</h3>
            {statsLoading && <RefreshCw size={12} className="animate-spin text-slate-500 ml-auto" />}
            {!statsLoading && (
              <button
                onClick={loadStats}
                className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                Refresh
              </button>
            )}
          </div>

          <div className="p-5">
            {statsError && (
              <p className="text-sm text-rose-400">Failed to load stats: {statsError.message}</p>
            )}

            {statsLoading && !stats && (
              <p className="text-sm text-slate-500">Loading statistics...</p>
            )}

            {stats && (
              <div className="space-y-4">
                {/* Overview row */}
                <div className="flex items-center gap-4 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <FileText size={13} className="text-slate-500" />
                    <span className="font-medium text-slate-300">{stats.total_lines.toLocaleString()}</span> lines
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="font-medium text-slate-300">{stats.file_size}</span> file size
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="font-medium text-slate-300">{stats.sessions}</span> sessions
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Archive size={13} className="text-slate-500" />
                    <span className="font-medium text-slate-300">{stats.archives.count}</span> archives
                    <span className="text-slate-500">({stats.archives.total_size})</span>
                  </div>
                </div>

                {/* Level count badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(['ERROR', 'CRITICAL', 'WARNING', 'SUCCESS', 'INFO', 'DEBUG', 'STEP', 'TIMING'] as const).map((level) => {
                    const key = levelStatKey[level]
                    if (!key) return null
                    const count = stats.levels[key]
                    const colors = levelColors[level]
                    if (!colors) return null
                    return (
                      <span
                        key={level}
                        className={`
                          inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
                          text-[11px] font-medium border
                          ${colors.text} ${colors.bg} ${colors.border}
                        `}
                      >
                        {level}
                        <span className="font-semibold">{count.toLocaleString()}</span>
                      </span>
                    )
                  })}
                </div>

                {/* Proportional bars */}
                <div className="space-y-1.5">
                  {(['ERROR', 'CRITICAL', 'WARNING', 'SUCCESS', 'INFO', 'DEBUG', 'STEP', 'TIMING'] as const).map((level) => {
                    const key = levelStatKey[level]
                    if (!key) return null
                    const count = stats.levels[key]
                    if (count === 0) return null
                    const colors = levelColors[level]
                    if (!colors) return null
                    const widthPx = Math.max(2, Math.round((count / statsMaxCount) * 120))
                    return (
                      <div key={level} className="flex items-center gap-2 text-[10px]">
                        <span className={`w-16 text-right font-medium ${colors.text}`}>{level}</span>
                        <div
                          className={`h-2 rounded-full ${colors.bg} border ${colors.border}`}
                          style={{ width: `${widthPx}px` }}
                        />
                        <span className="text-slate-500">{count.toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="glass rounded-xl p-4 border-rose-500/30 shrink-0">
          <p className="text-sm text-rose-400">Failed to fetch logs: {error.message}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('logs')}
          className={`
            flex items-center gap-1.5 rounded-lg px-3 py-2
            text-xs font-medium border transition-all duration-200
            ${activeTab === 'logs'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-slate-400 bg-white/5 border-white/[0.08] hover:bg-white/[0.08]'
            }
          `}
        >
          <ScrollText size={14} />
          Logs
        </button>
        <button
          onClick={() => setActiveTab('live')}
          className={`
            flex items-center gap-1.5 rounded-lg px-3 py-2
            text-xs font-medium border transition-all duration-200
            ${activeTab === 'live'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-slate-400 bg-white/5 border-white/[0.08] hover:bg-white/[0.08]'
            }
          `}
        >
          <Radio size={14} />
          Live
        </button>
        <button
          onClick={() => setActiveTab('archives')}
          className={`
            flex items-center gap-1.5 rounded-lg px-3 py-2
            text-xs font-medium border transition-all duration-200
            ${activeTab === 'archives'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-slate-400 bg-white/5 border-white/[0.08] hover:bg-white/[0.08]'
            }
          `}
        >
          <Archive size={14} />
          Archives
        </button>
      </div>

      {/* ================================================================= */}
      {/* LOGS TAB */}
      {/* ================================================================= */}
      {activeTab === 'logs' && (
        <>
          {/* Controls bar */}
          <div className="flex items-center flex-wrap gap-3 shrink-0">
            {/* Search input */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search logs..."
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
            </div>

            {/* Lines dropdown */}
            <div className="relative shrink-0">
              <select
                value={lineCount}
                onChange={(e) => setLineCount(Number(e.target.value))}
                className="
                  appearance-none rounded-lg pl-3 pr-8 py-2
                  text-xs font-medium text-slate-300
                  bg-slate-900/60 border border-white/[0.08]
                  focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20
                  transition-all duration-200 cursor-pointer
                "
              >
                {LINE_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} lines</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                flex items-center gap-1.5 rounded-lg px-3 py-2
                text-xs font-medium border transition-all duration-200
                ${showFilters || activeLevels.size > 0
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-slate-400 bg-white/5 border-white/[0.08] hover:bg-white/[0.08]'
                }
              `}
            >
              <Filter size={14} />
              Filters
              {activeLevels.size > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-semibold">{activeLevels.size}</span>
              )}
            </button>

            {/* Line count */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
              <FileText size={14} />
              <span>
                {hasFilters
                  ? `${filteredLines.length} / ${allLines.length}`
                  : `${allLines.length}`} lines
              </span>
            </div>

            {/* Auto-scroll toggle */}
            <button
              onClick={() => {
                if (!autoScroll) scrollToBottom()
                else setAutoScroll(false)
              }}
              className={`
                flex items-center gap-1.5 rounded-lg px-3 py-2
                text-xs font-medium border transition-all duration-200
                ${
                  autoScroll
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-slate-400 bg-white/5 border-white/[0.08] hover:bg-white/[0.08]'
                }
              `}
              title={autoScroll ? 'Auto-scroll is ON' : 'Auto-scroll is OFF'}
            >
              <ArrowDownToLine size={14} />
              Auto
            </button>
          </div>

          {/* Level filter chips */}
          {showFilters && (
            <div className="flex items-center gap-2 flex-wrap shrink-0 animate-fade-in">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Filter by level:</span>
              {LOG_LEVELS.filter((l) => (levelCounts[l] ?? 0) > 0).map((level) => {
                const active = activeLevels.has(level)
                const colors = levelColors[level]
                return (
                  <button
                    key={level}
                    onClick={() => toggleLevel(level)}
                    className={`
                      flex items-center gap-1.5 rounded-full px-2.5 py-1
                      text-[11px] font-medium border transition-all duration-200
                      ${active
                        ? `${colors.text} ${colors.bg} ${colors.border}`
                        : 'text-slate-500 bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                      }
                    `}
                  >
                    {level}
                    <span className={`text-[10px] ${active ? 'opacity-80' : 'opacity-50'}`}>
                      {levelCounts[level] ?? 0}
                    </span>
                  </button>
                )
              })}
              {activeLevels.size > 0 && (
                <button
                  onClick={() => {
                    setActiveLevels(new Set())
                    setServerLevel('')
                  }}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Log output area */}
          <div className="glass-subtle rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2 shrink-0">
              <ScrollText size={16} className="text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">Output</h3>
              {loading && (
                <RefreshCw size={12} className="animate-spin text-slate-500 ml-auto" />
              )}
            </div>

            <div
              ref={logContainerRef}
              onScroll={handleScroll}
              className="
                flex-1 overflow-auto p-4
                bg-slate-950 border-t border-white/[0.04]
                text-xs leading-relaxed
                font-mono
                scrollbar-thin select-text
              "
            >
              {loading && filteredLines.length === 0 && (
                <span className="text-slate-600">Loading logs...</span>
              )}
              {!loading && filteredLines.length === 0 && (
                <span className="text-slate-600">
                  {hasFilters ? 'No lines match your filters.' : 'No log data available.'}
                </span>
              )}
              {filteredLines.map((line, idx) => (
                <div key={idx} className={`${getLineColorClass(line)} hover:bg-white/[0.02] px-1 -mx-1 rounded`}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* LIVE TAB */}
      {/* ================================================================= */}
      {activeTab === 'live' && (
        <div className="flex-1 min-h-0">
          <LiveLogViewer initialLines={200} pollInterval={2000} maxLines={5000} />
        </div>
      )}

      {/* ================================================================= */}
      {/* ARCHIVES TAB */}
      {/* ================================================================= */}
      {activeTab === 'archives' && (
        <div className="glass-subtle rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2 shrink-0">
            <Archive size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">Archived Logs</h3>
            {archives && (
              <span className="text-xs text-slate-500 ml-1">
                ({archives.archives.length} files, {archives.total_size} total)
              </span>
            )}
            {archivesLoading && <RefreshCw size={12} className="animate-spin text-slate-500 ml-auto" />}
            {!archivesLoading && (
              <button
                onClick={loadArchives}
                className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {archivesError && (
              <div className="p-5">
                <p className="text-sm text-rose-400">Failed to load archives: {archivesError.message}</p>
              </div>
            )}

            {archivesLoading && !archives && (
              <div className="p-5">
                <p className="text-sm text-slate-500">Loading archives...</p>
              </div>
            )}

            {archives && archives.archives.length === 0 && (
              <div className="p-5">
                <p className="text-sm text-slate-500">No archived log files found.</p>
              </div>
            )}

            {archives && archives.archives.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left">
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Filename</th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Size</th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {archives.archives.map((archive) => (
                    <tr
                      key={archive.filename}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="font-mono text-slate-300">{archive.filename}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-400">{archive.size}</td>
                      <td className="px-5 py-3 text-slate-400">{archive.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
