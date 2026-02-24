// =============================================================================
// ContainerList — Full container table with sorting, filtering, and selection
// =============================================================================

import React, { useState, useMemo } from 'react'
import { ContainerInfo } from '../../../shared/types'
import { useContainerStore } from '../../stores/containerStore'
import ContainerRow from './ContainerRow'
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

  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * mult
  }

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
}

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'state', label: 'State' },
  { key: 'health', label: 'Health' },
  { key: 'image', label: 'Image' },
  { key: 'uptime_seconds', label: 'Uptime' },
  { key: 'ports', label: 'Ports' },
  { key: 'restart_count', label: 'Restarts', align: 'center' },
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

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig>({ key: 'name', direction: 'asc' })
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped' | 'paused'>('all')

  // Filter by tab + search
  const filtered = useMemo(() => {
    let result = containers
    // Apply tab filter
    if (filter === 'running') {
      result = result.filter((c) => c.state.toLowerCase() === 'running')
    } else if (filter === 'stopped') {
      result = result.filter((c) => ['exited', 'dead', 'stopped'].includes(c.state.toLowerCase()))
    } else if (filter === 'paused') {
      result = result.filter((c) => c.state.toLowerCase() === 'paused')
    }
    // Apply text search
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

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      compareValues(a[sort.key], b[sort.key], sort.direction),
    )
  }, [filtered, sort])

  // Toggle sort column
  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  // Summary counts
  const runningCount = containers.filter((c) => c.state.toLowerCase() === 'running').length
  const stoppedCount = containers.filter(
    (c) => c.state.toLowerCase() === 'exited' || c.state.toLowerCase() === 'dead',
  ).length
  const pausedCount = containers.filter((c) => c.state.toLowerCase() === 'paused').length

  // Sort indicator icon
  const SortIcon: React.FC<{ columnKey: SortKey }> = ({ columnKey }) => {
    if (sort.key !== columnKey) {
      return <ChevronsUpDown className="h-3 w-3 text-slate-600" />
    }
    return sort.direction === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-emerald-400" />
    ) : (
      <ChevronDown className="h-3 w-3 text-emerald-400" />
    )
  }

  return (
    <div className="flex flex-col gap-5 animate-in">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Containers</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage and monitor all Docker containers
          </p>
        </div>
      </div>

      {/* ---- Summary cards ---- */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard
          icon={<Box className="h-4 w-4 text-cyan-400" />}
          label="Total"
          value={containers.length}
          color="cyan"
        />
        <SummaryCard
          icon={<CircleCheck className="h-4 w-4 text-emerald-400" />}
          label="Running"
          value={runningCount}
          color="emerald"
        />
        <SummaryCard
          icon={<CircleX className="h-4 w-4 text-rose-400" />}
          label="Stopped"
          value={stoppedCount}
          color="rose"
        />
        <SummaryCard
          icon={<CirclePause className="h-4 w-4 text-amber-400" />}
          label="Paused"
          value={pausedCount}
          color="amber"
        />
      </div>

      {/* ---- Filter tabs ---- */}
      <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.05] rounded-xl p-1">
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
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-200
                ${filter === filterVal
                  ? `${activeBgMap[filterVal]} ${colorMap[filterVal]}`
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }
              `}
            >
              {labelMap[filterVal]}
              <span className={`
                text-[10px] px-1.5 py-0.5 rounded-full
                ${filter === filterVal ? 'bg-white/10' : 'bg-white/[0.04]'}
              `}>
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
          placeholder="Search containers by name, image, state, or health..."
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

      {/* ---- Table ---- */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`
                      px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400
                      cursor-pointer select-none hover:text-slate-200 transition-colors
                      ${col.align === 'center' ? 'text-center' : 'text-left'}
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
                  <td colSpan={COLUMNS.length} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
                      <span className="text-sm text-slate-500">Loading containers...</span>
                    </div>
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Box className="h-8 w-8 text-slate-600" />
                      <span className="text-sm text-slate-500">
                        {search ? 'No containers match your search.' : 'No containers found.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((container) => (
                  <ContainerRow
                    key={container.name}
                    container={container}
                    isSelected={selectedName === container.name}
                    onClick={onSelect}
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
// SummaryCard — small stat card used in the top row
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
  <div className={`glass-subtle p-4 flex items-center gap-3 ${GLOW_MAP[color] ?? ''}`}>
    <div className="flex-shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  </div>
)

export default ContainerList
