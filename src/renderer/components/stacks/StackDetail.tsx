// =============================================================================
// StackDetail — Detailed view for a selected stack with containers, logs, actions
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Download,
  Loader2,
  Box,
  Terminal,
  Server,
  Clock,
  Shield,
  Network,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  RefreshCw,
  FileCode2,
  Copy,
  Pencil,
  X,
} from 'lucide-react'
import type { StackDetail as StackDetailType, ContainerInfo } from '../../../shared/types'
import { fetchStack, fetchStackLogs, fetchStackCompose, cloneStack, renameStack } from '../../api/endpoints'
import { useToast } from '../common/Toast'
import { ComposeViewer } from './ComposeViewer'

interface Props {
  stackName: string
  onBack: () => void
  onAction: (stackName: string, action: 'start' | 'stop' | 'restart' | 'update') => void
  isActionLoading: boolean
  onContainerClick?: (containerName: string) => void
  isAdmin?: boolean
}

/** Format seconds into human-readable uptime */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours < 24) return `${hours}h ${mins}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

/** Pretty-print stack category names */
function formatStackName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Health status icon and color */
function healthIndicator(health: string) {
  const h = health.toLowerCase()
  if (h === 'healthy') return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
  if (h === 'unhealthy') return { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' }
  if (h === 'starting') return { icon: Loader2, color: 'text-amber-400', bg: 'bg-amber-500/10' }
  return { icon: Shield, color: 'text-slate-500', bg: 'bg-slate-500/10' }
}

/** Container state badge */
function stateBadge(state: string) {
  const s = state.toLowerCase()
  if (s === 'running')
    return 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
  if (s === 'exited' || s === 'dead')
    return 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25'
  if (s === 'restarting' || s === 'created')
    return 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25'
  if (s === 'paused')
    return 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/25'
  return 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25'
}

export default function StackDetail({ stackName, onBack, onAction, isActionLoading, onContainerClick, isAdmin = false }: Props) {
  const [detail, setDetail] = useState<StackDetailType | null>(null)
  const [logs, setLogs] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'containers' | 'logs' | 'services'>('containers')
  const [confirmAction, setConfirmAction] = useState<'stop' | 'restart' | 'update' | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [composeContent, setComposeContent] = useState<string | undefined>(undefined)
  const [composeLoading, setComposeLoading] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { addToast } = useToast()

  // Clone state
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneName, setCloneName] = useState('')
  const [cloneLoading, setCloneLoading] = useState(false)

  // Rename state
  const [renameMode, setRenameMode] = useState(false)
  const [renameTo, setRenameTo] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)

  // Fetch compose file content
  const handleViewCompose = useCallback(async () => {
    setComposeLoading(true)
    try {
      const data = await fetchStackCompose(stackName)
      setComposeContent(data.content)
      setShowCompose(true)
    } catch {
      // Still open the viewer — it will show the placeholder
      setComposeContent(undefined)
      setShowCompose(true)
    } finally {
      setComposeLoading(false)
    }
  }, [stackName])

  // Clone stack handler
  const handleClone = useCallback(async () => {
    if (!cloneName.trim()) return
    setCloneLoading(true)
    try {
      const result = await cloneStack(stackName, cloneName.trim())
      if (result.success) {
        addToast({ type: 'success', message: `Stack cloned as "${cloneName.trim()}"` })
        setShowCloneModal(false)
        setCloneName('')
      } else {
        addToast({ type: 'error', message: result.message || 'Clone failed', duration: 6000 })
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Clone failed', duration: 6000 })
    } finally {
      setCloneLoading(false)
    }
  }, [stackName, cloneName, addToast])

  // Rename stack handler
  const handleRename = useCallback(async () => {
    if (!renameTo.trim() || renameTo.trim() === stackName) return
    setRenameLoading(true)
    try {
      const result = await renameStack(stackName, renameTo.trim())
      if (result.success) {
        addToast({ type: 'success', message: `Stack renamed to "${renameTo.trim()}"` })
        setRenameMode(false)
        onBack() // Go back to list since the stack name changed
      } else {
        addToast({ type: 'error', message: result.message || 'Rename failed', duration: 6000 })
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Rename failed', duration: 6000 })
    } finally {
      setRenameLoading(false)
    }
  }, [stackName, renameTo, addToast, onBack])

  // Fetch stack detail
  const loadDetail = useCallback(async () => {
    try {
      const data = await fetchStack(stackName)
      setDetail(data)
    } catch {
      // Keep previous detail on error
    } finally {
      setLoading(false)
    }
  }, [stackName])

  // Fetch stack logs
  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const data = await fetchStackLogs(stackName)
      setLogs(data.logs)
    } catch {
      setLogs('Failed to fetch logs.')
    } finally {
      setLogsLoading(false)
    }
  }, [stackName])

  // Initial load + polling
  useEffect(() => {
    setLoading(true)
    loadDetail()

    pollRef.current = setInterval(loadDetail, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadDetail])

  // Load logs when tab switches to logs
  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs()
    }
  }, [activeTab, loadLogs])

  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs' && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, activeTab])

  const isRunning = detail?.status === 'running'

  const handleConfirmedAction = (action: 'start' | 'stop' | 'restart' | 'update') => {
    setConfirmAction(null)
    onAction(stackName, action)
  }

  // Skeleton loading state
  if (loading && !detail) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Back button skeleton */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
          <div className="w-48 h-6 rounded bg-white/5 animate-pulse" />
        </div>
        {/* Card skeleton */}
        <div className="glass p-6 space-y-4">
          <div className="w-64 h-8 rounded bg-white/5 animate-pulse" />
          <div className="w-32 h-5 rounded bg-white/5 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
        {/* Table skeleton */}
        <div className="glass p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Confirmation modal overlay */}
      {confirmAction && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Confirm Action</h3>
                <p className="text-xs text-slate-400">
                  {confirmAction === 'stop' && 'This will stop all containers in this stack.'}
                  {confirmAction === 'restart' && 'This will restart all containers in this stack.'}
                  {confirmAction === 'update' && 'This will pull latest images and apply rolling updates.'}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Are you sure you want to <span className="font-semibold text-white">{confirmAction}</span>{' '}
              <span className="font-mono text-emerald-400">{stackName}</span>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmedAction(confirmAction)}
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg border transition-all
                  ${
                    confirmAction === 'stop'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/25 hover:bg-rose-500/25'
                      : confirmAction === 'restart'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25'
                        : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25 hover:bg-cyan-500/25'
                  }
                `}
              >
                {confirmAction.charAt(0).toUpperCase() + confirmAction.slice(1)}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Back button + stack name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          title="Back to stacks (Esc)"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10 hover:border-white/15 transition-all text-sm press"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-white/5 border border-white/5 ml-1">Esc</kbd>
        </button>
        <div className="flex-1 min-w-0">
          {renameMode ? (
            <div className="flex items-center gap-2">
              <input
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                placeholder={stackName}
                autoFocus
                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-mono placeholder-slate-500 focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none w-56"
              />
              <button
                onClick={handleRename}
                disabled={renameLoading || !renameTo.trim() || renameTo.trim() === stackName}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium border border-emerald-500/20 hover:bg-emerald-500/25 disabled:opacity-50 transition-all"
              >
                {renameLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
              </button>
              <button
                onClick={() => { setRenameMode(false); setRenameTo('') }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {formatStackName(stackName)}
                </h2>
                <p className="text-xs text-slate-500 font-mono">{stackName}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => { setRenameMode(true); setRenameTo(stackName) }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                  title="Rename stack"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status + actions card */}
      <div className="glass p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Status info */}
          <div className="flex items-center gap-4">
            {/* Status badge */}
            <span
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                ${
                  isRunning
                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
                    : 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25'
                }
              `}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              {isRunning ? 'Running' : 'Stopped'}
            </span>

            {/* Container count */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Box className="w-3.5 h-3.5 text-slate-500" />
              <span>
                <span className="font-semibold text-slate-200">
                  {detail?.running_containers ?? 0}
                </span>{' '}
                container{(detail?.running_containers ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Services count */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>
                <span className="font-semibold text-slate-200">
                  {detail?.services?.length ?? 0}
                </span>{' '}
                service{(detail?.services?.length ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Start */}
            <button
              onClick={() => handleConfirmedAction('start')}
              disabled={isRunning || isActionLoading}
              className={`
                inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium
                border transition-all duration-200
                ${
                  isRunning || isActionLoading
                    ? 'bg-white/[0.03] text-slate-500 border-white/[0.03] cursor-not-allowed'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30'
                }
              `}
            >
              {isActionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Start
            </button>

            {/* Stop */}
            <button
              onClick={() => setConfirmAction('stop')}
              disabled={!isRunning || isActionLoading}
              className={`
                inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium
                border transition-all duration-200
                ${
                  !isRunning || isActionLoading
                    ? 'bg-white/[0.03] text-slate-500 border-white/[0.03] cursor-not-allowed'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/30'
                }
              `}
            >
              {isActionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              Stop
            </button>

            {/* Restart */}
            <button
              onClick={() => setConfirmAction('restart')}
              disabled={!isRunning || isActionLoading}
              className={`
                inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium
                border transition-all duration-200
                ${
                  !isRunning || isActionLoading
                    ? 'bg-white/[0.03] text-slate-500 border-white/[0.03] cursor-not-allowed'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30'
                }
              `}
            >
              {isActionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              Restart
            </button>

            {/* Update — admin only (pulls images + redeploys) */}
            {isAdmin && (
              <button
                onClick={() => setConfirmAction('update')}
                disabled={isActionLoading}
                className={`
                  inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium
                  border transition-all duration-200
                  ${
                    isActionLoading
                      ? 'bg-white/[0.03] text-slate-500 border-white/[0.03] cursor-not-allowed'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/30'
                  }
                `}
              >
                {isActionLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Update
              </button>
            )}

            {/* View Compose */}
            <button
              onClick={handleViewCompose}
              disabled={composeLoading}
              className={`
                inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium
                border transition-all duration-200
                ${
                  composeLoading
                    ? 'bg-white/[0.03] text-slate-500 border-white/[0.03] cursor-not-allowed'
                    : 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-500/30'
                }
              `}
            >
              {composeLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCode2 className="w-3.5 h-3.5" />
              )}
              Compose
            </button>

            {/* Clone */}
            {isAdmin && (
              <button
                onClick={() => { setShowCloneModal(true); setCloneName('') }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-all duration-200 bg-slate-500/10 text-slate-300 border-slate-500/20 hover:bg-slate-500/20 hover:border-slate-500/30"
              >
                <Copy className="w-3.5 h-3.5" />
                Clone
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compose file viewer overlay */}
      {showCompose && (
        <ComposeViewer
          stackName={stackName}
          content={composeContent}
          onClose={() => setShowCompose(false)}
        />
      )}

      {/* Clone modal */}
      {showCloneModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowCloneModal(false)}>
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-sm mx-4 border border-white/10 shadow-2xl shadow-black/40 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Copy size={14} className="text-cyan-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Clone Stack</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Create a copy of <span className="font-mono text-emerald-400">{stackName}</span> with a new name.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">New Stack Name</label>
              <input
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleClone()}
                placeholder="my-stack-copy"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/60 text-sm text-white font-mono placeholder-slate-500 border border-white/5 focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloneModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/5 text-sm text-slate-300 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={cloneLoading || !cloneName.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/25 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {cloneLoading ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                Clone
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Tab navigation */}
      <div className="flex items-center gap-1 p-1 glass-subtle w-fit">
        {(['containers', 'services', 'logs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200
              ${
                activeTab === tab
                  ? 'bg-white/10 text-slate-100 ring-1 ring-white/15'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }
            `}
          >
            {tab === 'containers' && <span className="inline-flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> Containers</span>}
            {tab === 'services' && <span className="inline-flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> Services</span>}
            {tab === 'logs' && <span className="inline-flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> Logs</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'containers' && (
        <ContainersTable containers={detail?.containers ?? []} onContainerClick={onContainerClick} />
      )}

      {activeTab === 'services' && (
        <ServicesList services={detail?.services ?? []} />
      )}

      {activeTab === 'logs' && (
        <LogViewer
          logs={logs}
          loading={logsLoading}
          onRefresh={loadLogs}
          logEndRef={logEndRef}
        />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function ContainersTable({ containers, onContainerClick }: { containers: ContainerInfo[]; onContainerClick?: (name: string) => void }) {
  if (containers.length === 0) {
    return (
      <div className="glass-subtle flex flex-col items-center justify-center py-12 rounded-xl">
        <Box className="w-8 h-8 text-slate-500 mb-2" />
        <p className="text-sm text-slate-500">No containers in this stack</p>
      </div>
    )
  }

  return (
    <div className="glass overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                State
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Health
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Image
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Uptime
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Ports
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Restarts
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {containers.map((c) => {
              const health = healthIndicator(c.health)
              const HealthIcon = health.icon
              return (
                <tr
                  key={c.name}
                  onClick={() => onContainerClick?.(c.name)}
                  className={`hover:bg-white/[0.03] transition-colors ${onContainerClick ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium font-mono ${onContainerClick ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-200'}`}>
                      {c.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stateBadge(c.state)}`}
                    >
                      {c.state}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className={`flex items-center justify-center w-5 h-5 rounded ${health.bg}`}>
                        <HealthIcon className={`w-3 h-3 ${health.color} ${c.health.toLowerCase() === 'starting' ? 'animate-spin' : ''}`} />
                      </div>
                      <span className={`text-xs ${health.color}`}>{c.health || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-400 font-mono truncate max-w-[200px] block">
                      {c.image}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {c.state.toLowerCase() === 'running'
                        ? formatUptime(c.uptime_seconds)
                        : '--'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.ports ? (
                      <div className="flex flex-wrap gap-1">
                        {c.ports.split(',').map((port) => (
                          <span
                            key={port.trim()}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 text-[10px] text-cyan-400 font-mono ring-1 ring-cyan-500/20"
                          >
                            <Network className="w-2.5 h-2.5" />
                            {port.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-mono ${
                        c.restart_count > 0 ? 'text-amber-400' : 'text-slate-500'
                      }`}
                    >
                      {c.restart_count}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ServicesList({ services }: { services: string[] }) {
  if (services.length === 0) {
    return (
      <div className="glass-subtle flex flex-col items-center justify-center py-12 rounded-xl">
        <Server className="w-8 h-8 text-slate-500 mb-2" />
        <p className="text-sm text-slate-500">No services defined</p>
      </div>
    )
  }

  return (
    <div className="glass p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {services.map((service) => (
          <div
            key={service}
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <ChevronDown className="w-3.5 h-3.5 text-emerald-400 rotate-[-90deg]" />
            </div>
            <span className="text-sm text-slate-200 font-mono truncate">{service}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LogViewer({
  logs,
  loading,
  onRefresh,
  logEndRef,
}: {
  logs: string
  loading: boolean
  onRefresh: () => void
  logEndRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div className="glass overflow-hidden">
      {/* Log header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-400">Stack Logs</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Log content */}
      <div className="p-4 max-h-96 overflow-y-auto scrollbar-thin font-mono text-xs leading-relaxed">
        {loading && !logs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : logs ? (
          <>
            {logs.split('\n').map((line, i) => (
              <div
                key={i}
                className={`py-0.5 ${
                  line.includes('ERROR') || line.includes('error')
                    ? 'text-rose-400'
                    : line.includes('WARN') || line.includes('warn')
                      ? 'text-amber-400'
                      : line.includes('SUCCESS') || line.includes('success')
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                }`}
              >
                <span className="text-slate-500 select-none mr-3">{String(i + 1).padStart(3, ' ')}</span>
                {line}
              </div>
            ))}
            <div ref={logEndRef} />
          </>
        ) : (
          <div className="text-center text-slate-500 py-8">No logs available</div>
        )}
      </div>
    </div>
  )
}
