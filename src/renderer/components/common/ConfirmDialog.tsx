// =============================================================================
// ConfirmDialog — the one "are you sure?" every page asks with, in place of
// window.confirm: useConfirm() gives a confirm(opts) that resolves true when
// the person agrees; <ConfirmDialogHost/> (mounted once in App) draws it.
// =============================================================================

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { AlertTriangle, HelpCircle } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** a destructive action: rose accents on the icon and the confirm button */
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  id: number
  resolve: (ok: boolean) => void
}

interface ConfirmState {
  pending: PendingConfirm | null
  ask: (opts: ConfirmOptions) => Promise<boolean>
  settle: (ok: boolean) => void
}

let nextId = 0

const useConfirmStore = create<ConfirmState>((set, get) => ({
  pending: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      // a second question while one is open answers the first with "no"
      get().pending?.resolve(false)
      set({ pending: { ...opts, id: ++nextId, resolve } })
    }),
  settle: (ok) => {
    const p = get().pending
    if (!p) return
    set({ pending: null })
    p.resolve(ok)
  },
}))

/** Ask before a destructive or surprising action; resolves true when the person confirms, false on cancel, Escape or a backdrop click */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  return useConfirmStore((s) => s.ask)
}

/** The dialog every confirm() renders in; mount it once, near the toasts */
export function ConfirmDialogHost() {
  const pending = useConfirmStore((s) => s.pending)
  const settle = useConfirmStore((s) => s.settle)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Escape answers "no" — captured so the overlay underneath does not also see it
  useEffect(() => {
    if (!pending) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      settle(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [pending, settle])

  if (!pending) return null
  const danger = !!pending.danger

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => settle(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className={`glass rounded-2xl p-6 w-full max-w-sm mx-4 border animate-scale-in ${danger ? 'border-rose-500/20' : 'border-white/10'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-rose-500/20' : 'bg-amber-500/20'}`}>
            {danger ? <AlertTriangle className="w-5 h-5 text-rose-400" /> : <HelpCircle className="w-5 h-5 text-amber-400" />}
          </div>
          <h3 id="confirm-dialog-title" className="text-white font-semibold">{pending.title}</h3>
        </div>
        <p id="confirm-dialog-message" className="text-sm text-slate-300 mb-4 whitespace-pre-line break-words">{pending.message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => settle(false)}
            className="flex-1 px-4 py-2 rounded-lg glass text-sm text-slate-300 hover:bg-white/5 transition-colors"
          >
            {pending.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => settle(true)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              danger
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/20 hover:bg-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
            }`}
          >
            {pending.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
