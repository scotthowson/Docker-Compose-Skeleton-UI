// =============================================================================
// Snapshots — configuration snapshots: create one, download it, restore it, delete it
// Laid out like the Backup page it is the small sibling of: a header, one card to
// start with, then what has been kept.
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react'
import { Badge } from '@mantine/core'
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
  Plus,
  BookOpen,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { useConfirm } from '../components/common/ConfirmDialog'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import PageHeader from '../components/common/PageHeader'
import Hint from '../components/common/Hint'
import { EmptyState } from '../components/common/PageState'
import TypedConfirmDialog from '../components/backup/TypedConfirmDialog'
import { pageLabel } from '../constants/pageTitles'
import {
  BTN_TOOLBAR, BTN_TOOLBAR_QUIET, BTN_CARD, BTN_ICON_SM, BTN_SHEET_QUIET, BTN_SHEET_PRIMARY,
  TONE_OK, TONE_QUIET, TONE_DANGER, TONE_GHOST,
} from '../lib/ui'
import {
  fetchSnapshots,
  createSnapshot,
  restoreSnapshot,
  deleteSnapshot,
} from '../api/endpoints'
import { useFleetScope } from '../hooks/useFleetScope'
import FleetScopeChips from '../components/fleet/FleetScopeChips'
import VmCapsule from '../components/fleet/VmCapsule'
import { apiClient } from '../api/client'
import type { SnapshotEntry, SnapshotListResponse } from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** a row key: the file on its DCS (the hub's rows have no member) */
const snapshotKey = (s: { member?: string | null; filename: string }) => `${s.member ?? ''}|${s.filename}`

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
// Snapshot Card
// ---------------------------------------------------------------------------

function SnapshotCard({ snapshot, onDownload, onRestore, onDelete, downloading, deleting, locked }: {
  snapshot: SnapshotEntry
  onDownload: (s: SnapshotEntry) => void
  onRestore: (s: SnapshotEntry) => void
  onDelete: (s: SnapshotEntry) => void
  downloading: boolean
  deleting: boolean
  /** a restore or a delete is being asked about or running: the card's other buttons wait */
  locked: boolean
}) {
  const meta = parseFilenameMetadata(snapshot.filename)
  const label = (text: string) => <span className="hidden md:inline">{text}</span>

  return (
    <div className="glass border border-white/5 rounded-xl p-4 md:p-5 animate-fade-in glass-hover">
      {/* Top row: filename + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Archive size={14} className="text-slate-400 shrink-0" aria-hidden />
            <span className="font-mono text-xs text-slate-200 truncate min-w-0" title={snapshot.filename}>
              {snapshot.filename}
            </span>
            {snapshot.member !== undefined && <VmCapsule member={snapshot.member} name={snapshot.member_name} vmid={snapshot.vmid} size="xs" />}
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
            <Badge component="span" color="slate" leftSection={<Server size={10} />}>{meta.hostname}</Badge>
          )}
          {meta.version && (
            <Badge component="span" color="slate">{meta.version}</Badge>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Clock size={12} aria-hidden />
          <span title={formatSnapshotDate(snapshot.timestamp, snapshot.epoch)}>
            {relativeTime(snapshot.timestamp, snapshot.epoch)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <HardDrive size={12} aria-hidden />
          <span>{snapshot.size}</span>
        </div>
        <span className="hidden md:inline text-slate-500">
          {formatSnapshotDate(snapshot.timestamp, snapshot.epoch)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4">
        <Hint label="Download">
          <button
            type="button"
            onClick={() => onDownload(snapshot)}
            disabled={downloading}
            aria-label={`Download ${snapshot.filename}`}
            className={`${BTN_CARD} ${TONE_QUIET}`}
          >
            {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {label(downloading ? 'Downloading' : 'Download')}
          </button>
        </Hint>
        <Hint label="Restore">
          <button
            type="button"
            onClick={() => onRestore(snapshot)}
            disabled={locked}
            aria-label={`Restore ${snapshot.filename}`}
            className={`${BTN_CARD} ${TONE_DANGER}`}
          >
            <RotateCw size={12} />
            {label('Restore')}
          </button>
        </Hint>
        <Hint label="Delete">
          <button
            type="button"
            onClick={() => onDelete(snapshot)}
            disabled={locked}
            aria-label={`Delete ${snapshot.filename}`}
            className={`${BTN_CARD} ${TONE_DANGER}`}
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {label('Delete')}
          </button>
        </Hint>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Guide Sections
// ---------------------------------------------------------------------------

const SNAPSHOT_GUIDE_SECTIONS = [
  {
    title: 'What gets captured',
    icon: Camera,
    content: `Snapshots capture DCS configuration state:

• .config/              Framework settings
• .env                  Root environment config
• Stacks/*/             docker-compose.yml + .env
• .api-auth/            User accounts (not tokens)
• .templates/           Service templates

Snapshots are lightweight configuration-only
archives — they do NOT include Docker images,
volumes, or container data.`,
  },
  {
    title: 'Creating snapshots',
    icon: Plus,
    content: `Click "New snapshot" and optionally add a label.

Labels help identify snapshots later:
  "before-migration"
  "working-config-march"
  "pre-traefik-update"

Snapshots are stored as .tar.gz archives in
the .snapshots/ directory on your server.`,
  },
  {
    title: 'Restoring snapshots',
    icon: RotateCw,
    content: `To restore a snapshot:

1. Click "Restore" on the snapshot card
2. Type RESTORE to confirm
3. Wait for extraction to complete

IMPORTANT:
• Restoring overwrites current config files
• Stacks are NOT automatically restarted
• Auth tokens are preserved (not overwritten)

Create a new snapshot before restoring an
older one so you can revert if needed.`,
  },
  {
    title: 'Snapshots and backups',
    icon: Archive,
    content: `Snapshots and backups serve different purposes:

Snapshots (this page)
  • Config-only (compose files, .env, settings)
  • Stored locally in .snapshots/
  • Quick to create and restore
  • Best for: config versioning, quick saves

Backups (${pageLabel('backup')} page)
  • Full directory backup via rsync + tar
  • Stored in configurable BACKUP_DEST_DIR
  • Includes application data directory
  • Best for: disaster recovery, migration`,
  },
]

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Snapshots() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()
  const confirm = useConfirm()

  // ---- Create snapshot state ----
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [createLabel, setCreateLabel] = useState('')
  const [creating, setCreating] = useState(false)

  // ---- Restore state (typed confirmation) ----
  const [restoreTarget, setRestoreTarget] = useState<SnapshotEntry | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)

  // ---- Delete state ----
  const [deleteKey, setDeleteKey] = useState<string | null>(null)

  // ---- Guide state ----
  const [showGuide, setShowGuide] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null)

  // ---- Polling ----
  const { scope, setScope, member: scopeMember, memberName, members: scopeMembers, hasFleet } = useFleetScope()
  const fetchScopedSnapshots = useCallback(() => fetchSnapshots(scope), [scope])
  const {
    data: snapshotsData,
    loading,
    refresh,
  } = usePolling<SnapshotListResponse>(fetchScopedSnapshots, 15000, {
    enabled: isConnected,
  })
  const scopeRef = useRef(scope)
  useEffect(() => { if (scopeRef.current !== scope) { scopeRef.current = scope; refresh() } }, [scope, refresh])

  const snapshots: SnapshotEntry[] = snapshotsData?.snapshots ?? []

  // ---- Handlers ----

  const handleCreate = useCallback(async () => {
    setCreating(true)
    try {
      const result = await createSnapshot(createLabel.trim() || undefined, scope)
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
          message: 'Could not create the snapshot',
          duration: 6000,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addToast({
        type: 'error',
        message: `The snapshot failed: ${message}`,
        duration: 6000,
      })
    } finally {
      setCreating(false)
    }
  }, [createLabel, addToast, refresh, scope])

  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>({})

  const handleDownload = useCallback(
    async (snapshot: SnapshotEntry) => {
      if (snapshot.member ?? scopeMember) { addToast({ type: 'info', message: 'A VM keeps its snapshot files itself: download it from that VM\'s own dashboard or over ssh (~/.Docker-Compose-Skeleton-AIO/.snapshots)' }); return }
      setDownloadingMap((prev) => ({ ...prev, [snapshotKey(snapshot)]: true }))
      try {
        const baseUrl = apiClient.getBaseUrl()
        const url = `${baseUrl}/snapshots/${encodeURIComponent(snapshot.filename)}/download`
        const token = apiClient.getAuthToken()
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error(`The download failed (${res.status})`)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = snapshot.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
        addToast({ type: 'success', message: `Downloaded ${snapshot.filename}` })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The download failed'
        addToast({ type: 'error', message })
      } finally {
        setDownloadingMap((prev) => ({ ...prev, [snapshotKey(snapshot)]: false }))
      }
    },
    [addToast, scopeMember],
  )

  const handleRestoreConfirm = useCallback(async () => {
    if (!restoreTarget) return
    setRestoreLoading(true)
    addToast({
      type: 'info',
      message: `Restoring from "${restoreTarget.filename}"…`,
      duration: 3000,
    })
    try {
      const result = await restoreSnapshot(restoreTarget.filename, restoreTarget.member ?? scopeMember)
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
          message: result.message || 'The restore failed',
          duration: 6000,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addToast({
        type: 'error',
        message: `The restore failed: ${message}`,
        duration: 6000,
      })
    } finally {
      setRestoreLoading(false)
      setRestoreTarget(null)
      refresh()
    }
  }, [restoreTarget, addToast, refresh, scopeMember])

  /** Delete: ask first (the shared confirmation, focus on Cancel), then remove the file on the server that keeps it */
  const handleDelete = useCallback(async (snapshot: SnapshotEntry) => {
    const ok = await confirm({
      title: 'Delete this snapshot?',
      message: `${snapshot.filename} is removed from ${snapshot.member ?? scopeMember ? `the VM ${snapshot.member_name ?? memberName}` : 'the server'}. This cannot be undone.`,
      confirmLabel: 'Delete snapshot',
      danger: true,
    })
    if (!ok) return
    setDeleteKey(snapshotKey(snapshot))
    try {
      const result = await deleteSnapshot(snapshot.filename, snapshot.member ?? scopeMember)
      if (result.success) {
        addToast({
          type: 'success',
          message: `Snapshot "${snapshot.filename}" deleted`,
        })
      } else {
        addToast({
          type: 'error',
          message: 'Could not delete the snapshot',
          duration: 6000,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addToast({
        type: 'error',
        message: `The delete failed: ${message}`,
        duration: 6000,
      })
    } finally {
      setDeleteKey(null)
      refresh()
    }
  }, [confirm, addToast, refresh, scopeMember, memberName])

  // ---- Not connected ----
  if (!isConnected) {
    return <EmptyState icon={<Camera size={32} />} title="Connect to a server to manage snapshots" />
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <DisconnectedBanner />
      <PageHeader
        page="snapshots"
        badge={scopeMember ? <VmCapsule member={scopeMember} name={memberName} vmid={scopeMembers.find((m) => m.id === scopeMember)?.vmid} /> : undefined}
        actions={<>
          <Hint label={showGuide ? 'Hide the guide' : 'Show the guide'}>
            <button
              type="button"
              aria-label="Guide"
              aria-expanded={showGuide}
              onClick={() => {
                setShowGuide((prev) => !prev)
                if (showGuide) setExpandedGuide(null)
              }}
              className={`${BTN_TOOLBAR} ${showGuide ? 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/25' : TONE_QUIET}`}
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">Guide</span>
            </button>
          </Hint>
          <button type="button" aria-label="Refresh" onClick={refresh} disabled={loading} className={BTN_TOOLBAR_QUIET}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </>}
      >
        {hasFleet && <FleetScopeChips scope={scope} members={scopeMembers} onChange={setScope} label="Show" busy={loading && !!snapshotsData} />}
      </PageHeader>

      {/* Guide */}
      {showGuide && (
        <section aria-label={`${pageLabel('snapshots')} guide`} className="glass rounded-xl border border-white/5 overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-slate-400" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-200">{pageLabel('snapshots')} guide</h2>
            </div>
            <Hint label="Close the guide">
              <button type="button" aria-label="Close the guide" onClick={() => { setShowGuide(false); setExpandedGuide(null) }} className={`${BTN_ICON_SM} ${TONE_GHOST}`}>
                <X size={14} />
              </button>
            </Hint>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-400 mb-4">
              A snapshot is a small archive of the configuration: quick to make, quick to restore. Use it to keep a version you can return to.
            </p>
            {SNAPSHOT_GUIDE_SECTIONS.map((section, idx) => {
              const Icon = section.icon
              const isExpanded = expandedGuide === idx
              return (
                <div key={section.title} className="border border-white/[0.03] rounded-lg overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedGuide(isExpanded ? null : idx)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40"
                  >
                    <Icon size={14} className="text-slate-400 shrink-0" aria-hidden />
                    <span className="text-sm font-medium text-slate-200 flex-1">{section.title}</span>
                    {isExpanded
                      ? <ChevronDown size={14} className="text-slate-500" aria-hidden />
                      : <ChevronRight size={14} className="text-slate-500" aria-hidden />
                    }
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 animate-fade-in">
                      <pre className="bg-slate-950/60 border border-white/[0.03] rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto scrollbar-thin whitespace-pre leading-relaxed">
                        {section.content}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Create a snapshot */}
      <section aria-labelledby="snapshot-create-title" className="glass border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-slate-400" aria-hidden />
              <h2 id="snapshot-create-title" className="text-sm font-semibold text-slate-200">Create a snapshot</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">Capture the current DCS configuration</p>
          </div>
          {!showCreateInput && (
            <button
              type="button"
              onClick={() => setShowCreateInput(true)}
              disabled={creating}
              aria-label="New snapshot"
              className={`${BTN_SHEET_PRIMARY} shrink-0`}
            >
              <Camera size={15} />
              <span className="hidden sm:inline">New snapshot</span>
            </button>
          )}
        </div>

        {/* Expandable inline input */}
        {showCreateInput && (
          <div className="px-5 pb-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-fade-in">
            <input
              type="text"
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
              aria-label="Label of the snapshot (optional)"
              placeholder="Optional label, e.g. before-migration"
              disabled={creating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setShowCreateInput(false)
                  setCreateLabel('')
                }
              }}
              className="flex-1 h-11 px-3 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200 placeholder-slate-600 transition-colors focus:outline-none focus-visible:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-50"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleCreate} disabled={creating} className={`${BTN_SHEET_PRIMARY} flex-1 sm:flex-none`}>
                {creating ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateInput(false)
                  setCreateLabel('')
                }}
                disabled={creating}
                className={`${BTN_SHEET_QUIET} flex-1 sm:flex-none`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* The snapshots that were kept */}
      <section aria-labelledby="snapshot-list-title" className="space-y-3">
        <div className="flex items-center gap-2">
          <Archive size={16} className="text-slate-400" aria-hidden />
          <h2 id="snapshot-list-title" className="text-sm font-semibold text-slate-200">Snapshots</h2>
          {snapshots.length > 0 && (
            <span className="text-xs font-normal text-slate-500 tabular-nums">({snapshots.length})</span>
          )}
        </div>

        {/* Loading state: the shape of a snapshot card */}
        {loading && snapshots.length === 0 && (
          <div className="flex flex-col gap-3" role="status" aria-label="Reading the snapshots">
            {[0, 1].map((i) => (
              <div key={i} className="glass border border-white/5 rounded-xl p-4 md:p-5 space-y-3" aria-hidden>
                <div className="skeleton h-3.5 w-64 max-w-full rounded" />
                <div className="skeleton h-3 w-40 rounded" />
                <div className="flex gap-2"><div className="skeleton h-8 w-24 rounded-lg" /><div className="skeleton h-8 w-24 rounded-lg" /><div className="skeleton h-8 w-24 rounded-lg" /></div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && snapshots.length === 0 && (
          <div className="glass border border-white/5 rounded-xl">
            <EmptyState
              icon={<Camera size={32} />}
              title="No snapshots yet"
              hint="Create your first snapshot to keep a copy of your DCS configuration."
              action={
                <button type="button" onClick={() => setShowCreateInput(true)} className={`${BTN_TOOLBAR} ${TONE_OK}`}>
                  <Camera size={14} />
                  Create snapshot
                </button>
              }
            />
          </div>
        )}

        {/* Snapshot cards */}
        {snapshots.length > 0 && (
          <div className="flex flex-col gap-3 stagger-children">
            {snapshots.map((snapshot) => (
              <SnapshotCard
                key={snapshotKey(snapshot)}
                snapshot={snapshot}
                onDownload={handleDownload}
                onRestore={setRestoreTarget}
                onDelete={handleDelete}
                downloading={downloadingMap[snapshotKey(snapshot)] ?? false}
                deleting={deleteKey === snapshotKey(snapshot)}
                locked={restoreTarget !== null || deleteKey !== null}
              />
            ))}
          </div>
        )}
      </section>

      {/* Restore confirmation: the same dialog as a backup's */}
      {restoreTarget && (
        <TypedConfirmDialog
          title="Confirm restore"
          word="RESTORE"
          confirmLabel="Restore snapshot"
          warning={<>This will overwrite the current configuration{hasFleet ? (restoreTarget.member ?? scopeMember) ? ` on the VM ${restoreTarget.member_name ?? memberName}` : ' on the hub' : ''}.</>}
          detail="This action cannot be undone. Create a new snapshot first if you may want to come back."
          subjectLabel="Restoring from"
          subject={<>
            <div className="flex items-center gap-2 flex-wrap">
              <Archive size={14} className="text-slate-400 shrink-0" aria-hidden />
              <span className="font-mono text-xs text-slate-200 break-all">{restoreTarget.filename}</span>
              {restoreTarget.member !== undefined && <VmCapsule member={restoreTarget.member} name={restoreTarget.member_name} vmid={restoreTarget.vmid} size="xs" />}
            </div>
            <p className="text-xs text-slate-500 mt-1">{restoreTarget.size} &middot; {formatSnapshotDate(restoreTarget.timestamp, restoreTarget.epoch)}</p>
          </>}
          busy={restoreLoading}
          onConfirm={handleRestoreConfirm}
          onClose={() => setRestoreTarget(null)}
        />
      )}
    </div>
  )
}
