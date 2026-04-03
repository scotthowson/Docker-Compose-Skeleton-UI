// =============================================================================
// Backup — Backup and restore management page with status, trigger, and archive
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import {
  fetchBackups,
  fetchBackupStatus,
  fetchBackupConfig,
  triggerBackup,
  restoreBackup,
  cancelBackup,
  fetchStacks,
} from '../api/endpoints'
import {
  Archive,
  Play,
  RotateCcw,
  Clock,
  HardDrive,
  Shield,
  AlertTriangle,
  Loader2,
  CheckCircle,
  X,
  Download,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Layers,
  XCircle,
} from 'lucide-react'
import type {
  BackupStatusResponse,
  BackupEntry,
  BackupConfigResponse,
  BackupListResponse,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateString(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BACKUP_GUIDE_SECTIONS = [
  {
    title: 'What Gets Backed Up',
    icon: Archive,
    content: `Full backups capture your entire DCS directory:

• docker-compose.yml    All stack compose files
• .env files            Stack and root environment configs
• .config/              DCS framework configuration
• .api-auth/            User accounts and settings
• .templates/           Custom service templates
• .plugins/             Installed plugins

Backups do NOT include Docker volumes or
container data — only configuration files.
Use Docker volume snapshots for data backup.`,
  },
  {
    title: 'Configuration',
    icon: Shield,
    content: `Configure backup in your server's .env file:

BACKUP_DEST_DIR="/path/to/backup/storage"
BACKUP_SOURCE_DIR=""     # defaults to DCS root
BACKUP_RETENTION_COUNT=5 # keep last 5 backups

The destination must be a writable directory.
Common choices:
  /srv/backups        Local backup storage
  /mnt/nas/backups    Network-attached storage
  /mnt/usb/backups    External USB drive`,
  },
  {
    title: 'Targeted Stack Backups',
    icon: Layers,
    content: `Targeted backups capture a single stack:

1. Select the stack from the dropdown
2. Click "Backup Stack"

This creates a smaller archive containing only
that stack's compose file, .env, and related
configuration. Useful for quick saves before
making changes to a specific stack.`,
  },
  {
    title: 'Restoring from Backup',
    icon: RotateCcw,
    content: `To restore from a backup archive:

1. Find the backup in the archives table
2. Click "Restore" on the desired backup
3. Type RESTORE to confirm
4. Wait for the restore to complete

IMPORTANT: Restoring overwrites current
configuration files. It does NOT automatically
restart stacks — do this manually after restore.

Tip: Create a fresh backup before restoring
an older one, so you can roll back if needed.`,
  },
]

export default function Backup() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  // ---- State ----
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [selectedStack, setSelectedStack] = useState<string>('')
  const [stackNames, setStackNames] = useState<string[]>([])
  const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null)
  const [restoreConfirmText, setRestoreConfirmText] = useState('')
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null)

  // Close topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (restoreTarget && !restoreLoading) {
        setRestoreTarget(null)
        setRestoreConfirmText('')
        return
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [restoreTarget, restoreLoading])

  // ---- Polling ----
  const {
    data: statusData,
    loading: statusLoading,
    refresh: refreshStatus,
  } = usePolling<BackupStatusResponse>(fetchBackupStatus, 5000, {
    enabled: isConnected,
  })

  const {
    data: backupsData,
    loading: backupsLoading,
    refresh: refreshBackups,
  } = usePolling<BackupListResponse>(fetchBackups, 15000, {
    enabled: isConnected,
  })

  const {
    data: configData,
  } = usePolling<BackupConfigResponse>(fetchBackupConfig, 30000, {
    enabled: isConnected,
  })

  // ---- Fetch stacks for dropdown ----
  useEffect(() => {
    if (!isConnected) return
    fetchStacks()
      .then((res) => setStackNames(res.stacks.map((s) => s.name)))
      .catch(() => {})
  }, [isConnected])

  // ---- Handlers ----
  const handleTriggerBackup = useCallback(
    async (stack?: string) => {
      setTriggerLoading(true)
      addToast({
        type: 'info',
        message: stack ? `Starting backup for "${stack}"...` : 'Starting full backup...',
        duration: 2500,
      })
      try {
        const result = await triggerBackup(stack || undefined)
        if (result.success) {
          addToast({
            type: 'success',
            message: result.message || `Backup "${result.filename}" started`,
          })
          refreshBackups()
        } else {
          addToast({
            type: 'error',
            message: result.message || 'Failed to start backup',
            duration: 6000,
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        addToast({ type: 'error', message: `Backup failed: ${message}`, duration: 6000 })
      } finally {
        setTriggerLoading(false)
      }
    },
    [addToast, refreshBackups],
  )

  const handleCancelBackup = useCallback(async () => {
    setCancelling(true)
    try {
      const result = await cancelBackup()
      addToast({ type: result.success ? 'info' : 'error', message: result.message })
      refreshStatus()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to cancel' })
    } finally {
      setCancelling(false)
    }
  }, [addToast, refreshStatus])

  const handleRestore = useCallback(async () => {
    if (!restoreTarget) return
    setRestoreLoading(true)
    addToast({
      type: 'info',
      message: `Restoring from "${restoreTarget.filename}"...`,
      duration: 3000,
    })
    try {
      const result = await restoreBackup(restoreTarget.filename)
      if (result.success) {
        addToast({
          type: 'success',
          message: result.message || `Restore from "${restoreTarget.filename}" completed`,
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
      addToast({ type: 'error', message: `Restore failed: ${message}`, duration: 6000 })
    } finally {
      setRestoreLoading(false)
      setRestoreTarget(null)
      setRestoreConfirmText('')
      refreshBackups()
    }
  }, [restoreTarget, addToast, refreshBackups])

  const backups: BackupEntry[] = backupsData?.backups ?? []
  const status = statusData?.status ?? 'idle'
  const isConfigured = configData?.configured ?? true

  // ---- Not connected ----
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24">
        <Loader2 className="w-8 h-8 text-slate-500 animate-spin mb-4" />
        <p className="text-sm text-slate-500">Waiting for server connection...</p>
        <p className="text-xs text-slate-500 mt-1">
          Ensure the Docker Compose Skeleton API server is running
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-4 md:p-6 animate-fade-in">
      <DisconnectedBanner />
      <div className="flex flex-col gap-5 animate-fade-in">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight"><span className="text-gradient">Backup & Restore</span></h1>
            <p className="text-sm text-slate-400 mt-1">
              Create, manage, and restore server backups
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/15 transition-all duration-200"
            >
              <BookOpen size={15} />
              <span className="hidden sm:inline">Guide</span>
            </button>
            <button
              onClick={refreshBackups}
              disabled={backupsLoading}
              className="
                flex items-center gap-2 rounded-lg px-3.5 py-2
                text-sm font-medium text-slate-300
                bg-white/5 border border-white/10
                hover:bg-white/10 hover:border-white/15
                disabled:opacity-50 transition-all duration-200
              "
            >
              <RotateCcw size={15} className={backupsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Backup Guide */}
        {showGuide && (
          <div className="glass rounded-xl overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">Backup & Restore Guide</h2>
              </div>
              <button onClick={() => setShowGuide(false)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-400 mb-4">
                Backups create compressed archives of your DCS configuration. Use them to protect against accidental changes or migrate to a new server.
              </p>
              {BACKUP_GUIDE_SECTIONS.map((section, i) => {
                const isExpanded = expandedGuide === i
                const Icon = section.icon
                return (
                  <div key={section.title} className="border border-white/[0.03] rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedGuide(isExpanded ? null : i)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                    >
                      <Icon size={14} className="text-emerald-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-200 flex-1">{section.title}</span>
                      {isExpanded
                        ? <ChevronDown size={14} className="text-slate-500" />
                        : <ChevronRight size={14} className="text-slate-500" />
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
          </div>
        )}

        {/* ================================================================= */}
        {/* Backup Status                                                     */}
        {/* ================================================================= */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <Shield size={16} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200">Backup Status</h3>
          </div>

          <div className="p-5">
            {/* Idle */}
            {status === 'idle' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10">
                  <CheckCircle size={24} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Idle
                    </span>
                  </div>
                  {statusData?.last_backup ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-slate-300">
                        Last backup:{' '}
                        <span className="font-mono text-xs text-slate-400">
                          {statusData.last_backup.filename}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {statusData.last_backup.size} &middot;{' '}
                        {formatDateString(statusData.last_backup.timestamp)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No backups recorded yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Running */}
            {status === 'running' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10">
                    <Loader2 size={24} className="text-cyan-400 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        Running
                      </span>
                    </div>
                    {statusData?.filename && (
                      <p className="mt-1.5 text-sm text-slate-300 font-mono text-xs">
                        {statusData.filename}
                      </p>
                    )}
                    {statusData?.progress && (
                      <p className="text-xs text-slate-500 mt-0.5">{statusData.progress}</p>
                    )}
                  </div>
                </div>
                {/* Progress bar — real percentage when available, animated fallback */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{statusData?.stage === 'copy' ? 'Copying files' : statusData?.stage === 'archive' ? 'Creating archive' : statusData?.stage === 'cleanup' ? 'Cleaning up' : statusData?.stage === 'retention' ? 'Enforcing retention' : 'Processing'}</span>
                    <span className="text-[10px] font-mono text-cyan-400">{statusData?.percent != null ? `${statusData.percent}%` : ''}</span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    {statusData?.percent != null ? (
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 shadow-lg shadow-cyan-500/20 transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(statusData.percent, 2)}%` }}
                      />
                    ) : (
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 animate-pulse" style={{ width: '45%' }} />
                    )}
                  </div>
                  <button
                    onClick={handleCancelBackup}
                    disabled={cancelling}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/15 hover:bg-rose-500/20 disabled:opacity-50 transition-all press mt-1"
                  >
                    {cancelling ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                    Cancel Backup
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {status === 'error' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-rose-500/10">
                  <AlertTriangle size={24} className="text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      Error
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-rose-300">
                    {statusData?.error || 'An error occurred during the last backup'}
                  </p>
                </div>
              </div>
            )}

            {/* Restoring */}
            {status === 'restoring' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10">
                    <RotateCcw size={24} className="text-amber-400 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Restoring
                      </span>
                    </div>
                    {statusData?.filename && (
                      <p className="mt-1.5 text-sm text-slate-300 font-mono text-xs">
                        {statusData.filename}
                      </p>
                    )}
                    {statusData?.progress && (
                      <p className="text-xs text-slate-500 mt-0.5">{statusData.progress}</p>
                    )}
                  </div>
                </div>
                <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                    style={{
                      animation: 'backupProgressPulse 2s ease-in-out infinite',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Loading placeholder */}
            {statusLoading && !statusData && (
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading backup status...</span>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* Trigger Backup                                                    */}
        {/* ================================================================= */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <Play size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">Trigger Backup</h3>
          </div>

          <div className="p-5">
            {!isConfigured && (
              <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 mb-5">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Backup not configured</p>
                  <p className="text-xs text-amber-400/70 mt-1">
                    Configure backup settings in your server's <code className="font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">.env</code> file to enable backup functionality.
                  </p>
                </div>
              </div>
            )}

            {/* Config summary */}
            {configData && isConfigured && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="glass border border-white/5 rounded-lg p-3">
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Destination</p>
                  <p className="mt-1 text-xs font-mono text-slate-300 truncate" title={configData.destination}>
                    {configData.destination || 'N/A'}
                  </p>
                </div>
                <div className="glass border border-white/5 rounded-lg p-3">
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Source</p>
                  <p className="mt-1 text-xs font-mono text-slate-300 truncate" title={configData.source}>
                    {configData.source || 'N/A'}
                  </p>
                </div>
                <div className="glass border border-white/5 rounded-lg p-3">
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Retention</p>
                  <p className="mt-1 text-xs font-mono text-slate-300">
                    {configData.retention_count} backup{configData.retention_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center gap-3">
              {/* Full backup button */}
              <button
                onClick={() => handleTriggerBackup()}
                disabled={triggerLoading || status === 'running' || status === 'restoring' || !isConfigured}
                className="
                  flex items-center gap-2.5 rounded-lg px-5 py-2.5
                  text-sm font-semibold text-white
                  bg-emerald-600 hover:bg-emerald-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                  shadow-lg shadow-emerald-500/20 press
                "
              >
                {triggerLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Archive size={16} />
                )}
                Full Backup
              </button>

              {/* Stack selector */}
              <div className="flex items-center gap-2 flex-1">
                <select
                  value={selectedStack}
                  onChange={(e) => setSelectedStack(e.target.value)}
                  disabled={!isConfigured}
                  className="
                    flex-1 rounded-lg px-3 py-2.5 text-sm
                    bg-white/5 border border-white/10
                    text-slate-200
                    focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200
                    appearance-none
                  "
                >
                  <option value="" className="bg-slate-900 text-slate-400">
                    Select stack for targeted backup...
                  </option>
                  {stackNames.map((name) => (
                    <option key={name} value={name} className="bg-slate-900 text-slate-200">
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedStack) handleTriggerBackup(selectedStack)
                  }}
                  disabled={
                    !selectedStack ||
                    triggerLoading ||
                    status === 'running' ||
                    status === 'restoring' ||
                    !isConfigured
                  }
                  className="
                    flex items-center gap-2 rounded-lg px-4 py-2.5
                    text-sm font-medium text-slate-300
                    bg-white/5 border border-white/10
                    hover:bg-white/10 hover:border-white/10
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200
                  "
                >
                  <Download size={15} />
                  Backup Stack
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Backup Archives                                                   */}
        {/* ================================================================= */}
        <div className="glass border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <HardDrive size={16} className="text-cyan-400" />
              Backup Archives
              <span className="text-xs font-normal text-slate-500">
                ({backups.length})
              </span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Filename
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] stagger-children">
                {backups.length === 0 && !backupsLoading && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Archive size={32} className="text-slate-500" />
                        <p className="text-sm text-slate-500">No backup archives found</p>
                        <p className="text-xs text-slate-500">
                          Trigger a backup above to create your first archive
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {backupsLoading && backups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                      <Loader2 size={16} className="inline animate-spin mr-2" />
                      Loading backup archives...
                    </td>
                  </tr>
                )}
                {backups.map((backup) => (
                  <tr
                    key={backup.filename}
                    className="hover:bg-white/[0.03] transition-colors duration-150"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Archive size={14} className="text-slate-500 shrink-0" />
                        <span className="font-mono text-xs text-slate-200 truncate max-w-[200px] md:max-w-[320px]">
                          {backup.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-slate-400">{backup.size}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock size={12} className="text-slate-500" />
                        {formatTimestamp(backup.timestamp)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          setRestoreTarget(backup)
                          setRestoreConfirmText('')
                        }}
                        disabled={status === 'running' || status === 'restoring'}
                        className="
                          inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5
                          text-xs font-medium
                          text-rose-400 bg-rose-500/10 border border-rose-500/20
                          hover:bg-rose-500/20 hover:border-rose-500/30
                          disabled:opacity-50 disabled:cursor-not-allowed
                          transition-all duration-200
                        "
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Restore Confirmation Modal                                        */}
      {/* ================================================================= */}
      {restoreTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (!restoreLoading) {
                setRestoreTarget(null)
                setRestoreConfirmText('')
              }
            }}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md mx-4 glass rounded-2xl border border-white/10 shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-rose-500/15">
                  <AlertTriangle size={18} className="text-rose-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">Confirm Restore</h3>
              </div>
              <button
                onClick={() => {
                  if (!restoreLoading) {
                    setRestoreTarget(null)
                    setRestoreConfirmText('')
                  }
                }}
                disabled={restoreLoading}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all duration-150 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Warning */}
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-4">
                <p className="text-sm text-rose-300 font-medium">
                  This will overwrite your current configuration and data files.
                </p>
                <p className="text-xs text-rose-400/70 mt-1.5">
                  This action cannot be undone. Make sure you have a current backup before proceeding.
                </p>
              </div>

              {/* Archive info */}
              <div className="glass border border-white/5 rounded-lg p-3.5">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Restoring from
                </p>
                <div className="flex items-center gap-2">
                  <Archive size={14} className="text-slate-400 shrink-0" />
                  <span className="font-mono text-xs text-slate-200 truncate">
                    {restoreTarget.filename}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {restoreTarget.size} &middot; {formatTimestamp(restoreTarget.timestamp)}
                </p>
              </div>

              {/* Confirmation input */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Type <code className="font-mono bg-white/[0.06] px-1.5 py-0.5 rounded text-rose-400">RESTORE</code> to confirm
                </label>
                <input
                  type="text"
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  placeholder="RESTORE"
                  disabled={restoreLoading}
                  className="
                    w-full px-3.5 py-2.5 rounded-lg text-sm font-mono
                    bg-white/5 border border-white/10
                    text-slate-200 placeholder-slate-600
                    focus:outline-none focus:ring-1 focus:ring-rose-500/30 focus:border-rose-500/30
                    disabled:opacity-50
                    transition-all duration-200
                  "
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button
                onClick={() => {
                  setRestoreTarget(null)
                  setRestoreConfirmText('')
                }}
                disabled={restoreLoading}
                className="
                  px-4 py-2 rounded-lg text-sm font-medium
                  text-slate-400 bg-white/5 border border-white/5
                  hover:bg-white/10 hover:text-slate-300
                  disabled:opacity-50
                  transition-all duration-200
                "
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoreConfirmText !== 'RESTORE' || restoreLoading}
                className="
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                  text-white bg-rose-600 hover:bg-rose-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                  shadow-lg shadow-rose-500/20
                "
              >
                {restoreLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RotateCcw size={15} />
                )}
                Restore Backup
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
