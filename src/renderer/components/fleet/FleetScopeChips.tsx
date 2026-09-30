// =============================================================================
// FleetScopeChips — Everywhere · Hub · one VM: the row every fleet-aware page
// shows above its list (Health, Images, Updates). A group of pressed/unpressed
// buttons for a screen reader; each chip explains itself in a tooltip. The chip
// that is pressed wears the fleet's colour, violet, like the VM capsules of the
// rows below it; the others are neutral.
// =============================================================================

import { Tooltip } from '@mantine/core'
import { Boxes, Server, Loader2 } from 'lucide-react'
import type { FleetScope, ScopeMember } from '../../hooks/useFleetScope'

export default function FleetScopeChips({ scope, members, onChange, label = 'Show', busy = false, everywhere = true }: {
  scope: FleetScope; members: ScopeMember[]; onChange: (s: FleetScope) => void; label?: string; busy?: boolean
  /** false on a page that always talks to one server (files, .env, system): no Everywhere chip */
  everywhere?: boolean
}) {
  const base = 'inline-flex items-center gap-1.5 h-8 sm:h-7 px-2.5 rounded-full text-[11px] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40'
  const on = 'bg-violet-500/15 border-violet-500/30 text-violet-200'
  const off = 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
  return (
    // a phone gets one swipeable row (sixteen VMs would otherwise push the page down); wider screens wrap
    <div role="group" aria-label={label} className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1 shrink-0" aria-hidden>{label}</span>
      {everywhere && (
        <Tooltip label={`The hub and its ${members.length} VM${members.length === 1 ? '' : 's'} in one list`}>
          <button
            type="button"
            aria-pressed={scope === 'all'}
            onClick={() => onChange('all')}
            className={`${base} ${scope === 'all' ? on : off}`}
          >
            <Boxes size={11} /> Everywhere
          </button>
        </Tooltip>
      )}
      <Tooltip label="Only what runs on the hub itself">
        <button type="button" aria-pressed={scope === 'hub'} onClick={() => onChange('hub')} className={`${base} ${scope === 'hub' ? on : off}`}>
          <Server size={11} /> Hub
        </button>
      </Tooltip>
      {members.map((m) => (
        // the span carries the tooltip: a disabled button (a VM that does not answer) gets no pointer events
        <Tooltip key={m.id} label={m.reachable ? `VM${m.vmid ? ` #${m.vmid}` : ''} · DCS ${m.version}` : `${m.name} is not answering`}>
          <span className="inline-flex shrink-0">
            <button
              type="button"
              aria-pressed={scope === m.id}
              onClick={() => { if (m.reachable) onChange(m.id) }}
              disabled={!m.reachable}
              className={`${base} ${scope === m.id ? on : off}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${m.reachable ? 'bg-emerald-400' : 'bg-slate-600'}`} aria-hidden />
              {m.name}
            </button>
          </span>
        </Tooltip>
      ))}
      {busy && <Loader2 size={12} className="animate-spin text-slate-500" aria-label="Loading" />}
    </div>
  )
}
