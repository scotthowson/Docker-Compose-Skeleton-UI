// =============================================================================
// FleetScopeChips — Everywhere · Hub · one VM: the row every fleet-aware page
// shows above its list (Health, Images, Updates)
// =============================================================================

import { Boxes, Server, Loader2 } from 'lucide-react'
import type { FleetScope, ScopeMember } from '../../hooks/useFleetScope'

export default function FleetScopeChips({ scope, members, onChange, label = 'Show', busy = false, everywhere = true }: {
  scope: FleetScope; members: ScopeMember[]; onChange: (s: FleetScope) => void; label?: string; busy?: boolean
  /** false on a page that always talks to one server (files, .env, system): no Everywhere chip */
  everywhere?: boolean
}) {
  const base = 'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 whitespace-nowrap'
  const off = 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
  return (
    // a phone gets one swipeable row (sixteen VMs would otherwise push the page down); wider screens wrap
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1 shrink-0">{label}</span>
      {everywhere && (
        <button
          type="button"
          onClick={() => onChange('all')}
          title={`The hub and its ${members.length} VM${members.length === 1 ? '' : 's'} in one list`}
          className={`${base} ${scope === 'all' ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-200' : off}`}
        >
          <Boxes size={11} /> Everywhere
        </button>
      )}
      <button type="button" onClick={() => onChange('hub')} title="Only what runs on the hub itself" className={`${base} ${scope === 'hub' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200' : off}`}>
        <Server size={11} /> Hub
      </button>
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => { if (m.reachable) onChange(m.id) }}
          disabled={!m.reachable}
          title={m.reachable ? `VM${m.vmid ? ` #${m.vmid}` : ''} · DCS ${m.version}` : 'not answering'}
          className={`${base} ${scope === m.id ? 'bg-amber-500/15 border-amber-500/30 text-amber-200' : off}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${m.reachable ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          {m.name}
        </button>
      ))}
      {busy && <Loader2 size={12} className="animate-spin text-slate-500" />}
    </div>
  )
}
