// =============================================================================
// Disk Analysis — Dedicated disk usage analysis page with charts and deep prune
// =============================================================================

import { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  HardDrive, Trash2, RefreshCw, Loader2, WifiOff,
  Database, Layers, Box, Archive, PieChart,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { fetchMaintenanceDisk, triggerDeepPrune } from '../api/endpoints'
import type { DiskAnalysis as DiskAnalysisData, DiskStackSize, DiskDfEntry } from '../../shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const tooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '10px',
  fontSize: '11px',
  color: '#e2e8f0',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
}

const tooltipLabelStyle = { color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }

/** Color mapping for Docker DF types */
const DF_COLORS: Record<string, string> = {
  Images: '#06b6d4',       // cyan
  Containers: '#10b981',   // emerald
  Volumes: '#f59e0b',      // amber
  'Build Cache': '#8b5cf6', // violet
  'Local Volumes': '#f59e0b',
}

const DF_COLOR_FALLBACK = '#64748b' // slate

/** Icon mapping for Docker DF types */
function dfIcon(type: string) {
  const lower = type.toLowerCase()
  if (lower.includes('image')) return <Layers size={14} className="text-cyan-400" />
  if (lower.includes('container')) return <Box size={14} className="text-emerald-400" />
  if (lower.includes('volume')) return <Database size={14} className="text-amber-400" />
  if (lower.includes('cache')) return <Archive size={14} className="text-violet-400" />
  return <HardDrive size={14} className="text-slate-400" />
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse size strings like "1.2GB", "450MB", "12.5 kB" to MB for chart values */
function parseSizeToMB(s: string): number {
  const match = s.match(/^([\d.]+)\s*([KMGTP]?i?B?)$/i)
  if (!match) return 0
  const num = parseFloat(match[1])
  const unit = match[2].replace(/i?B$/i, '').toUpperCase()
  switch (unit) {
    case 'K': return num / 1024
    case 'M': return num
    case 'G': return num * 1024
    case 'T': return num * 1024 * 1024
    default: return num / (1024 * 1024)
  }
}

/** Parse size strings to bytes for sorting */
function parseSizeToBytes(s: string): number {
  return parseSizeToMB(s) * 1024 * 1024
}

/** Format MB value to a human-friendly label for chart tooltip */
function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${(mb * 1024).toFixed(0)} KB`
}

// ---------------------------------------------------------------------------
// Deep Prune Confirmation Modal
// ---------------------------------------------------------------------------

interface PruneModalProps {
  onConfirm: () => void
  onCancel: () => void
}

function DeepPruneModal({ onConfirm, onCancel }: PruneModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md mx-4 bg-slate-900/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
            <Trash2 size={18} className="text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Deep Prune</h3>
            <p className="text-[10px] text-slate-500">Destructive action</p>
          </div>
        </div>

        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 mb-4">
          <p className="text-xs text-rose-300 leading-relaxed">
            <span className="font-semibold text-rose-400">Warning:</span> This will remove{' '}
            <span className="font-semibold">all</span> unused Docker resources including
            stopped containers, unused networks, dangling and unreferenced images, unused
            volumes, and build cache. Data stored in removed volumes will be{' '}
            <span className="font-semibold text-rose-400">permanently lost</span>.
          </p>
        </div>

        <p className="text-xs text-slate-400 mb-5">
          This action cannot be undone. Only proceed if you are certain no important data
          resides in dangling volumes or unused images.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/25 transition-all"
          >
            <Trash2 size={14} />
            I understand, delete everything
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DiskAnalysis() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  // ---- Polling ----
  const {
    data: disk,
    loading,
    error,
    refresh,
  } = usePolling<DiskAnalysisData>(fetchMaintenanceDisk, 30000, { enabled: isConnected })

  // ---- Action state ----
  const [deepPruning, setDeepPruning] = useState(false)
  const [showPruneModal, setShowPruneModal] = useState(false)

  // ---- Deep prune handler ----
  const handleDeepPrune = useCallback(async () => {
    setShowPruneModal(false)
    setDeepPruning(true)
    try {
      const res = await triggerDeepPrune()
      addToast({
        type: res.success ? 'success' : 'error',
        message: res.success
          ? 'Deep prune completed — all unused resources removed'
          : (res.output || 'Deep prune failed'),
      })
      refresh()
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Deep prune failed',
      })
    } finally {
      setDeepPruning(false)
    }
  }, [addToast, refresh])

  // ---- Derived data ----

  /** Docker DF chart data */
  const dfChartData = useMemo(() => {
    if (!disk?.docker_df?.length) return []
    return disk.docker_df.map((entry: DiskDfEntry) => ({
      name: entry.type,
      sizeMB: parseSizeToMB(entry.size),
      sizeLabel: entry.size,
    }))
  }, [disk])

  /** Stack sizes sorted largest-first */
  const sortedStacks = useMemo(() => {
    if (!disk?.stack_sizes?.length) return []
    return [...disk.stack_sizes].sort(
      (a: DiskStackSize, b: DiskStackSize) => parseSizeToBytes(b.size) - parseSizeToBytes(a.size),
    )
  }, [disk])

  /** Largest stack size in MB for bar width calculations */
  const maxStackMB = useMemo(() => {
    if (!sortedStacks.length) return 1
    return sortedStacks.reduce(
      (max: number, s: DiskStackSize) => Math.max(max, parseSizeToMB(s.size)),
      0,
    ) || 1
  }, [sortedStacks])

  // ---------------------------------------------------------------------------
  // Disconnected state
  // ---------------------------------------------------------------------------

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
          <WifiOff size={24} className="text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">Connect to a server to view disk analysis</p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Loading state (initial)
  // ---------------------------------------------------------------------------

  if (loading && !disk) {
    return (
      <div className="space-y-3 md:space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl skeleton" />
          <div className="space-y-2">
            <div className="w-32 h-4 rounded skeleton" />
            <div className="w-48 h-3 rounded skeleton" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin text-cyan-500/60" />
          <p className="text-sm text-slate-500">Analyzing disk usage...</p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error && !disk) {
    return (
      <div className="space-y-3 md:space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 flex items-center justify-center text-cyan-400">
            <HardDrive size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Disk Analysis</h2>
            <p className="text-xs text-slate-500">Docker disk usage breakdown</p>
          </div>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-md border border-rose-500/15 rounded-xl p-6 text-center">
          <PieChart size={28} className="text-rose-500/40 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-1">Failed to load disk analysis</p>
          <p className="text-xs text-slate-600 mb-4">{error.message}</p>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (disk && !disk.docker_df?.length && !disk.stack_sizes?.length) {
    return (
      <div className="space-y-3 md:space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 flex items-center justify-center text-cyan-400">
            <HardDrive size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Disk Analysis</h2>
            <p className="text-xs text-slate-500">Docker disk usage breakdown</p>
          </div>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-8 md:p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <PieChart size={24} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-400 font-medium mb-1.5">No disk data available</p>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Disk analysis data will appear here once Docker services are running and the
            maintenance endpoint reports usage statistics.
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* Deep Prune Confirmation Modal */}
      {showPruneModal && (
        <DeepPruneModal
          onConfirm={handleDeepPrune}
          onCancel={() => setShowPruneModal(false)}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Page header                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 flex items-center justify-center text-cyan-400">
            <HardDrive size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Disk Analysis</h2>
            <p className="text-xs text-slate-500">
              {disk?.total_app_data
                ? `Total application data: ${disk.total_app_data}`
                : 'Docker disk usage breakdown'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Deep Prune */}
          <button
            onClick={() => setShowPruneModal(true)}
            disabled={deepPruning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-all duration-200 disabled:opacity-50 press"
          >
            {deepPruning ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Trash2 size={13} />
            )}
            <span className="hidden sm:inline">Deep Prune</span>
            <span className="sm:hidden">Prune</span>
          </button>

          {/* Refresh */}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-all duration-200 disabled:opacity-50 press"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Total disk usage hero card                                         */}
      {/* ----------------------------------------------------------------- */}
      {disk?.total_app_data && (
        <div
          className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6 animate-fade-in"
          style={{ animationDelay: '60ms' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 flex items-center justify-center">
              <Database size={22} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold text-slate-100 font-mono tabular-nums">
                {disk.total_app_data}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">
                Total Application Data
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Docker DF breakdown — Chart + Table                                */}
      {/* ----------------------------------------------------------------- */}
      {disk?.docker_df && disk.docker_df.length > 0 && (
        <div
          className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6 animate-fade-in"
          style={{ animationDelay: '120ms' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Layers size={14} className="text-cyan-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Docker System Disk Usage
            </h3>
          </div>

          {/* Horizontal bar chart */}
          {dfChartData.length > 0 && (
            <div className="h-44 md:h-52 mb-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dfChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.5)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatMB(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value: number, _name: string, props: { payload?: { sizeLabel?: string } }) => [
                      props.payload?.sizeLabel ?? formatMB(value),
                      'Size',
                    ]}
                    animationDuration={150}
                  />
                  <Bar
                    dataKey="sizeMB"
                    radius={[0, 6, 6, 0]}
                    animationDuration={600}
                    maxBarSize={28}
                  >
                    {dfChartData.map((entry: { name: string; sizeMB: number; sizeLabel: string }, idx: number) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={DF_COLORS[entry.name] ?? DF_COLOR_FALLBACK}
                        fillOpacity={0.75}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Docker DF table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Active</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Reclaimable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {disk.docker_df.map((row: DiskDfEntry) => (
                  <tr key={row.type} className="hover:bg-white/[0.02] transition-colors duration-150">
                    <td className="px-4 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        {dfIcon(row.type)}
                        <span className="text-slate-200 font-medium">{row.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-300 text-xs">{row.total}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-300 text-xs">{row.active}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-300 text-xs">{row.size}</td>
                    <td className="px-4 py-2 text-right">
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        {row.reclaimable}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Stack sizes section                                                */}
      {/* ----------------------------------------------------------------- */}
      {sortedStacks.length > 0 && (
        <div
          className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6 animate-fade-in"
          style={{ animationDelay: '180ms' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Box size={14} className="text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Per-Stack App Data
              </h3>
            </div>
            <span className="text-[10px] text-slate-600">
              {sortedStacks.length} stack{sortedStacks.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-2.5">
            {sortedStacks.map((entry: DiskStackSize, idx: number) => {
              const pct = Math.max((parseSizeToMB(entry.size) / maxStackMB) * 100, 2)
              return (
                <div
                  key={entry.name}
                  className="animate-fade-in"
                  style={{ animationDelay: `${200 + idx * 40}ms` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-300 font-mono truncate mr-3">{entry.name}</span>
                    <span className="text-xs text-slate-400 font-mono shrink-0">{entry.size}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
