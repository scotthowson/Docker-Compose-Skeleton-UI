// =============================================================================
// Small pieces the fleet UI shares: copy chips, time-ago, status chips, the
// sheet that hosts forms on phones (bottom) and desktops (centred).
// =============================================================================

import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Check, X } from 'lucide-react'

export function ago(epoch: number): string {
  if (!epoch) return 'never'
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epoch))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function hostOf(url: string): string {
  const m = /^[a-z]+:\/\/([^/]+)/i.exec(url)
  return m ? m[1] : url
}

export function CopyChip({ text, label, className = '' }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) }).catch(() => {}) }}
      className={`h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:bg-white/10 flex items-center gap-1.5 shrink-0 ${className}`}>
      {done ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />} {done ? 'Copied' : label}
    </button>
  )
}

export const MATCH_LABEL: Record<string, string> = {
  uuid: 'matched by the VM\'s SMBIOS uuid',
  ip: 'matched by address',
  name: 'matched by name',
  provision: 'built by the hub — no guest matched yet (Test re-matches)',
  manual: 'mapped by hand',
}

export function Sheet({ title, subtitle, icon, onClose, children, wide = false }: { title: string; subtitle?: string; icon?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto scrollbar-thin glass rounded-t-3xl sm:rounded-2xl p-5 animate-slide-up`} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-start gap-3 mb-4">
          {icon && <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
            {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5" aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export const inputCls = 'w-full h-10 px-3 rounded-lg bg-slate-800/50 border border-white/10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/40'
export const labelCls = 'block text-xs font-medium text-slate-400 mb-1'
