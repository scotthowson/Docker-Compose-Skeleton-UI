// =============================================================================
// StackControls — every stack with its state and the four actions, inline
// =============================================================================

import React, { useCallback, useState } from 'react'
import { Boxes, Play, Square, RotateCw, ArrowUpCircle, Loader2, ChevronRight } from 'lucide-react'
import type { StackInfo } from '../../../shared/types'
import { startStack, stopStack, restartStack, updateStack } from '../../api/endpoints'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useContainerStore } from '../../stores/containerStore'
import { useToast } from '../common/Toast'
import { CardHeader, CardLoading, CardError, CardEmpty } from './cardShared'

type Op = 'start' | 'stop' | 'restart' | 'update'

export default function StackControls({ stacks, error, onRetry, onRefresh }: {
  stacks: StackInfo[] | null
  error?: Error | null
  onRetry?: () => void
  onRefresh?: () => void
}) {
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const refreshContainers = useContainerStore((s) => s.refresh)
  const { addToast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const run = useCallback(async (stack: string, op: Op) => {
    if (busy) return
    if (op === 'stop' && !window.confirm(`Stop every container of ${stack}?`)) return
    if (op === 'restart' && !window.confirm(`Restart ${stack}?`)) return
    if (op === 'update' && !window.confirm(`Pull the images of ${stack} and recreate what changed?`)) return
    setBusy(`${stack}:${op}`)
    try {
      const fn = { start: startStack, stop: stopStack, restart: restartStack, update: updateStack }[op]
      const res = await fn(stack)
      addToast({ type: res.success ? 'success' : 'error', message: res.success ? `${stack}: ${op} done` : `${stack}: ${op} failed — ${(res as { output?: string }).output || 'see the stack activity'}`, duration: res.success ? 3500 : 8000 })
    } catch (err) {
      addToast({ type: 'error', message: `${stack}: ${err instanceof Error ? err.message : 'request failed'}` })
    } finally {
      setBusy(null)
      onRefresh?.()
      void refreshContainers()
    }
  }, [busy, addToast, onRefresh, refreshContainers])

  const running = stacks?.filter((s) => s.status === 'running').length ?? 0

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <CardHeader icon={<Boxes size={15} />} title="Stack Controls" count={stacks ? `${running}/${stacks.length} running` : undefined} />
      {error && !stacks ? (
        <CardError error={error} onRetry={onRetry} />
      ) : stacks === null ? (
        <CardLoading label="Loading stacks…" />
      ) : stacks.length === 0 ? (
        <CardEmpty icon={<Boxes size={22} />} title="No stacks yet" hint="Deploy a template or create a stack on the Stacks page." />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 space-y-1">
          {stacks.map((s) => {
            const isRunning = s.status === 'running'
            const b = (op: Op) => busy === `${s.name}:${op}`
            const btn = 'p-1.5 rounded-md transition-colors disabled:opacity-40'
            return (
              <div key={s.name} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
                <span className={`h-2 w-2 rounded-full shrink-0 ${isRunning ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-600'}`} />
                <button onClick={() => setCurrentPage('stacks', { highlight: s.name })} className="flex-1 min-w-0 text-left" title={`Open ${s.name}`}>
                  <span className="block text-xs font-medium text-slate-200 truncate font-mono">{s.name}</span>
                  <span className="block text-[10px] text-slate-500">{isRunning ? `${s.running_containers} running` : 'stopped'}</span>
                </button>
                {isAdmin ? (
                  <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                    {!isRunning && (
                      <button onClick={() => run(s.name, 'start')} disabled={!!busy} className={`${btn} text-emerald-400 hover:bg-emerald-500/10`} title="Start">
                        {b('start') ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                      </button>
                    )}
                    {isRunning && (
                      <>
                        <button onClick={() => run(s.name, 'restart')} disabled={!!busy} className={`${btn} text-amber-400 hover:bg-amber-500/10`} title="Restart">
                          {b('restart') ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
                        </button>
                        <button onClick={() => run(s.name, 'update')} disabled={!!busy} className={`${btn} text-violet-400 hover:bg-violet-500/10`} title="Pull images and recreate what changed">
                          {b('update') ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpCircle size={13} />}
                        </button>
                        <button onClick={() => run(s.name, 'stop')} disabled={!!busy} className={`${btn} text-rose-400 hover:bg-rose-500/10`} title="Stop">
                          {b('stop') ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <ChevronRight size={13} className="text-slate-600" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
