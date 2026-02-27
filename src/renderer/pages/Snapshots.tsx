// =============================================================================
// Snapshots — System snapshots & config export management page
// =============================================================================

import { useState, useCallback } from 'react'
import {
  Camera,
  Download,
  RotateCw,
  RefreshCw,
  Trash2,
  Loader2,
  Archive,
  Clock,
  HardDrive,
  Server,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import {
  fetchSnapshots,
  createSnapshot,
  restoreSnapshot,
  deleteSnapshot,
} from '../api/endpoints'
import { apiClient } from '../api/client'
import type { SnapshotEntry, SnapshotListResponse } from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSnapshotDate(ts: string, epoch?: number): string {
  const d = epoch ? new Date(epoch * 1000) : new Date(ts)
  if (isNaN(d.getTime())) return ts
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function relativeTime(ts: string, epoch?: number): string {
  const d = epoch ? new Date(epoch * 1000) : new Date(ts)
  if (isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

/** Extract hostname and DCS version from filename if encoded, else return null */
function parseFilenameMetadata(filename: string): {
  hostname: string | null
  version: string | null
} {
  // Common patterns: dcs-snapshot-<hostname>-<version>-<timestamp>.tar.gz
  const match = filename.match(
    /^dcs-snapshot-([^-]+(?:-[^-]+)*?)-v?([\d]+\.[\d]+\.[\d]+)/i,
  )
  if (match) {
    return { hostname: match[1], version: `v${match[2]}` }
  }
  return { hostname: null, version: null }
}

// ---------------------------------------------------------------------------
// Snapshot Card (used in both mobile and desktop layouts)
// ---------------------------------------------------------------------------

interface SnapshotCardProps {
  snapshot: SnapshotEntry
  onDownload: (s: SnapshotEntry) => void
  onRestore: (s: SnapshotEntry) => void
  onDelete: (s: SnapshotEntry) => void
  restoreTarget: SnapshotEntry | null
  restoreConfirmText: string
  onRestoreConfirmChange: (v: string) => void
  onRestoreConfirm: () => void
  onRestoreCancel: () => void
  restoreLoading: boolean
  deleteTarget: SnapshotEntry | null
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
  deleteLoading: boolean
}

function SnapshotCard({
  snapshot,
  onDownload,
  onRestore,
  onDelete,
  restoreTarget,
  restoreConfirmText,
  onRestoreConfirmChange,
  onRestoreConfirm,
  onRestoreCancel,
  restoreLoading,
  deleteTarget,
  onDeleteConfirm,
  onDeleteCancel,
  deleteLoading,
}: SnapshotCardProps) {
  const meta = parseFilenameMetadata(snapshot.filename)
  const isRestoreTarget = restoreTarget?.filename === snapshot.filename
  const isDeleteTarget = deleteTarget?.filename === snapshot.filename

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6 animate-fade-in">
      {/* Top row: filename + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Archive size={14} className="text-cyan-400 shrink-0" />
            <span className="font-mono text-xs text-slate-200 truncate">
              {snapshot.filename}
            </span>
          </div>
          {snapshot.label && (
            <p className="text-sm text-slate-300 mt-1 truncate">
              {snapshot.label}
            </p>
          )}
        </div>
        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {meta.hostname && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
              <Server size={10} />
              {meta.hostname}
            </span>
          )}
          {meta.version && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-400">
              {meta.version}
            </span>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Clock size={12} />
          <span title={formatSnapshotDate(snapshot.timestamp, snapshot.epoch)}>
            {relativeTime(snapshot.timestamp, snapshot.epoch)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <HardDrive size={12} />
          <span>{snapshot.size}</span>
        </div>
        <span className="hidden md:inline text-slate-600">
          {formatSnapshotDate(snapshot.timestamp, snapshot.epoch)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={() => onDownload(snapshot)}
          className="
            inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
            text-xs font-medium
            text-cyan-400 bg-cyan-500/10 border border-cyan-500/20
            hover:bg-cyan-500/20 hover:border-cyan-500/30
            transition-all duration-200 press
          "
          title="Download"
        >
          <Download size={13} />
          <span className="hidden md:inline">Download</span>
        </button>
        <button
          onClick={() => onRestore(snapshot)}
          disabled={isRestoreTarget || isDeleteTarget}
          className="
            inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
            text-xs font-medium
            text-amber-400 bg-amber-500/10 border border-amber-500/20
            hover:bg-amber-500/20 hover:border-amber-500/30
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-200 press
          "
          title="Restore"
        >
          <RotateCw size={13} />
          <span className="hidden md:inline">Restore</span>
        </button>
        <button
          onClick={() => onDelete(snapshot)}
          disabled={isRestoreTarget || isDeleteTarget}
          className="
            inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
            text-xs font-medium
            text-rose-400 bg-rose-500/10 border border-rose-500/20
            hover:bg-rose-500/20 hover:border-rose-500/30
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-200 press
          "
          title="Delete"
        >
          <Trash2 size={13} />
          <span className="hidden md:inline">Delete</span>
        </button>
      </div>

      {/* Inline Restore Confirmation */}
      {isRestoreTarget && (
        <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 animate-fade-in">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-500/15 shrink-0">
              <AlertTriangle size={16} className="text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-300">
                Confirm Restore
              </p>
              <p className="text-xs text-rose-400/80 mt-1 leading-relaxed">
                This will overwrite current configuration. This cannot be undone.
              </p>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Type{' '}
              <code className="font-mono bg-white/[0.06] px-1.5 py-0.5 rounded text-rose-400">
                RESTORE
              </code>{' '}
              to confirm
            </label>
            <input
              type="text"
              value={restoreConfirmText}
              onChange={(e) => onRestoreConfirmChange(e.target.value)}
              placeholder="RESTORE"
              disabled={restoreLoading}
              className="
                w-full px-3 py-2 rounded-lg text-sm font-mono
                bg-white/[0.04] border border-white/[0.08]
                text-slate-200 placeholder-slate-600
                focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/30
                disabled:opacity-40
                transition-all duration-200
              "
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRestoreConfirm}
              disabled={restoreConfirmText !== 'RESTORE' || restoreLoading}
              className="
                flex items-center gap-1.5 rounded-lg px-4 py-2
                text-xs font-semibold text-white
                bg-rose-600 hover:bg-rose-500
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200
                shadow-lg shadow-rose-500/20
              "
            >
              {restoreLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RotateCw size={13} />
              )}
              Restore
            </button>
            <button
              onClick={onRestoreCancel}
              disabled={restoreLoading}
              className="
                rounded-lg px-4 py-2 text-xs font-medium
                text-slate-400 bg-white/[0.04] border border-white/[0.06]
                hover:bg-white/[0.08] hover:text-slate-300
                disabled:opacity-40
                transition-all duration-200
              "
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inline Delete Confirmation */}
      {isDeleteTarget && (
        <div className="mt-4 rounded-lg bg-slate-800/60 border border-white/[0.08] p-4 animate-fade-in">
          <p className="text-sm text-slate-300 mb-3">
            Are you sure you want to delete this snapshot?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onDeleteConfirm}
              disabled={deleteLoading}
              className="
                flex items-center gap-1.5 rounded-lg px-4 py-2
                text-xs font-semibold text-white
                bg-rose-600 hover:bg-rose-500
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200
              "
            >
              {deleteLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
              Delete
            </button>
            <button
              onClick={onDeleteCancel}
              disabled={deleteLoading}
              className="
                rounded-lg px-4 py-2 text-xs font-medium
                text-slate-400 bg-white/[0.04] border border-white/[0.06]
                hover:bg-white/[0.08] hover:text-slate-300
                disabled:opacity-40
                transition-all duration-200
              "
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Snapshots() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  // ---- Create snapshot state ----
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [createLabel, setCreateLabel] = useState('')
  const [creating, setCreating] = useState(false)

  // ---- Restore state ----
  const [restoreTarget, setRestoreTarget] = useState<SnapshotEntry | null>(null)
  const [restoreConfirmText, setRestoreConfirmText] = useState('')
  const [restoreLoading, setRestoreLoading] = useState(false)

  // ---- Delete state ----
  const [deleteTarget, setDeleteTarget] = useState<SnapshotEntry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ---- Polling ----
  const {
    data: snapshotsData,
    loading,
    refresh,
  } = usePolling<SnapshotListResponse>(fetchSnapshots, 15000, {
    enabled: isConnected,
  })

  const snapshots: SnapshotEntry[] = snapshotsData?.snapshots ?? []

  // ---- Handlers ----

  const handleCreate = useCallback(async () => {
    setCreating(true)
    try {
      const result = await createSnapshot(createLabel.trim() || undefined)
      if (result.success) {
        addToast({
          type: 'success',
          message: `Snapshot "${result.filename}" created`,
        })
        setCreateLabel('')
        setShowCreateInput(false)
        refresh()
      } else {
        addToast({
          type: 'error',
          message: 'Failed to create snapshot',
          duration: 6000,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addToast({
        type: 'error',
        message: `Snapshot failed: ${message}`,
        duration: 6000,
      })
    } finally {
      setCreating(false)
    }
  }, [createLabel, addToast, refresh])

  const handleDownload = useCallback(
    (snapshot: SnapshotEntry) => {
      const baseUrl = apiClient.getBaseUrl()
      const url = `${baseUrl}/snapshots/${encodeURIComponent(snapshot.filename)}/download`
      window.open(url, '_blank')
    },
    [],
  )

  const handleRestoreInit = useCallback((snapshot: SnapshotEntry) => {
    setDeleteTarget(null)
    setRestoreTarget(snapshot)
    setRestoreConfirmText('')
  }, [])

  const handleRestoreConfirm = useCallback(async () => {
    if (!restoreTarget || restoreConfirmText !== 'RESTORE') return
    setRestoreLoading(true)
    addToast({
      type: 'info',
      message: `Restoring from "${restoreTarget.filename}"...`,
      duration: 3000,
    })
    try {
      const result = await restoreSnapshot(restoreTarget.filename)
      if (result.success) {
        addToast({
          type: 'success',
          message:
            result.message ||
            `Restored from "${restoreTarget.filename}" successfully`,
        })
      } else {
        addToast({
          type: 'error',
          message: result.message || 'Restore failed',
          duration: 6000,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addToast({
        type: 'error',
        message: `Restore failed: ${message}`,
        duration: 6000,
      })
    } finally {
      setRestoreLoading(false)
      setRestoreTarget(null)
      setRestoreConfirmText('')
      refresh()
    }
  }, [restoreTarget, restoreConfirmText, addToast, refresh])

  const handleRestoreCancel = useCallback(() => {
    if (restoreLoading) return
    setRestoreTarget(null)
    setRestoreConfirmText('')
  }, [restoreLoading])

  const handleDeleteInit = useCallback((snapshot: SnapshotEntry) => {
    setRestoreTarget(null)
    setRestoreConfirmText('')
    setDeleteTarget(snapshot)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const result = await deleteSnapshot(deleteTarget.filename)
      if (result.success) {
        addToast({
          type: 'success',
          message: `Snapshot "${deleteTarget.filename}" deleted`,
        })
      } else {
        addToast({
          type: 'error',
          message: 'Failed to delete snapshot',
          duration: 6000,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addToast({
        type: 'error',
        message: `Delete failed: ${message}`,
        duration: 6000,
      })
    } finally {
      setDeleteLoading(false)
      setDeleteTarget(null)
      refresh()
    }
  }, [deleteTarget, addToast, refresh])

  const handleDeleteCancel = useCallback(() => {
    if (deleteLoading) return
    setDeleteTarget(null)
  }, [deleteLoading])

  // ---- Not connected ----
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
          <Camera size={24} className="text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">Connect to a server to manage snapshots</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Camera size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">System Snapshots</h2>
            <p className="text-xs text-slate-500">
              Create, restore, and manage configuration snapshots
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Create Snapshot */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10">
              <Plus size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Create Snapshot</h3>
              <p className="text-xs text-slate-500">Capture current DCS configuration</p>
            </div>
          </div>
          {!showCreateInput && (
            <button
              onClick={() => setShowCreateInput(true)}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-emerald-500/20 press"
            >
              <Camera size={15} />
              <span className="hidden sm:inline">New Snapshot</span>
            </button>
          )}
        </div>

        {/* Expandable inline input */}
        {showCreateInput && (
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-fade-in">
            <input
              type="text"
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
              placeholder="Optional label (e.g. before-migration)"
              disabled={creating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setShowCreateInput(false)
                  setCreateLabel('')
                }
              }}
              className="flex-1 px-3.5 py-2.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30 disabled:opacity-40 transition-all duration-200"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-emerald-500/20 press"
              >
                {creating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Camera size={15} />
                )}
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateInput(false)
                  setCreateLabel('')
                }}
                disabled={creating}
                className="rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:text-slate-300 disabled:opacity-40 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Archive size={15} className="text-slate-500" />
            Snapshots
            {snapshots.length > 0 && (
              <span className="text-xs font-normal text-slate-500">({snapshots.length})</span>
            )}
          </h3>
        </div>

        {/* Loading state */}
        {loading && snapshots.length === 0 && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-8 md:p-12 text-center">
            <Loader2 size={24} className="text-slate-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading snapshots...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && snapshots.length === 0 && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-8 md:p-12 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800/80 mx-auto mb-4">
              <Camera size={28} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-400 font-medium">No snapshots yet</p>
            <p className="text-xs text-slate-600 mt-1.5 max-w-xs mx-auto leading-relaxed">
              Create your first snapshot to backup your DCS configuration.
            </p>
            <button
              onClick={() => setShowCreateInput(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all duration-200 shadow-lg shadow-emerald-500/20 press"
            >
              <Camera size={15} />
              Create Snapshot
            </button>
          </div>
        )}

        {/* Snapshot cards */}
        {snapshots.length > 0 && (
          <div className="flex flex-col gap-3">
            {snapshots.map((snapshot) => (
              <SnapshotCard
                key={snapshot.filename}
                snapshot={snapshot}
                onDownload={handleDownload}
                onRestore={handleRestoreInit}
                onDelete={handleDeleteInit}
                restoreTarget={restoreTarget}
                restoreConfirmText={restoreConfirmText}
                onRestoreConfirmChange={setRestoreConfirmText}
                onRestoreConfirm={handleRestoreConfirm}
                onRestoreCancel={handleRestoreCancel}
                restoreLoading={restoreLoading}
                deleteTarget={deleteTarget}
                onDeleteConfirm={handleDeleteConfirm}
                onDeleteCancel={handleDeleteCancel}
                deleteLoading={deleteLoading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
