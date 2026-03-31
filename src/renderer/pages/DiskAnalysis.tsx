// =============================================================================
// Disk Analysis — Dedicated disk usage analysis page with charts and deep prune
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  HardDrive, Trash2, RefreshCw, Loader2, WifiOff,
  Database, Layers, Box, Archive, PieChart,
  Pencil, Check, X,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { fetchMaintenanceDisk, fetchDisks, triggerDeepPrune } from '../api/endpoints'
import type { DiskAnalysis as DiskAnalysisData, DiskStackSize, DiskDfEntry, DiskVolumeSize, DiskInfo } from '../../shared/types'

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

/** Format MB value to a clean human-friendly label */
function formatMB(mb: number): string {
  if (mb >= 1024 * 1024) {
    const tb = mb / (1024 * 1024)
    return tb >= 10 ? `${Math.round(tb)} TB` : `${tb.toFixed(1)} TB`
  }
  if (mb >= 1024) {
    const gb = mb / 1024
    return gb >= 100 ? `${Math.round(gb)} GB` : `${gb.toFixed(1)} GB`
  }
  if (mb >= 1) return `${Math.round(mb)} MB`
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
        className="relative w-full max-w-md mx-4 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/10">
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
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const { addToast } = useToast()

  // ---- Stores ----
  const diskLabels = useSettingsStore((s) => s.diskLabels) ?? {}
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  // Inline rename state for drive cards
  const [renamingMount, setRenamingMount] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // ---- Polling ----
  const {
    data: disk,
    loading,
    error,
    refresh,
  } = usePolling<DiskAnalysisData>(fetchMaintenanceDisk, 30000, { enabled: isConnected })

  // Mounted drives from /disks endpoint (same as Dashboard)
  const { data: disksData } = usePolling<{ total: number; disks: DiskInfo[] }>(fetchDisks, 60000, { enabled: isConnected })
  const mountedDrives = disksData?.disks ?? []

  // Rename handler — writes to shared settingsStore (syncs to Dashboard + Settings)
  const handleRenameLabel = useCallback((mount: string, label: string) => {
    const next = { ...diskLabels }
    if (label) {
      next[mount] = label
    } else {
      delete next[mount]
    }
    updateSetting('diskLabels', next)
    setRenamingMount(null)
  }, [diskLabels, updateSetting])

  // Aggregate totals across all mounted drives (deduplicated by device)
  const storageTotals = useMemo(() => {
    if (!mountedDrives.length) return null
    // Deduplicate by device — some devices mount at multiple paths
    const seen = new Set<string>()
    let totalMB = 0
    let usedMB = 0
    for (const d of mountedDrives) {
      if (seen.has(d.device)) continue
      seen.add(d.device)
      totalMB += parseSizeToMB(d.total)
      usedMB += parseSizeToMB(d.used)
    }
    const freeMB = totalMB - usedMB
    const pct = totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0
    return {
      total: formatMB(totalMB),
      used: formatMB(usedMB),
      free: formatMB(freeMB),
      percent: pct,
      driveCount: seen.size,
    }
  }, [mountedDrives])

  // ---- Action state ----
  const [deepPruning, setDeepPruning] = useState(false)
  const [showPruneModal, setShowPruneModal] = useState(false)

  // Close topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showPruneModal) { setShowPruneModal(false); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showPruneModal])

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
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
          <WifiOff size={24} className="text-slate-500" />
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
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/5">
            <HardDrive size={24} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold"><span className="text-gradient">Disk Analysis</span></h1>
            <p className="text-sm text-slate-400 mt-0.5">Docker disk usage breakdown</p>
          </div>
        </div>
        <div className="glass border border-rose-500/15 rounded-xl p-6 text-center">
          <PieChart size={28} className="text-rose-500/40 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-1">Failed to load disk analysis</p>
          <p className="text-xs text-slate-500 mb-4">{error.message}</p>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 transition-colors"
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
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/5">
            <HardDrive size={24} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold"><span className="text-gradient">Disk Analysis</span></h1>
            <p className="text-sm text-slate-400 mt-0.5">Docker disk usage breakdown</p>
          </div>
        </div>
        <div className="glass border border-white/5 rounded-xl p-8 md:p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center mx-auto mb-4">
            <PieChart size={24} className="text-slate-500" />
          </div>
          <p className="text-sm text-slate-400 font-medium mb-1.5">No disk data available</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
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
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/5">
            <HardDrive size={24} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold"><span className="text-gradient">Disk Analysis</span></h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {storageTotals
                ? <>
                    <span className="text-slate-300">{storageTotals.used}</span>
                    {' used of '}
                    <span className="text-slate-300">{storageTotals.total}</span>
                    {' across '}
                    <span className="text-slate-300">{storageTotals.driveCount}</span>
                    {' drive'}{storageTotals.driveCount !== 1 ? 's' : ''}
                    {' '}
                    <span className={`font-semibold ${storageTotals.percent > 80 ? 'text-amber-400' : storageTotals.percent > 60 ? 'text-slate-300' : 'text-emerald-400'}`}>
                      ({storageTotals.percent}%)
                    </span>
                  </>
                : disk?.host_disk?.percent
                  ? `${disk.host_disk.used} of ${disk.host_disk.total} used (${disk.host_disk.percent})`
                  : 'Docker disk usage breakdown'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Deep Prune — admin only */}
          {isAdmin && (
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
          )}

          {/* Refresh */}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 transition-all duration-200 disabled:opacity-50 press"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Overview stat cards                                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
        {/* Total App Data */}
        <div className="glass border border-white/5 rounded-xl p-4 hover:border-cyan-500/15 transition-all duration-200 glow-cyan">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center shrink-0">
              <Database size={18} className="text-cyan-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-100 font-mono tabular-nums truncate">
                {disk?.total_app_data && disk.total_app_data !== 'N/A' ? disk.total_app_data : '—'}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">App Data</p>
            </div>
          </div>
        </div>

        {/* Total Storage (aggregate across all drives) */}
        <div className="glass border border-white/5 rounded-xl p-4 hover:border-emerald-500/15 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0">
              <HardDrive size={18} className="text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-100 font-mono tabular-nums truncate">
                {storageTotals?.total ?? disk?.host_disk?.total ?? '—'}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Storage</p>
            </div>
          </div>
        </div>

        {/* Used */}
        <div className="glass border border-white/5 rounded-xl p-4 hover:border-amber-500/15 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center shrink-0">
              <PieChart size={18} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-100 font-mono tabular-nums truncate">
                {storageTotals?.used ?? disk?.host_disk?.used ?? '—'}
                {(storageTotals || disk?.host_disk?.percent) && (
                  <span className={`text-xs ml-1.5 ${
                    (storageTotals?.percent ?? parseInt(disk?.host_disk?.percent ?? '0')) > 80 ? 'text-amber-400' : 'text-slate-500'
                  }`}>
                    {storageTotals ? `${storageTotals.percent}%` : disk?.host_disk?.percent}
                  </span>
                )}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Used</p>
            </div>
          </div>
        </div>

        {/* Available */}
        <div className="glass border border-white/5 rounded-xl p-4 hover:border-sky-500/15 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/15 flex items-center justify-center shrink-0">
              <Archive size={18} className="text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-100 font-mono tabular-nums truncate">
                {storageTotals?.free ?? disk?.host_disk?.available ?? '—'}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate storage bar */}
      {storageTotals && (() => {
        const pct = storageTotals.percent
        const barGradient = pct > 90
          ? 'bg-gradient-to-r from-rose-500 to-red-500 shadow-rose-500/20'
          : pct > 75
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/20'
            : 'bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-emerald-500/20'
        const barTextColor = pct > 90 ? 'text-rose-400' : pct > 75 ? 'text-amber-400' : 'text-emerald-400'
        return (
          <div className="glass border border-white/5 rounded-xl p-5 animate-fade-in" style={{ animationDelay: '60ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Storage</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500 border border-white/5">
                  {storageTotals.driveCount} drive{storageTotals.driveCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">
                  <span className="text-slate-300 font-medium">{storageTotals.used}</span>
                  <span className="text-slate-600 mx-0.5">/</span>
                  {storageTotals.total}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300 font-medium">{storageTotals.free}</span>
                <span className="text-slate-500 ml-0.5">free</span>
              </div>
            </div>
            <div className="relative h-4 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 shadow-lg ${barGradient}`}
                style={{ width: `${pct}%` }}
              />
              {pct > 8 && (
                <span className={`absolute inset-y-0 left-0 flex items-center text-[9px] font-bold tracking-wider ${barTextColor}`}
                  style={{ paddingLeft: `max(8px, calc(${pct}% - 24px))` }}>
                  {pct}%
                </span>
              )}
            </div>
          </div>
        )
      })()}

      {/* ----------------------------------------------------------------- */}
      {/* Mounted Drives                                                     */}
      {/* ----------------------------------------------------------------- */}
      {mountedDrives.length > 0 && (
        <div
          className="glass border border-white/5 rounded-xl p-4 md:p-6 animate-fade-in"
          style={{ animationDelay: '90ms' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive size={14} className="text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Mounted Drives
              </h3>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500 border border-white/5">
              {mountedDrives.length} drive{mountedDrives.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...mountedDrives]
              .sort((a, b) => parseInt(b.percent) - parseInt(a.percent))
              .map((d) => {
                const pct = parseInt(d.percent.replace('%', '')) || 0
                const label = diskLabels[d.mount] || ''
                const displayName = label || d.mount
                const barColor = pct >= 90
                  ? 'from-rose-500 to-red-500'
                  : pct >= 75
                    ? 'from-amber-500 to-orange-500'
                    : 'from-emerald-500 to-cyan-500'
                const textColor = pct >= 90 ? 'text-rose-400' : pct >= 75 ? 'text-amber-400' : 'text-emerald-400'
                const glowColor = pct >= 90 ? 'shadow-rose-500/10' : pct >= 75 ? 'shadow-amber-500/10' : 'shadow-emerald-500/10'

                return (
                  <div
                    key={d.mount}
                    className={`group/drive rounded-xl bg-slate-800/40 border border-white/[0.04] hover:border-white/[0.08] p-4 transition-all duration-200 hover:shadow-lg ${glowColor}`}
                  >
                    {/* Header: name + percent */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <HardDrive size={13} className={`${textColor} shrink-0`} />
                        {renamingMount === d.mount ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' ? handleRenameLabel(d.mount, renameValue.trim()) : e.key === 'Escape' ? setRenamingMount(null) : null}
                              autoFocus
                              placeholder={d.mount}
                              className="flex-1 min-w-0 bg-slate-900/60 border border-cyan-500/30 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                            />
                            <button onClick={() => handleRenameLabel(d.mount, renameValue.trim())} className="text-emerald-400 hover:text-emerald-300 shrink-0"><Check size={12} /></button>
                            <button onClick={() => setRenamingMount(null)} className="text-slate-500 hover:text-slate-300 shrink-0"><X size={12} /></button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-semibold text-slate-200 truncate" title={d.mount}>
                              {displayName}
                            </span>
                            <button
                              onClick={() => { setRenameValue(label); setRenamingMount(d.mount) }}
                              className="opacity-0 group-hover/drive:opacity-100 text-slate-500 hover:text-slate-400 transition-opacity shrink-0"
                              title="Rename drive"
                            >
                              <Pencil size={10} />
                            </button>
                          </>
                        )}
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${textColor} shrink-0 ml-2`}>
                        {d.percent}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="relative h-3 rounded-full bg-slate-800/80 overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700 ease-out ${pct >= 90 ? 'animate-pulse' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                      {pct > 12 && (
                        <span
                          className={`absolute inset-y-0 flex items-center text-[8px] font-bold ${textColor}`}
                          style={{ left: `max(6px, calc(${pct}% - 24px))` }}
                        >
                          {d.percent}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">
                        <span className="text-slate-300 font-medium">{d.used}</span>
                        <span className="text-slate-600 mx-0.5">/</span>
                        <span>{d.total}</span>
                      </span>
                      <span className="text-slate-500">
                        <span className="text-slate-300 font-medium">{d.available}</span>
                        <span className="ml-0.5">free</span>
                      </span>
                    </div>

                    {/* Device + mount path */}
                    <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-600 font-mono truncate">
                      <span title={d.device}>{d.device}</span>
                      {label && (
                        <>
                          <span className="text-slate-700">&rarr;</span>
                          <span title={d.mount}>{d.mount}</span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Docker DF breakdown — Chart + Table                                */}
      {/* ----------------------------------------------------------------- */}
      {disk?.docker_df && disk.docker_df.length > 0 && (
        <div
          className="glass border border-white/5 rounded-xl p-4 md:p-6 animate-fade-in"
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
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Active</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Reclaimable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {disk.docker_df.map((row: DiskDfEntry) => (
                  <tr key={row.type} className="hover:bg-white/[0.03] transition-colors duration-150">
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
          className="glass border border-white/5 rounded-xl p-4 md:p-6 animate-fade-in"
          style={{ animationDelay: '180ms' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Box size={14} className="text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Per-Stack App Data
              </h3>
            </div>
            <span className="text-[10px] text-slate-500">
              {sortedStacks.length} stack{sortedStacks.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-2.5 stagger-children">
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

      {/* ----------------------------------------------------------------- */}
      {/* Docker Volumes                                                     */}
      {/* ----------------------------------------------------------------- */}
      {disk?.volumes && disk.volumes.length > 0 && (
        <div
          className="glass border border-white/5 rounded-xl p-4 md:p-6 animate-fade-in"
          style={{ animationDelay: '240ms' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-violet-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Docker Volumes
              </h3>
            </div>
            <span className="text-[10px] text-slate-500">
              {disk.volumes.length} volume{disk.volumes.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {disk.volumes
              .sort((a: DiskVolumeSize, b: DiskVolumeSize) => parseSizeToBytes(b.size) - parseSizeToBytes(a.size))
              .map((vol: DiskVolumeSize) => (
              <div
                key={vol.name}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.03] hover:border-violet-500/15 transition-all"
              >
                <span className="text-[11px] text-slate-400 font-mono truncate mr-3" title={vol.name}>
                  {vol.name.length > 30 ? `...${vol.name.slice(-27)}` : vol.name}
                </span>
                <span className="text-[11px] text-slate-300 font-mono shrink-0 font-medium">{vol.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
