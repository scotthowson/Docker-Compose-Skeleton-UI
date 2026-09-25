// =============================================================================
// PageState — the one way every page shows "loading", "nothing here" and
// "failed": same spacing, same typography, same retry affordance.
// =============================================================================

import type { ReactNode } from 'react'
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react'

export function LoadingState({ label = 'Loading…', hint, compact = false }: { label?: string; hint?: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'py-8 gap-2' : 'py-20 gap-3'} animate-fade-in`} role="status" aria-live="polite">
      <Loader2 size={compact ? 20 : 26} className="animate-spin text-emerald-500/60" />
      <p className="text-sm text-slate-500">{label}</p>
      {hint && <p className="text-xs text-slate-500/80 max-w-md text-center">{hint}</p>}
    </div>
  )
}

export function EmptyState({ icon, title, hint, action, compact = false }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'py-10' : 'py-20'} text-center gap-2 animate-fade-in`}>
      {icon && <div className="text-slate-500 mb-1">{icon}</div>}
      <p className="text-sm text-slate-400">{title}</p>
      {hint && <p className="text-xs text-slate-500 max-w-md">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', error, onRetry }: { title?: string; error?: Error | string | null; onRetry?: () => void }) {
  const message = typeof error === 'string' ? error : error?.message
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-rose-500/15 rounded-xl p-6 text-center animate-fade-in" role="alert">
      <AlertTriangle size={26} className="text-rose-500/50 mx-auto mb-3" />
      <p className="text-sm text-slate-400 mb-1">{title}</p>
      {message && <p className="text-xs text-slate-500 mb-4 break-words">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-slate-300 transition-colors"
        >
          <RefreshCw size={13} /> Retry
        </button>
      )}
    </div>
  )
}
