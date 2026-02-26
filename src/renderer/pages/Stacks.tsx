// =============================================================================
// Stacks Page — Stack management with polling, actions, batch ops, and toasts
// =============================================================================

import { useCallback, useState, useEffect } from 'react'
import { useApi } from '../hooks/useApi'
import { useStackStore } from '../stores/stackStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToast } from '../components/common/Toast'
import {
  fetchStacks,
  startStack,
  stopStack,
  restartStack,
  updateStack,
  batchStackAction,
  batchStackUpdate,
} from '../api/endpoints'
import type { BatchStackResponse, BatchStackResult, StackInfo } from '../../shared/types'
import StackList from '../components/stacks/StackList'
import StackDetail from '../components/stacks/StackDetail'
import CreateStackOverlay from '../components/stacks/CreateStackOverlay'
import EditStackOverlay from '../components/stacks/EditStackOverlay'
import {
  Loader2, Play, Square, RotateCcw, Download,
  CheckCircle2, XCircle, X, ListChecks, Trash2,
} from 'lucide-react'

// -----------------------------------------------------------------------------
// Stacks Page
// -----------------------------------------------------------------------------

export default function Stacks() {
  const { stacks, setStacks, actionLoading, setActionLoading } = useStackStore()
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const [selectedStackName, setSelectedStackName] = useState<string | null>(null)
  const { addToast } = useToast()

  // Overlay states
  const [showCreateOverlay, setShowCreateOverlay] = useState(false)
  const [editingStackName, setEditingStackName] = useState<string | null>(null)

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false)
  const [selectedStacks, setSelectedStacks] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState<string | null>(null)
  const [batchResults, setBatchResults] = useState<BatchStackResult[] | null>(null)
  const [showBatchProgress, setShowBatchProgress] = useState(false)
  const [batchTotal, setBatchTotal] = useState(0)

  // Poll stacks list every 5 seconds
  const { data: stacksData, refresh } = useApi(fetchStacks, 5000, {
    enabled: isConnected,
  })

  // Sync fetched data into the store
  useEffect(() => {
    if (stacksData?.stacks) {
      setStacks(stacksData.stacks)
    }
  }, [stacksData, setStacks])

  // Find the StackInfo object for the editing stack
  const editingStack: StackInfo | null = editingStackName
    ? stacks.find((s) => s.name === editingStackName) ?? null
    : null

  // Stack action handler
  const handleAction = useCallback(
    async (stackName: string, action: 'start' | 'stop' | 'restart' | 'update') => {
      setActionLoading(stackName)

      const gerund: Record<typeof action, string> = {
        start: 'Starting',
        stop: 'Stopping',
        restart: 'Restarting',
        update: 'Updating',
      }

      addToast({ type: 'info', message: `${gerund[action]} stack "${stackName}"...`, duration: 2000 })

      try {
        const actionFn = {
          start: startStack,
          stop: stopStack,
          restart: restartStack,
          update: updateStack,
        }[action]

        const result = await actionFn(stackName)

        if (result.success) {
          const pastTense: Record<typeof action, string> = {
            start: 'started',
            stop: 'stopped',
            restart: 'restarted',
            update: 'updated',
          }
          addToast({
            type: 'success',
            message: `Stack "${stackName}" ${pastTense[action]} successfully!`,
          })
        } else {
          addToast({
            type: 'error',
            message: `Failed to ${action} "${stackName}": ${result.output || 'Unknown error'}`,
            duration: 6000,
          })
        }

        // Refresh the stacks list after action completes
        refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        addToast({
          type: 'error',
          message: `Failed to ${action} "${stackName}": ${message}`,
          duration: 6000,
        })
      } finally {
        setActionLoading(null)
      }
    },
    [setActionLoading, addToast, refresh],
  )

  // Toggle batch mode on/off
  const handleToggleBatchMode = useCallback(() => {
    setBatchMode((prev) => {
      if (prev) {
        // Turning off: clear selection
        setSelectedStacks(new Set())
      }
      return !prev
    })
  }, [])

  // Toggle a single stack's selection
  const handleToggleSelect = useCallback((name: string) => {
    setSelectedStacks((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }, [])

  // Select all visible stacks
  const handleSelectAll = useCallback(() => {
    const allNames = new Set(stacks.map((s) => s.name))
    setSelectedStacks(allNames)
  }, [stacks])

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedStacks(new Set())
  }, [])

  // Batch action handler
  const handleBatchAction = useCallback(
    async (action: 'start' | 'stop' | 'restart' | 'update') => {
      const names = Array.from(selectedStacks)
      if (names.length === 0) return

      setBatchLoading(action)
      setBatchResults(null)
      setBatchTotal(names.length)
      setShowBatchProgress(true)

      const gerund: Record<typeof action, string> = {
        start: 'Starting',
        stop: 'Stopping',
        restart: 'Restarting',
        update: 'Updating',
      }

      addToast({
        type: 'info',
        message: `${gerund[action]} ${names.length} stack${names.length !== 1 ? 's' : ''}...`,
        duration: 3000,
      })

      try {
        let response: BatchStackResponse

        if (action === 'update') {
          response = await batchStackUpdate(names)
        } else {
          response = await batchStackAction(action, names)
        }

        setBatchResults(response.results)

        const successCount = response.results.filter((r) => r.success).length
        const failCount = response.results.length - successCount

        if (failCount === 0) {
          addToast({
            type: 'success',
            message: `All ${successCount} stack${successCount !== 1 ? 's' : ''} ${action === 'update' ? 'updated' : action + 'ed'} successfully!`,
          })
        } else {
          addToast({
            type: 'warning',
            message: `${successCount} succeeded, ${failCount} failed`,
            duration: 6000,
          })
        }

        refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        addToast({
          type: 'error',
          message: `Batch ${action} failed: ${message}`,
          duration: 6000,
        })
      } finally {
        setBatchLoading(null)
      }
    },
    [selectedStacks, addToast, refresh],
  )

  // Handle edit callback from StackCard
  const handleEdit = useCallback((stackName: string) => {
    setEditingStackName(stackName)
  }, [])

  // Not connected state
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

  // Batch action buttons config
  const batchButtons: {
    action: 'start' | 'stop' | 'restart' | 'update'
    icon: typeof Play
    label: string
    bg: string
    hoverBg: string
  }[] = [
    { action: 'start', icon: Play, label: 'Start Selected', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', hoverBg: 'hover:bg-emerald-500/25' },
    { action: 'stop', icon: Square, label: 'Stop Selected', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/25', hoverBg: 'hover:bg-rose-500/25' },
    { action: 'restart', icon: RotateCcw, label: 'Restart Selected', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/25', hoverBg: 'hover:bg-amber-500/25' },
    { action: 'update', icon: Download, label: 'Update Selected', bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25', hoverBg: 'hover:bg-cyan-500/25' },
  ]

  const isComplete = batchResults !== null && !batchLoading

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-4 md:p-6">
      {selectedStackName && !batchMode ? (
        <StackDetail
          stackName={selectedStackName}
          onBack={() => setSelectedStackName(null)}
          onAction={handleAction}
          isActionLoading={actionLoading === selectedStackName}
          onContainerClick={(containerName) => {
            useSettingsStore.getState().setCurrentPage('containers', { focusContainer: containerName })
          }}
        />
      ) : (
        <StackList
          onAction={handleAction}
          onSelect={(name) => setSelectedStackName(name)}
          onRefresh={refresh}
          onEdit={handleEdit}
          onCreateStack={() => setShowCreateOverlay(true)}
          batchMode={batchMode}
          selectedStacks={selectedStacks}
          onToggleSelect={handleToggleSelect}
          onToggleBatchMode={handleToggleBatchMode}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Create Stack Overlay                                              */}
      {/* ----------------------------------------------------------------- */}
      {showCreateOverlay && (
        <CreateStackOverlay
          onClose={() => setShowCreateOverlay(false)}
          onCreated={refresh}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Edit Stack Overlay                                                */}
      {/* ----------------------------------------------------------------- */}
      {editingStack && (
        <EditStackOverlay
          stack={editingStack}
          onClose={() => setEditingStackName(null)}
          onSaved={refresh}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Floating Batch Action Bar                                         */}
      {/* ----------------------------------------------------------------- */}
      {batchMode && selectedStacks.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <div
            className="
              flex items-center gap-3 px-5 py-3 rounded-2xl
              bg-slate-900/80 backdrop-blur-xl border border-white/10
              shadow-2xl shadow-black/40
            "
          >
            {/* Selection count */}
            <div className="flex items-center gap-2 pr-3 border-r border-white/10">
              <ListChecks size={16} className="text-cyan-400" />
              <span className="text-sm font-semibold text-slate-200 whitespace-nowrap">
                {selectedStacks.size} stack{selectedStacks.size !== 1 ? 's' : ''} selected
              </span>
            </div>

            {/* Action buttons */}
            {batchButtons.map(({ action, icon: Icon, label, bg, hoverBg }) => (
              <button
                key={action}
                onClick={() => handleBatchAction(action)}
                disabled={!!batchLoading}
                title={label}
                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold
                  border transition-all duration-200
                  ${bg} ${hoverBg}
                  disabled:opacity-40 disabled:cursor-not-allowed
                `}
              >
                {batchLoading === action ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Icon size={14} />
                )}
                <span className="hidden sm:inline">{label.replace(' Selected', '')}</span>
              </button>
            ))}

            {/* Select All / Clear */}
            <div className="flex items-center gap-1.5 pl-3 border-l border-white/10">
              <button
                onClick={handleSelectAll}
                className="px-2.5 py-1.5 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
              >
                Select All
              </button>
              <button
                onClick={handleClearSelection}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              >
                <Trash2 size={11} />
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Batch Progress Modal                                              */}
      {/* ----------------------------------------------------------------- */}
      {showBatchProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass p-6 max-w-lg w-full mx-4 space-y-5 animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
                  <ListChecks className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Batch Operation</h3>
                  <p className="text-xs text-slate-500">
                    {isComplete
                      ? `Completed ${batchResults.length} of ${batchTotal}`
                      : `Processing ${batchTotal} stack${batchTotal !== 1 ? 's' : ''}...`}
                  </p>
                </div>
              </div>
              {isComplete && (
                <button
                  onClick={() => {
                    setShowBatchProgress(false)
                    setBatchResults(null)
                  }}
                  className="text-slate-400 hover:text-white transition-colors rounded-md hover:bg-slate-800 p-1.5"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isComplete ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'
                }`}
                style={{
                  width: isComplete
                    ? '100%'
                    : '60%',
                }}
              />
            </div>

            {/* Per-stack results */}
            <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-1.5">
              {batchResults ? (
                batchResults.map((result) => (
                  <div
                    key={result.stack}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg border
                      ${result.success
                        ? 'bg-emerald-500/5 border-emerald-500/15'
                        : 'bg-rose-500/5 border-rose-500/15'}
                    `}
                  >
                    {result.success ? (
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle size={16} className="text-rose-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{result.stack}</p>
                      <p className={`text-[10px] truncate ${result.success ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                        {result.message}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                // Pending placeholders while waiting
                Array.from(selectedStacks).map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white/[0.02] border-white/[0.06]"
                  >
                    <Loader2 size={16} className="text-cyan-400 animate-spin shrink-0" />
                    <p className="text-xs text-slate-400 truncate">{name}</p>
                  </div>
                ))
              )}
            </div>

            {/* Summary + Dismiss */}
            {isComplete && (
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                <p className="text-xs text-slate-500">
                  {batchResults.filter((r) => r.success).length} succeeded,{' '}
                  {batchResults.filter((r) => !r.success).length} failed
                </p>
                <button
                  onClick={() => {
                    setShowBatchProgress(false)
                    setBatchResults(null)
                    setSelectedStacks(new Set())
                    setBatchMode(false)
                  }}
                  className="
                    flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                    bg-emerald-500 text-white hover:bg-emerald-400
                    shadow-lg shadow-emerald-500/20 transition-all
                  "
                >
                  <CheckCircle2 size={14} />
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
