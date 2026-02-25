// =============================================================================
// ContainerList — Full container table + mobile cards with favorites, stats
// =============================================================================

import React, { useState, useMemo, useCallback } from 'react'
import { ContainerInfo } from '../../../shared/types'
import { useContainerStore } from '../../stores/containerStore'
import { startContainer, stopContainer, restartContainer } from '../../api/endpoints'
import ContainerRow, { ContainerCard } from './ContainerRow'
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Box,
  CircleCheck,
  CircleX,
  CirclePause,
  Loader2,
  CheckSquare,
  Square as SquareIcon,
  Play,
  RotateCw,
  X,
  Minus,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortKey = keyof ContainerInfo
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  key: SortKey
  direction: SortDirection
}

function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  const mult = direction === 'asc' ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * mult
  const strA = String(a ?? '').toLowerCase()
  const strB = String(b ?? '').toLowerCase()
  return strA.localeCompare(strB) * mult
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: SortKey
  label: string
  align?: 'left' | 'center' | 'right'
  hiddenClass?: string
}

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'state', label: 'State' },
  { key: 'image', label: 'Resources' },
  { key: 'image', label: 'Image', hiddenClass: 'hidden lg:table-cell' },
  { key: 'uptime_seconds', label: 'Uptime', hiddenClass: 'hidden xl:table-cell' },
  { key: 'restart_count', label: 'Restarts', align: 'center', hiddenClass: 'hidden xl:table-cell' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContainerListProps {
  selectedName: string | null
  onSelect: (name: string) => void
}

const ContainerList: React.FC<ContainerListProps> = ({ selectedName, onSelect }) => {
  const containers = useContainerStore((s) => s.containers)
  const loading = useContainerStore((s) => s.loading)
  const favorites = useContainerStore((s) => s.favorites)
  const toggleFavorite = useContainerStore((s) => s.toggleFavorite)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig>({ key: 'name', direction: 'asc' })
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped' | 'paused'>('all')

  // Batch selection state
  const [batchMode, setBatchMode] = useState(false)
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResults, setBatchResults] = useState<{ name: string; action: string; success: boolean }[] | null>(null)

  const toggleContainer = useCallback((name: string) => {
    setSelectedContainers((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedContainers(new Set(containers.map((c) => c.name)))
  }, [containers])

  const clearSelection = useCallback(() => {
    setSelectedContainers(new Set())
  }, [])

  const handleBatchAction = useCallback(async (action: 'start' | 'stop' | 'restart') => {
    if (selectedContainers.size === 0) return
    setBatchLoading(true)
    setBatchResults(null)
    const results: { name: string; action: string; success: boolean }[] = []
    const actionFn = action === 'start' ? startContainer : action === 'stop' ? stopContainer : restartContainer
    for (const name of selectedContainers) {
      try {
        await actionFn(name)
        results.push({ name, action, success: true })
      } catch {
        results.push({ name, action, success: false })
      }
    }
    setBatchResults(results)
    setBatchLoading(false)
  }, [selectedContainers])

  const exitBatchMode = useCallback(() => {
    setBatchMode(false)
    setSelectedContainers(new Set())
    setBatchResults(null)
  }, [])

  // Filter by tab + search
  const filtered = useMemo(() => {
    let result = containers
    if (filter === 'running') {
      result = result.filter((c) => c.state.toLowerCase() === 'running')
    } else if (filter === 'stopped') {
      result = result.filter((c) => ['exited', 'dead', 'stopped'].includes(c.state.toLowerCase()))
    } else if (filter === 'paused') {
      result = result.filter((c) => c.state.toLowerCase() === 'paused')
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.image.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.health.toLowerCase().includes(q),
      )
    }
    return result
  }, [containers, search, filter])

  // Sort — favorites always first
  const sorted = useMemo(() => {
    const favSet = new Set(favorites)
    return [...filtered].sort((a, b) => {
      // Favorites first
      const aFav = favSet.has(a.name) ? 0 : 1
      const bFav = favSet.has(b.name) ? 0 : 1
      if (aFav !== bFav) return aFav - bFav
      return compareValues(a[sort.key], b[sort.key], sort.direction)
    })
  }, [filtered, sort, favorites])

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  // Summary counts
  const runningCount = containers.filter((c) => c.state.toLowerCase() === 'running').length
  const stoppedCount = containers.filter((c) => ['exited', 'dead'].includes(c.state.toLowerCase())).length
  const pausedCount = containers.filter((c) => c.state.toLowerCase() === 'paused').length

  const SortIcon: React.FC<{ columnKey: SortKey }> = ({ columnKey }) => {
    if (sort.key !== columnKey) return <ChevronsUpDown className="h-3 w-3 text-slate-600" />
    return sort.direction === 'asc'
      ? <ChevronUp className="h-3 w-3 text-emerald-400" />
      : <ChevronDown className="h-3 w-3 text-emerald-400" />
  }

  const favSet = new Set(favorites)

  return (
    <div className="flex flex-col gap-4 md:gap-5 animate-in">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Containers</h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Manage and monitor all Docker containers
          </p>
        </div>
        <button
          onClick={() => batchMode ? exitBatchMode() : setBatchMode(true)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
            border transition-all duration-200
            ${batchMode
              ? 'bg-cyan-500/15 border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/25'
              : 'bg-white/[0.04] border-white/[0.06] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
            }
          `}
        >
          <CheckSquare size={14} />
          <span className="hidden sm:inline">{batchMode ? 'Exit Batch' : 'Batch Select'}</span>
        </button>
      </div>

      {/* ---- Batch Action Bar ---- */}
      {batchMode && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/15 animate-fade-in">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-semibold text-cyan-400">{selectedContainers.size} selected</span>
            <button onClick={selectAll} className="text-[11px] text-slate-400 hover:text-cyan-400 transition-colors">Select All</button>
            <span className="text-white/10">|</span>
            <button onClick={clearSelection} className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors">Clear</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => handleBatchAction('start')} disabled={batchLoading || selectedContainers.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all disabled:opacity-40">
              {batchLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Start
            </button>
            <button onClick={() => handleBatchAction('stop')} disabled={batchLoading || selectedContainers.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-all disabled:opacity-40">
              {batchLoading ? <Loader2 size={12} className="animate-spin" /> : <Minus size={12} />} Stop
            </button>
            <button onClick={() => handleBatchAction('restart')} disabled={batchLoading || selectedContainers.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-all disabled:opacity-40">
              {batchLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />} Restart
            </button>
          </div>
        </div>
      )}

      {/* ---- Batch Results ---- */}
      {batchResults && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Batch Results</p>
            <button onClick={() => setBatchResults(null)} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {batchResults.map((r) => (
              <div key={r.name} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                r.success ? 'bg-emerald-500/[0.06] border-emerald-500/15 text-emerald-400' : 'bg-rose-500/[0.06] border-rose-500/15 text-rose-400'
              }`}>
                {r.success ? <CircleCheck size={12} /> : <CircleX size={12} />}
                <span className="truncate font-medium">{r.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Summary cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<Box className="h-4 w-4 text-cyan-400" />} label="Total" value={containers.length} color="cyan" />
        <SummaryCard icon={<CircleCheck className="h-4 w-4 text-emerald-400" />} label="Running" value={runningCount} color="emerald" />
        <SummaryCard icon={<CircleX className="h-4 w-4 text-rose-400" />} label="Stopped" value={stoppedCount} color="rose" />
        <SummaryCard icon={<CirclePause className="h-4 w-4 text-amber-400" />} label="Paused" value={pausedCount} color="amber" />
      </div>

      {/* ---- Filter tabs ---- */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none bg-white/[0.02] border border-white/[0.05] rounded-xl p-1">
        {(['all', 'running', 'stopped', 'paused'] as const).map((filterVal) => {
          const labelMap = { all: 'All', running: 'Running', stopped: 'Stopped', paused: 'Paused' }
          const countMap = { all: containers.length, running: runningCount, stopped: stoppedCount, paused: pausedCount }
          const colorMap = { all: 'text-cyan-400', running: 'text-emerald-400', stopped: 'text-rose-400', paused: 'text-amber-400' }
          const activeBgMap = { all: 'bg-cyan-500/15', running: 'bg-emerald-500/15', stopped: 'bg-rose-500/15', paused: 'bg-amber-500/15' }
          return (
            <button
              key={filterVal}
              onClick={() => setFilter(filterVal)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                transition-all duration-200
                ${filter === filterVal
                  ? `${activeBgMap[filterVal]} ${colorMap[filterVal]}`
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }
              `}
            >
              {labelMap[filterVal]}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === filterVal ? 'bg-white/10' : 'bg-white/[0.04]'}`}>
                {countMap[filterVal]}
              </span>
            </button>
          )
        })}
      </div>

      {/* ---- Search bar ---- */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search containers..."
          className="
            w-full pl-10 pr-4 py-2.5 rounded-xl text-sm
            bg-white/[0.04] border border-white/[0.08]
            text-slate-200 placeholder-slate-500
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30
            transition-all duration-200
          "
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
            {sorted.length} result{sorted.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ---- Mobile card view ---- */}
      <div className="md:hidden">
        {loading && containers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
            <span className="text-sm text-slate-500">Loading containers...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Box className="h-8 w-8 text-slate-600" />
            <span className="text-sm text-slate-500">{search ? 'No containers match your search.' : 'No containers found.'}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 stagger-children">
            {sorted.map((container) => (
              <ContainerCard
                key={container.name}
                container={container}
                isSelected={selectedName === container.name}
                onClick={batchMode ? () => toggleContainer(container.name) : onSelect}
                batchMode={batchMode}
                batchSelected={selectedContainers.has(container.name)}
                isFavorite={favSet.has(container.name)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- Desktop table ---- */}
      <div className="hidden md:block glass overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {batchMode && (
                  <th className="px-3 py-3 w-10">
                    <button
                      onClick={selectedContainers.size === sorted.length ? clearSelection : selectAll}
                      className="text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                      {selectedContainers.size === sorted.length && sorted.length > 0
                        ? <CheckSquare size={15} className="text-cyan-400" />
                        : <SquareIcon size={15} />
                      }
                    </button>
                  </th>
                )}
                <th className="w-8" />
                {COLUMNS.map((col, idx) => (
                  <th
                    key={`${col.key}-${idx}`}
                    onClick={() => handleSort(col.key)}
                    className={`
                      px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400
                      cursor-pointer select-none hover:text-slate-200 transition-colors
                      ${col.align === 'center' ? 'text-center' : 'text-left'}
                      ${col.hiddenClass ?? ''}
                    `}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <SortIcon columnKey={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && containers.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                      <span className="text-sm text-slate-500">Loading containers...</span>
                    </div>
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Box className="h-8 w-8 text-slate-600" />
                      <span className="text-sm text-slate-500">{search ? 'No containers match your search.' : 'No containers found.'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((container) => (
                  <ContainerRow
                    key={container.name}
                    container={container}
                    isSelected={selectedName === container.name}
                    onClick={batchMode ? () => toggleContainer(container.name) : onSelect}
                    batchMode={batchMode}
                    batchSelected={selectedContainers.has(container.name)}
                    isFavorite={favSet.has(container.name)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SummaryCard
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: number
  color: 'emerald' | 'cyan' | 'rose' | 'amber'
}

const GLOW_MAP: Record<string, string> = {
  emerald: 'glow-emerald',
  cyan: 'glow-cyan',
  rose: 'glow-rose',
  amber: 'glow-amber',
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, color }) => (
  <div className={`glass-subtle p-3 md:p-4 flex items-center gap-3 ${GLOW_MAP[color] ?? ''}`}>
    <div className="flex-shrink-0">{icon}</div>
    <div>
      <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg md:text-xl font-bold text-white">{value}</p>
    </div>
  </div>
)

export default ContainerList
