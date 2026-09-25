// =============================================================================
// Shared bits for dashboard cards: header, compact states, colour tokens
// =============================================================================

import React from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'

/** Header every card uses: icon, title, optional count and actions on the right */
export function CardHeader({ icon, title, count, right }: { icon: React.ReactNode; title: string; count?: number | string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-slate-400">{icon}</span>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      {count !== undefined && <span className="text-xs text-slate-600">({count})</span>}
      {right && <div className="ml-auto flex items-center gap-1.5">{right}</div>}
    </div>
  )
}

export function CardLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500" role="status">
      <Loader2 size={14} className="animate-spin text-emerald-500/60" />
      {label}
    </div>
  )
}

export function CardError({ error, onRetry }: { error: Error | string | null | undefined; onRetry?: () => void }) {
  const text = error instanceof Error ? error.message : (error || 'Could not load')
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <AlertCircle size={16} className="text-rose-400" />
      <p className="text-xs text-slate-400 max-w-[28ch]">{text}</p>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors">
          <RefreshCw size={11} /> Try again
        </button>
      )}
    </div>
  )
}

export function CardEmpty({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center">
      {icon && <div className="text-slate-600 mb-1">{icon}</div>}
      <p className="text-xs font-medium text-slate-400">{title}</p>
      {hint && <p className="text-[11px] text-slate-500 max-w-[32ch]">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Accent colours a user can pick; class names are spelled out so Tailwind keeps them */
export const ACCENTS: Record<string, { text: string; bg: string; ring: string; dot: string }> = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10 group-hover:bg-emerald-500/15', ring: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  cyan:    { text: 'text-cyan-400',    bg: 'bg-cyan-500/10 group-hover:bg-cyan-500/15',       ring: 'border-cyan-500/20',    dot: 'bg-cyan-400' },
  violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/10 group-hover:bg-violet-500/15',   ring: 'border-violet-500/20',  dot: 'bg-violet-400' },
  amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/10 group-hover:bg-amber-500/15',     ring: 'border-amber-500/20',   dot: 'bg-amber-400' },
  rose:    { text: 'text-rose-400',    bg: 'bg-rose-500/10 group-hover:bg-rose-500/15',       ring: 'border-rose-500/20',    dot: 'bg-rose-400' },
  blue:    { text: 'text-blue-400',    bg: 'bg-blue-500/10 group-hover:bg-blue-500/15',       ring: 'border-blue-500/20',    dot: 'bg-blue-400' },
  teal:    { text: 'text-teal-400',    bg: 'bg-teal-500/10 group-hover:bg-teal-500/15',       ring: 'border-teal-500/20',    dot: 'bg-teal-400' },
  orange:  { text: 'text-orange-400',  bg: 'bg-orange-500/10 group-hover:bg-orange-500/15',   ring: 'border-orange-500/20',  dot: 'bg-orange-400' },
  pink:    { text: 'text-pink-400',    bg: 'bg-pink-500/10 group-hover:bg-pink-500/15',       ring: 'border-pink-500/20',    dot: 'bg-pink-400' },
  slate:   { text: 'text-slate-300',   bg: 'bg-slate-500/10 group-hover:bg-slate-500/15',     ring: 'border-slate-500/20',   dot: 'bg-slate-400' },
}
export const ACCENT_NAMES = Object.keys(ACCENTS)

/** Props every card receives from the grid (all optional so existing cards stay untouched) */
export interface CardCommonProps {
  cardConfig?: unknown
  onSaveConfig?: (cfg: unknown) => Promise<boolean> | void
  dashboardEditMode?: boolean
}
