// =============================================================================
// Backup — Backup and restore management page with status, trigger, and archive
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import {
  fetchBackups,
  fetchBackupStatus,
  fetchBackupConfig,
  triggerBackup,
  restoreBackup,
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

  // ---- Polling ----
  const {
    data: statusData,
    loading: statusLoading,
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
        <Loader2 className="w-8 h-8 text-slate-600 animate-spin mb-4" />
        <p className="text-sm text-slate-500">Waiting for server connection...</p>
        <p className="text-xs text-slate-600 mt-1">
          Ensure the Docker Compose Skeleton API server is running
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
      <div className="flex flex-col gap-5 animate-in">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Backup & Restore</h1>
            <p className="text-sm text-slate-400 mt-1">
              Create, manage, and restore server backups
            </p>
          </div>
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

        {/* ================================================================= */}
        {/* Backup Status                                                     */}
        {/* ================================================================= */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
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
                {/* Animated progress bar */}
                <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                    style={{
                      animation: 'backupProgressPulse 2s ease-in-out infinite',
                    }}
                  />
                </div>
                <style>{`
                  @keyframes backupProgressPulse {
                    0% { width: 15%; opacity: 0.7; }
                    50% { width: 85%; opacity: 1; }
                    100% { width: 15%; opacity: 0.7; }
                  }
                `}</style>
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
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
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
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="glass-subtle rounded-lg p-3">
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Destination</p>
                  <p className="mt-1 text-xs font-mono text-slate-300 truncate" title={configData.destination}>
                    {configData.destination || 'N/A'}
                  </p>
                </div>
                <div className="glass-subtle rounded-lg p-3">
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Source</p>
                  <p className="mt-1 text-xs font-mono text-slate-300 truncate" title={configData.source}>
                    {configData.source || 'N/A'}
                  </p>
                </div>
                <div className="glass-subtle rounded-lg p-3">
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
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all duration-200
                  shadow-lg shadow-emerald-500/20
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
                    bg-white/[0.04] border border-white/[0.08]
                    text-slate-200
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30
                    disabled:opacity-40 disabled:cursor-not-allowed
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
                    bg-white/[0.04] border border-white/[0.08]
                    hover:bg-white/[0.08] hover:border-white/[0.12]
                    disabled:opacity-40 disabled:cursor-not-allowed
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
        <div className="glass-subtle rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
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
                <tr className="border-b border-white/[0.06]">
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
              <tbody className="divide-y divide-white/[0.04]">
                {backups.length === 0 && !backupsLoading && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Archive size={32} className="text-slate-700" />
                        <p className="text-sm text-slate-500">No backup archives found</p>
                        <p className="text-xs text-slate-600">
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
                        <span className="font-mono text-xs text-slate-200 truncate max-w-[320px]">
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
                          disabled:opacity-40 disabled:cursor-not-allowed
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
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
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
          <div className="relative w-full max-w-md mx-4 glass rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
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
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all duration-150 disabled:opacity-40"
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
              <div className="glass-subtle rounded-lg p-3.5">
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
                    bg-white/[0.04] border border-white/[0.08]
                    text-slate-200 placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/30
                    disabled:opacity-40
                    transition-all duration-200
                  "
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => {
                  setRestoreTarget(null)
                  setRestoreConfirmText('')
                }}
                disabled={restoreLoading}
                className="
                  px-4 py-2 rounded-lg text-sm font-medium
                  text-slate-400 bg-white/[0.04] border border-white/[0.06]
                  hover:bg-white/[0.08] hover:text-slate-300
                  disabled:opacity-40
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
                  disabled:opacity-40 disabled:cursor-not-allowed
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
        </div>
      )}
    </div>
  )
}
