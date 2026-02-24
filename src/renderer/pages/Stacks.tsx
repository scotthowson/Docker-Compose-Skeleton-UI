// =============================================================================
// Stacks Page — Stack management with polling, actions, and toast notifications
// =============================================================================

import { useCallback, useState, useEffect, useRef } from 'react'
import { useApi } from '../hooks/useApi'
import { useStackStore } from '../stores/stackStore'
import { useConnectionStore } from '../stores/connectionStore'
import {
  fetchStacks,
  startStack,
  stopStack,
  restartStack,
  updateStack,
} from '../api/endpoints'
import StackList from '../components/stacks/StackList'
import StackDetail from '../components/stacks/StackDetail'
import { CheckCircle2, XCircle, Info, X, Loader2 } from 'lucide-react'

// -----------------------------------------------------------------------------
// Toast notification system
// -----------------------------------------------------------------------------

interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  title: string
  message: string
}

let toastId = 0

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            glass flex items-start gap-3 px-4 py-3 shadow-2xl animate-in
            ${
              t.type === 'success'
                ? 'border-l-2 border-l-emerald-500/70'
                : t.type === 'error'
                  ? 'border-l-2 border-l-rose-500/70'
                  : 'border-l-2 border-l-cyan-500/70'
            }
          `}
        >
          <div className="shrink-0 mt-0.5">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {t.type === 'error' && <XCircle className="w-4 h-4 text-rose-400" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-cyan-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200">{t.title}</p>
            <p className="text-xs text-slate-400 mt-0.5 break-words">{t.message}</p>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Stacks Page
// -----------------------------------------------------------------------------

export default function Stacks() {
  const { setStacks, actionLoading, setActionLoading } = useStackStore()
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const [selectedStackName, setSelectedStackName] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

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

  // Toast management
  const addToast = useCallback((type: Toast['type'], title: string, message: string) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, type, title, message }])

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      toastTimers.current.delete(id)
    }, 5000)
    toastTimers.current.set(id, timer)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = toastTimers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      toastTimers.current.delete(id)
    }
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timer) => clearTimeout(timer))
      toastTimers.current.clear()
    }
  }, [])

  // Stack action handler
  const handleAction = useCallback(
    async (stackName: string, action: 'start' | 'stop' | 'restart' | 'update') => {
      setActionLoading(stackName)

      const actionLabels: Record<typeof action, string> = {
        start: 'Starting',
        stop: 'Stopping',
        restart: 'Restarting',
        update: 'Updating',
      }

      addToast('info', `${actionLabels[action]}...`, `${actionLabels[action]} stack "${stackName}"`)

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
          addToast(
            'success',
            `Stack ${pastTense[action]}`,
            `"${stackName}" has been ${pastTense[action]} successfully.`,
          )
        } else {
          addToast(
            'error',
            `Action failed`,
            `Failed to ${action} "${stackName}": ${result.output || 'Unknown error'}`,
          )
        }

        // Refresh the stacks list after action completes
        refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        addToast('error', `Action failed`, `Failed to ${action} "${stackName}": ${message}`)
      } finally {
        setActionLoading(null)
      }
    },
    [setActionLoading, addToast, refresh],
  )

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

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
      {selectedStackName ? (
        <StackDetail
          stackName={selectedStackName}
          onBack={() => setSelectedStackName(null)}
          onAction={handleAction}
          isActionLoading={actionLoading === selectedStackName}
        />
      ) : (
        <StackList
          onAction={handleAction}
          onSelect={(name) => setSelectedStackName(name)}
          onRefresh={refresh}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
