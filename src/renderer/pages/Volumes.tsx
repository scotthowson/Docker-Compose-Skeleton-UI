// =============================================================================
// Volumes — Docker volume management with search, sort, delete & batch ops
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  HardDrive,
  Search,
  Trash2,
  Loader2,
  AlertTriangle,
  Database,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  X,
  AlertCircle,
  FolderOpen,
  CheckSquare,
  Square,
  CheckCircle2,
  XCircle,
  ListChecks,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/common/Toast'
import { fetchVolumes, deleteVolume } from '../api/endpoints'
import type { VolumeInfo, VolumeListResponse } from '../../shared/types'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOLUME_POLL_INTERVAL = 30_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

type SortField = 'name' | 'size'

// ---------------------------------------------------------------------------
// Batch result type
// ---------------------------------------------------------------------------

interface BatchResult {
  name: string
  success: boolean
  message: string
}

// ---------------------------------------------------------------------------
// Skeleton Rows
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="px-5 py-4">
        <div className="h-4 w-48 bg-white/[0.06] rounded-md animate-pulse" />
      </td>
      <td className="px-5 py-4">
        <div className="h-5 w-16 bg-white/[0.06] rounded-full animate-pulse" />
      </td>
      <td className="px-5 py-4">
        <div className="h-4 w-64 bg-white/[0.06] rounded-md animate-pulse" />
      </td>
      <td className="px-5 py-4 text-right">
        <div className="h-4 w-16 bg-white/[0.06] rounded-md animate-pulse ml-auto" />
      </td>
      <td className="px-5 py-4 text-right">
        <div className="h-6 w-6 bg-white/[0.06] rounded-md animate-pulse ml-auto" />
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({
  volumeName,
  onClose,
  onConfirm,
}: {
  volumeName: string
  onClose: () => void
  onConfirm: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const { addToast } = useToast()

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setError('')
    try {
      await deleteVolume(volumeName)
      addToast({
        type: 'success',
        message: `Volume "${volumeName}" deleted successfully`,
      })
      onConfirm()
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete volume'
      setError(message)
      addToast({
        type: 'error',
        message: `Failed to delete "${volumeName}": ${message}`,
        duration: 6000,
      })
    } finally {
      setDeleting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 glass p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
            <AlertTriangle size={18} className="text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Delete Volume</h3>
            <p className="text-[10px] text-slate-500">This action cannot be undone</p>
          </div>
        </div>

        {/* Warning message */}
        <div className="rounded-lg bg-rose-500/5 border border-rose-500/10 p-4 mb-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Are you sure you want to permanently delete the volume{' '}
            <span className="font-mono text-slate-200 bg-white/[0.06] px-1.5 py-0.5 rounded">
              {volumeName}
            </span>
            ?
          </p>
          <p className="text-xs text-rose-400/80 mt-2 flex items-center gap-1.5">
            <AlertTriangle size={11} className="shrink-0" />
            All data stored in this volume will be permanently lost.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 mb-4">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="
              flex-1 py-2.5 rounded-lg text-sm text-slate-400
              bg-white/5 border border-white/10
              hover:bg-white/10 hover:text-slate-200
              transition-all duration-200
            "
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="
              flex-1 flex items-center justify-center gap-2
              py-2.5 rounded-lg text-sm font-semibold text-white
              bg-rose-500 hover:bg-rose-400
              shadow-lg shadow-rose-500/25
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 press
            "
          >
            {deleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {deleting ? 'Deleting...' : 'Delete Volume'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Batch Delete Confirmation Modal
// ---------------------------------------------------------------------------

function BatchDeleteConfirmModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number
  onClose: () => void
  onConfirm: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const expected = String(count)

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 glass p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
            <AlertTriangle size={18} className="text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Batch Delete Volumes</h3>
            <p className="text-[10px] text-slate-500">This action cannot be undone</p>
          </div>
        </div>

        {/* Warning message */}
        <div className="rounded-lg bg-rose-500/5 border border-rose-500/10 p-4 mb-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            You are about to permanently delete{' '}
            <span className="font-semibold text-rose-400">{count}</span>{' '}
            volume{count !== 1 ? 's' : ''}. All data stored in these volumes will be lost.
          </p>
          <p className="text-xs text-slate-500 mt-3">
            Type <span className="font-mono text-slate-300 bg-white/[0.06] px-1.5 py-0.5 rounded">{expected}</span> to confirm:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expected}
            className="
              mt-2 w-full px-3 py-2
              bg-white/[0.03] border border-white/[0.08] rounded-lg
              text-sm text-slate-200 placeholder-slate-600
              focus:outline-none focus:border-rose-500/30 focus:ring-1 focus:ring-rose-500/15
              transition-all duration-200
            "
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="
              flex-1 py-2.5 rounded-lg text-sm text-slate-400
              bg-white/5 border border-white/10
              hover:bg-white/10 hover:text-slate-200
              transition-all duration-200
            "
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmText !== expected}
            className="
              flex-1 flex items-center justify-center gap-2
              py-2.5 rounded-lg text-sm font-semibold text-white
              bg-rose-500 hover:bg-rose-400
              shadow-lg shadow-rose-500/25
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 press
            "
          >
            <Trash2 size={14} />
            Delete {count} Volume{count !== 1 ? 's' : ''}
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

export default function Volumes() {
  const isConnected = useConnectionStore((s) => s.status) === 'connected'
  const userRole = useAuthStore((s) => s.userRole)
  const isAdmin = userRole === 'admin'
  const { addToast } = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Batch state
  const [batchMode, setBatchMode] = useState(false)
  const [selectedVolumes, setSelectedVolumes] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null)

  // Close topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (batchConfirmOpen) { setBatchConfirmOpen(false); return }
      if (deleteTarget) { setDeleteTarget(null); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [batchConfirmOpen, deleteTarget])

  // Poll volumes data
  const {
    data: volumesData,
    loading,
    refresh,
  } = usePolling<VolumeListResponse>(fetchVolumes, VOLUME_POLL_INTERVAL, {
    enabled: isConnected,
  })

  const volumes: VolumeInfo[] = volumesData?.volumes ?? []
  const hasLoaded = volumesData !== null

  // Filter by search query
  const filteredVolumes = useMemo(() => {
    let list = [...volumes]

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.driver.toLowerCase().includes(q) ||
          v.mountpoint.toLowerCase().includes(q),
      )
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else {
        cmp = a.size_bytes - b.size_bytes
      }
      return sortAsc ? cmp : -cmp
    })

    return list
  }, [volumes, searchQuery, sortField, sortAsc])

  // Summary stats
  const totalSize = useMemo(
    () => volumes.reduce((sum, v) => sum + v.size_bytes, 0),
    [volumes],
  )

  const driverCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const v of volumes) {
      map[v.driver] = (map[v.driver] || 0) + 1
    }
    return map
  }, [volumes])

  const largestVolume = useMemo(
    () =>
      volumes.length > 0
        ? volumes.reduce((max, v) => (v.size_bytes > max.size_bytes ? v : max))
        : null,
    [volumes],
  )

  // Sort toggle handler
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortAsc(!sortAsc)
      } else {
        setSortField(field)
        setSortAsc(true)
      }
    },
    [sortField, sortAsc],
  )

  // Handle delete confirmation
  const handleDeleteConfirmed = useCallback(() => {
    refresh()
  }, [refresh])

  // -------------------------------------------------------------------------
  // Batch operations
  // -------------------------------------------------------------------------

  const toggleBatchMode = useCallback(() => {
    setBatchMode((prev) => {
      if (prev) {
        // Exiting batch mode — clear selection & results
        setSelectedVolumes(new Set())
        setBatchResults(null)
      }
      return !prev
    })
  }, [])

  const toggleVolumeSelection = useCallback((name: string) => {
    setSelectedVolumes((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedVolumes(new Set(filteredVolumes.map((v) => v.name)))
  }, [filteredVolumes])

  const clearSelection = useCallback(() => {
    setSelectedVolumes(new Set())
  }, [])

  const handleBatchDelete = useCallback(async () => {
    setBatchConfirmOpen(false)
    if (selectedVolumes.size === 0) return
    setBatchLoading(true)
    setBatchResults(null)

    const results: BatchResult[] = []
    for (const name of selectedVolumes) {
      try {
        await deleteVolume(name)
        results.push({ name, success: true, message: 'Deleted successfully' })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete'
        results.push({ name, success: false, message })
      }
    }

    setBatchResults(results)
    setBatchLoading(false)
    setSelectedVolumes(new Set())

    const successCount = results.filter((r) => r.success).length
    const failCount = results.length - successCount
    if (failCount === 0) {
      addToast({ type: 'success', message: `Successfully deleted ${successCount} volume${successCount !== 1 ? 's' : ''}` })
    } else {
      addToast({
        type: 'warning',
        message: `Deleted ${successCount} volume${successCount !== 1 ? 's' : ''}, ${failCount} failed`,
        duration: 6000,
      })
    }

    refresh()
  }, [selectedVolumes, addToast, refresh])

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortAsc ? (
      <ChevronUp size={12} className="text-emerald-400" />
    ) : (
      <ChevronDown size={12} className="text-emerald-400" />
    )
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 animate-fade-in">
        <Loader2 className="w-8 h-8 text-slate-600 animate-spin mb-4" />
        <p className="text-sm text-slate-500">Waiting for server connection...</p>
        <p className="text-xs text-slate-600 mt-1">
          Ensure the Docker Compose Skeleton API server is running
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          volumeName={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirmed}
        />
      )}

      {/* Batch delete confirmation modal */}
      {batchConfirmOpen && (
        <BatchDeleteConfirmModal
          count={selectedVolumes.size}
          onClose={() => setBatchConfirmOpen(false)}
          onConfirm={handleBatchDelete}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Page Header                                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base md:text-xl font-bold text-slate-100">
            <span className="text-gradient">Volumes</span>
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage Docker volume storage and persistent data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={toggleBatchMode}
              className={`
                flex items-center gap-2 rounded-lg px-3.5 py-2
                text-sm font-medium transition-all duration-200 border
                ${batchMode
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15'
                  : 'text-slate-300 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/15'
                }
              `}
            >
              <ListChecks size={15} />
              {batchMode ? 'Exit Batch' : 'Batch Select'}
            </button>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="
              flex items-center gap-2 rounded-lg px-3.5 py-2
              text-sm font-medium text-slate-300
              bg-white/5 border border-white/10
              hover:bg-white/10 hover:border-white/15
              disabled:opacity-50 transition-all duration-200
            "
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Batch Action Bar                                                  */}
      {/* ----------------------------------------------------------------- */}
      {batchMode && (
        <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/15 rounded-xl px-5 py-3 animate-fade-in">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-amber-400">
              {selectedVolumes.size} selected
            </span>
            <div className="h-4 w-px bg-white/10" />
            <button
              onClick={selectAll}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Select All ({filteredVolumes.length})
            </button>
            <button
              onClick={clearSelection}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Clear
            </button>
          </div>
          <button
            onClick={() => setBatchConfirmOpen(true)}
            disabled={selectedVolumes.size === 0 || batchLoading}
            className="
              flex items-center gap-2 rounded-lg px-4 py-2
              text-sm font-semibold text-white
              bg-rose-500 hover:bg-rose-400
              shadow-lg shadow-rose-500/25
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 press
            "
          >
            {batchLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {batchLoading ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Batch Results Panel                                               */}
      {/* ----------------------------------------------------------------- */}
      {batchResults && batchResults.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ListChecks size={16} className="text-amber-400" />
              Batch Delete Results
            </h3>
            <button
              onClick={() => setBatchResults(null)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {batchResults.map((result) => (
              <div
                key={result.name}
                className={`
                  flex items-center gap-3 rounded-lg p-3 border
                  ${result.success
                    ? 'bg-emerald-500/5 border-emerald-500/15'
                    : 'bg-rose-500/5 border-rose-500/15'
                  }
                `}
              >
                {result.success ? (
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={14} className="text-rose-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-slate-200 truncate" title={result.name}>
                    {result.name}
                  </p>
                  <p className={`text-[10px] ${result.success ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                    {result.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Summary Stat Cards                                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Database size={14} className="text-cyan-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              Total Volumes
            </span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-100">
            {hasLoaded ? volumes.length : '--'}
          </p>
        </div>
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <HardDrive size={14} className="text-emerald-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              Total Storage
            </span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-100">
            {hasLoaded ? formatBytes(totalSize) : '--'}
          </p>
        </div>
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <FolderOpen size={14} className="text-violet-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              Drivers
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xl md:text-2xl font-bold text-slate-100">
              {hasLoaded ? Object.keys(driverCounts).length : '--'}
            </p>
            {hasLoaded && Object.keys(driverCounts).length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {Object.entries(driverCounts).map(([driver, count]) => (
                  <span
                    key={driver}
                    className="inline-flex rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-400"
                  >
                    {driver} ({count})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              Largest
            </span>
          </div>
          <p className="text-lg font-bold text-slate-100 truncate" title={largestVolume?.name}>
            {hasLoaded
              ? largestVolume
                ? formatBytes(largestVolume.size_bytes)
                : 'N/A'
              : '--'}
          </p>
          {largestVolume && (
            <p
              className="text-[10px] text-slate-500 font-mono truncate mt-0.5"
              title={largestVolume.name}
            >
              {largestVolume.name}
            </p>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Search + Sort Controls                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search volumes by name, driver, or mountpoint..."
            className="
              w-full pl-9 pr-4 py-2.5
              bg-white/[0.03] border border-white/[0.06] rounded-lg
              text-sm text-slate-200 placeholder-slate-600
              focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/15
              transition-all duration-200
            "
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['name', 'size'] as const).map((field) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`
                flex items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-medium border transition-all
                ${
                  sortField === field
                    ? 'bg-white/[0.06] border-white/[0.1] text-slate-200'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }
              `}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
              <SortIndicator field={field} />
            </button>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Search results count                                              */}
      {/* ----------------------------------------------------------------- */}
      {searchQuery && hasLoaded && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {filteredVolumes.length} result{filteredVolumes.length !== 1 ? 's' : ''} for{' '}
            <span className="text-slate-400">"{searchQuery}"</span>
          </span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Volumes Table                                                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden">
        {/* Table header bar */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <HardDrive size={16} className="text-cyan-400" />
            Docker Volumes
          </h3>
          <div className="flex items-center gap-1.5">
            <Database size={11} className="text-slate-600" />
            <span className="text-[10px] text-slate-600">
              {hasLoaded
                ? `${filteredVolumes.length} volume${filteredVolumes.length !== 1 ? 's' : ''} \u00B7 ${formatBytes(totalSize)} total`
                : 'Loading...'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {/* Batch checkbox column */}
                {batchMode && (
                  <th className="text-center px-3 py-3 w-10">
                    <button
                      onClick={selectedVolumes.size === filteredVolumes.length ? clearSelection : selectAll}
                      className="text-slate-500 hover:text-emerald-400 transition-colors"
                    >
                      {selectedVolumes.size === filteredVolumes.length && filteredVolumes.length > 0 ? (
                        <CheckSquare size={15} className="text-emerald-400" />
                      ) : (
                        <Square size={15} />
                      )}
                    </button>
                  </th>
                )}
                <th
                  className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none"
                  onClick={() => handleSort('name')}
                >
                  <span className="flex items-center gap-1">
                    Name
                    <SortIndicator field="name" />
                  </span>
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Mountpoint
                </th>
                <th
                  className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none"
                  onClick={() => handleSort('size')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Size
                    <SortIndicator field="size" />
                  </span>
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="stagger-children">
              {/* Loading skeleton */}
              {!hasLoaded && loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {/* Empty state */}
              {hasLoaded && filteredVolumes.length === 0 && (
                <tr>
                  <td colSpan={batchMode ? 6 : 5} className="px-5 py-16">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-xl" />
                        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800/80 border border-white/[0.06]">
                          <HardDrive
                            size={28}
                            className="text-slate-500"
                            strokeWidth={1.5}
                          />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-400">
                          {searchQuery
                            ? 'No volumes match your search'
                            : 'No volumes found'}
                        </p>
                        <p className="text-xs text-slate-600 mt-1 max-w-xs">
                          {searchQuery
                            ? 'Try adjusting your search query or clearing the filter.'
                            : 'Docker volumes will appear here when containers create persistent data stores.'}
                        </p>
                      </div>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                            text-xs font-medium text-emerald-400
                            bg-emerald-500/10 border border-emerald-500/20
                            hover:bg-emerald-500/20
                            transition-all duration-200
                          "
                        >
                          <X size={12} />
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Volume rows */}
              {hasLoaded &&
                filteredVolumes.map((vol) => {
                  const isSelected = selectedVolumes.has(vol.name)
                  return (
                    <tr
                      key={vol.name}
                      onClick={batchMode ? () => toggleVolumeSelection(vol.name) : undefined}
                      className={`
                        border-b border-white/[0.04] group transition-colors duration-150
                        ${batchMode ? 'cursor-pointer' : ''}
                        ${isSelected
                          ? 'bg-emerald-500/[0.06] hover:bg-emerald-500/[0.08]'
                          : 'hover:bg-white/[0.02]'
                        }
                      `}
                    >
                      {/* Batch checkbox */}
                      {batchMode && (
                        <td className="text-center px-3 py-3.5">
                          {isSelected ? (
                            <CheckSquare size={15} className="text-emerald-400 mx-auto" />
                          ) : (
                            <Square size={15} className="text-slate-600 mx-auto" />
                          )}
                        </td>
                      )}

                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/10 shrink-0">
                            <Database size={13} className="text-cyan-400" />
                          </div>
                          <span className="font-mono text-xs text-slate-200 truncate max-w-[240px]" title={vol.name}>
                            {vol.name}
                          </span>
                        </div>
                      </td>

                      {/* Driver */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                          {vol.driver}
                        </span>
                      </td>

                      {/* Mountpoint */}
                      <td
                        className="px-5 py-3.5 text-slate-400 text-xs font-mono truncate max-w-[300px]"
                        title={vol.mountpoint}
                      >
                        {vol.mountpoint}
                      </td>

                      {/* Size */}
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className={`text-xs font-mono font-medium ${
                            vol.size_bytes > 1073741824
                              ? 'text-amber-400'
                              : vol.size_bytes > 104857600
                                ? 'text-slate-200'
                                : 'text-slate-400'
                          }`}
                        >
                          {formatBytes(vol.size_bytes)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        {!batchMode && isAdmin && (
                          <button
                            onClick={() => setDeleteTarget(vol.name)}
                            className="
                              p-1.5 rounded-md
                              text-slate-600 hover:text-rose-400 hover:bg-rose-500/10
                              opacity-0 group-hover:opacity-100
                              transition-all duration-200
                            "
                            title="Delete volume"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
