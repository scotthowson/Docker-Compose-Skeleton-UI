// =============================================================================
// Small pieces the fleet UI shares: copy chips, time-ago, status chips, the
// sheet that hosts forms on phones (bottom) and desktops (centred).
//
// The fleet's colour is violet — the hub, a VM, "this runs in a VM": its capsules,
// its scope chips, the icon tile of its sheets, the focus and the chosen preset of
// its forms. Amber stays for "needs attention" (a DCS install nobody linked, a
// token that cannot create VMs, a build to finish by hand).
// =============================================================================

import { useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Check, X, ShieldAlert } from 'lucide-react'
import { useModalA11y } from '../../hooks/useModalA11y'
import { BTN_CARD_QUIET, BTN_ICON } from '../../lib/ui'
import type { HubFirewall } from '../../../shared/types'

/** amber, kept for "needs attention" in the fleet's screens (a DCS install nobody linked yet, a member without its guest): a tinted action, the way TONE_OK is emerald */
export const TONE_ATTN = 'bg-amber-500/10 border border-amber-500/25 text-amber-200 hover:bg-amber-500/20'

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
      className={`${BTN_CARD_QUIET} ${className}`}>
      {done ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />} {done ? 'Copied' : label}
    </button>
  )
}

/** firewalld on the hub blocks (or, as its zone ships, would block) the port the VMs fetch DCS from and join on */
export function HubFirewallNote({ fw }: { fw?: HubFirewall | null }) {
  if (!fw?.active || fw.open !== false) return null
  const cmd = `sudo firewall-cmd --permanent${fw.zone ? ` --zone=${fw.zone}` : ''} --add-port=${fw.port}/tcp && sudo firewall-cmd --reload`
  return (
    <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-3 space-y-2">
      <p className="text-[11px] text-rose-300 flex items-start gap-2">
        <ShieldAlert size={13} className="text-rose-300 shrink-0 mt-0.5" />
        <span>
          {fw.certain ? <>firewalld on this hub <b>blocks port {fw.port}/tcp</b></> : <>firewalld on this hub keeps <b>port {fw.port}/tcp</b> closed{fw.zone ? <> in its <span className="font-mono">{fw.zone}</span> zone</> : null} unless it was opened by hand</>}
          {' '}— every new VM fetches DCS from that port and joins on it, so a build stops at <i>Install</i>. Open it on the hub (once):
        </span>
      </p>
      <div className="flex items-start gap-2">
        {/* the whole command, wrapped and selectable with one click, so it can be copied by hand too */}
        <code className="flex-1 min-w-0 rounded bg-black/30 px-2 py-1.5 text-[11px] leading-relaxed text-slate-200 font-mono break-all select-all cursor-text">{cmd}</code>
        <CopyChip text={cmd} label="Copy" />
      </div>
    </div>
  )
}

export const MATCH_LABEL: Record<string, string> = {
  uuid: 'matched by the VM\'s SMBIOS UUID',
  ip: 'matched by address',
  name: 'matched by name',
  provision: 'built by the hub — no guest matched yet (“Test the link” matches it)',
  manual: 'mapped by hand',
}

/** A sheet (a bottom sheet on a phone, a centred dialog above): Escape closes it, focus moves in (the first field, else the close button), cycles inside and returns to what opened it */
export function Sheet({ title, subtitle, icon, onClose, children, wide = false }: { title: string; subtitle?: ReactNode; icon?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  useModalA11y(panelRef, onClose)
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto scrollbar-thin glass rounded-t-3xl sm:rounded-2xl p-5 animate-slide-up`} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-start gap-3 mb-4">
          {icon && <div className="p-2.5 rounded-xl bg-violet-500/15 text-violet-300 shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-base font-semibold text-slate-100">{title}</h3>
            {subtitle && <div className="text-sm text-slate-400 mt-0.5">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className={`${BTN_ICON} text-slate-500 hover:text-slate-200 hover:bg-white/10`} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** the fleet forms' native field: a slate fill, the fleet's violet on focus (dcs-fleet-field: lib/mantine-dcs.css keeps it violet in the light look too) */
export const inputCls = 'dcs-fleet-field w-full h-10 px-3 rounded-lg bg-slate-800/50 border border-white/10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30'
export const labelCls = 'block text-xs font-medium text-slate-400 mb-1'
