// =============================================================================
// ProgressCard — the step strip the deploy dialog shows (Merged → Pull → Create
// → Start → Health), made reusable: a row of steps that light up as work
// proceeds, a line saying what is happening now, and the lines the work
// reported so far. Drives the Proxmox link and fleet joins in the wizard and
// on the Proxmox page.
// =============================================================================

import { useEffect, useRef } from 'react'
import { CheckCircle, Circle, Loader2, XCircle, MinusCircle } from 'lucide-react'

export interface ProgressStep {
  label: string
  hint?: string
}

export type ProgressState = 'idle' | 'running' | 'done' | 'failed'

export interface ProgressLine {
  text: string
  tone?: 'ok' | 'warn' | 'bad' | 'muted' | 'plain'
}

interface ProgressCardProps {
  steps: readonly ProgressStep[]
  /** Index of the step in progress (steps before it are done) */
  current: number
  state: ProgressState
  /** What is happening right now, under the strip */
  status?: string
  lines?: ProgressLine[]
  /** Steps at or after a failure that were never reached are shown as skipped */
  compact?: boolean
  className?: string
}

const TONE: Record<NonNullable<ProgressLine['tone']>, string> = {
  ok: 'text-emerald-300',
  warn: 'text-amber-300',
  bad: 'text-rose-300',
  muted: 'text-slate-500',
  plain: 'text-slate-300',
}

export default function ProgressCard({ steps, current, state, status, lines = [], compact = false, className = '' }: ProgressCardProps) {
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length])
  const cols = Math.min(steps.length, 6)
  return (
    <div className={`rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3 ${className}`}>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {steps.map((st, i) => {
          const done = state === 'done' ? true : i < current
          const active = state === 'running' && i === current
          const failed = state === 'failed' && i === current
          const skipped = state === 'failed' && i > current
          const cls = done ? 'bg-emerald-500/10 border-emerald-500/20'
            : active ? 'bg-cyan-500/10 border-cyan-500/25'
            : failed ? 'bg-rose-500/10 border-rose-500/25'
            : 'bg-white/[0.02] border-white/5'
          const text = done ? 'text-emerald-300' : active ? 'text-cyan-200' : failed ? 'text-rose-300' : 'text-slate-500'
          return (
            <div key={st.label} className={`rounded-lg px-1.5 ${compact ? 'py-1.5' : 'py-2'} text-center border transition-all duration-300 ${cls}`}>
              <div className="flex items-center justify-center h-4">
                {done ? <CheckCircle size={13} className="text-emerald-400" />
                  : active ? <Loader2 size={13} className="text-cyan-400 animate-spin" />
                  : failed ? <XCircle size={13} className="text-rose-400" />
                  : skipped ? <MinusCircle size={11} className="text-slate-600" />
                  : <Circle size={10} className="text-slate-600" />}
              </div>
              <p className={`text-[11px] font-medium mt-1 truncate ${text}`}>{st.label}</p>
              {st.hint && !compact && <p className="text-[9px] text-slate-600 truncate">{st.hint}</p>}
            </div>
          )
        })}
      </div>
      {status && (
        <p className={`text-xs flex items-center gap-2 ${state === 'failed' ? 'text-rose-300' : state === 'done' ? 'text-emerald-300' : 'text-slate-300'}`}>
          {state === 'running' && <Loader2 size={12} className="animate-spin text-cyan-400 shrink-0" />}
          {state === 'done' && <CheckCircle size={12} className="text-emerald-400 shrink-0" />}
          {state === 'failed' && <XCircle size={12} className="text-rose-400 shrink-0" />}
          <span className="min-w-0 break-words">{status}</span>
        </p>
      )}
      {lines.length > 0 && (
        <div ref={logRef} className={`rounded-lg bg-slate-950/70 border border-white/5 px-3 py-2 ${compact ? 'max-h-32' : 'max-h-48'} overflow-y-auto scrollbar-thin space-y-0.5`}>
          {lines.map((l, i) => (
            <p key={i} className={`text-[11px] font-mono leading-relaxed break-words ${TONE[l.tone ?? 'plain']}`}>{l.text}</p>
          ))}
        </div>
      )}
    </div>
  )
}
