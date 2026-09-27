// =============================================================================
// JoinHubPanel — the member side: this server joins a hub with the hub's
// address and a join code, watched on the progress card. Shows the hub it
// belongs to afterwards, with Leave. Used by the wizard (a join saved by
// setup.sh starts by itself) and by the Proxmox page of a member.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { Satellite, Loader2, LogOut, PlugZap } from 'lucide-react'
import { joinFleetHub, leaveFleetHub } from '../../api/endpoints'
import type { FleetHubLink, FleetJoinHubResponse } from '../../../shared/types'
import ProgressCard, { type ProgressLine, type ProgressState } from '../common/ProgressCard'
import { inputCls, labelCls, MATCH_LABEL } from './fleetShared'

const STEPS = [
  { label: 'Reach', hint: 'the hub' },
  { label: 'Account', hint: 'dcs-hub here' },
  { label: 'Register', hint: 'with the code' },
  { label: 'Match', hint: 'the guest' },
  { label: 'Done', hint: '' },
] as const

interface Props {
  hub?: FleetHubLink | null
  initial?: { hub_url?: string; token?: string; name?: string }
  /** The join setup.sh saved before the first admin existed: the API holds the code */
  pending?: { hub_url: string; name: string } | null
  autoRun?: boolean
  compact?: boolean
  onJoined?: (r: FleetJoinHubResponse) => void
  onLeft?: () => void
}

export default function JoinHubPanel({ hub, initial, pending = null, autoRun = false, compact = false, onJoined, onLeft }: Props) {
  const [hubUrl, setHubUrl] = useState(pending?.hub_url ?? initial?.hub_url ?? 'http://')
  const [token, setToken] = useState(initial?.token ?? '')
  const [name, setName] = useState(pending?.name ?? initial?.name ?? '')
  const [state, setState] = useState<ProgressState>('idle')
  const [current, setCurrent] = useState(0)
  const [status, setStatus] = useState('')
  const [lines, setLines] = useState<ProgressLine[]>([])
  const [leaving, setLeaving] = useState(false)
  const [err, setErr] = useState('')
  const timers = useRef<number[]>([])
  // one join at a time (StrictMode mounts twice in development; a double click must not start two)
  const runningRef = useRef(false)
  const autoRanRef = useRef(false)
  const push = (text: string, tone?: ProgressLine['tone']) => setLines((l) => [...l, { text, tone }])
  const clearTimers = () => { for (const t of timers.current) window.clearTimeout(t); timers.current = [] }

  const run = async () => {
    if (runningRef.current) return
    const u = hubUrl.trim().replace(/\/+$/, '')
    const t = token.trim().toUpperCase()
    setErr('')
    if (!/^https?:\/\/[^/\s]+$/.test(u)) { setErr('The hub address must look like http://192.168.1.10:9876'); return }
    if (!t && !pending) { setErr('Enter the join code shown on the hub'); return }
    runningRef.current = true
    clearTimers(); setLines([]); setState('running'); setCurrent(0); setStatus(`Reaching the hub at ${u}…`)
    push(`Asking this server to join ${u}…`)
    // the API does the whole join in one call; the strip moves along while it works
    timers.current.push(window.setTimeout(() => { setCurrent(1); setStatus('Creating the account dcs-hub on this server…') }, 900))
    timers.current.push(window.setTimeout(() => { setCurrent(2); setStatus('Registering with the hub…'); push('The hub signs in here and reads this server\'s identity') }, 2200))
    try {
      const r = await joinFleetHub(pending ? { pending: true, name: name.trim() || undefined } : { hub_url: u, token: t, name: name.trim() || undefined })
      clearTimers()
      push(`Hub ${r.hub.name || u}${r.hub.version ? ` (DCS ${r.hub.version})` : ''} accepted this server as "${r.member.name}"`, 'ok')
      setCurrent(3)
      if (r.member.vmid) push(`Guest ${r.member.vmid}${r.member.node ? ` on ${r.member.node}` : ''} — ${MATCH_LABEL[r.member.matched_by ?? ''] ?? r.member.matched_by}`, 'ok')
      else push('The hub could not tell which guest this is — pick it on the hub\'s Proxmox page (member menu → Edit)', 'warn')
      setCurrent(4); setState('done'); setStatus(`Joined ${r.hub.name || u}. The hub's Proxmox page now shows this server's stacks under its VM.`)
      onJoined?.(r)
    } catch (e) {
      clearTimers()
      const msg = e instanceof Error ? e.message : 'The join failed'
      const at = /did not answer|reach/i.test(msg) ? 0 : /account/i.test(msg) ? 1 : /join code|expired/i.test(msg) ? 2 : /log in to/i.test(msg) ? 2 : 2
      setCurrent(at); setState('failed'); setStatus(msg); push(msg, 'bad')
      if (/log in to/i.test(msg)) push('The hub must reach this server\'s API address (FLEET_SELF_URL in .env fixes a wrong detected address)', 'muted')
    } finally { runningRef.current = false }
  }
  useEffect(() => { if (autoRun && !autoRanRef.current && (pending || (initial?.hub_url && initial?.token))) { autoRanRef.current = true; void run() } return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun])

  const leave = async () => {
    if (!window.confirm('Leave the hub? Its account here is removed; remove this server on the hub too.')) return
    setLeaving(true)
    try { await leaveFleetHub(); onLeft?.() } catch (e) { setErr(e instanceof Error ? e.message : 'Could not leave') } finally { setLeaving(false) }
  }

  if (hub && state !== 'done') {
    return (
      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3 flex items-center gap-3 flex-wrap">
        <Satellite size={16} className="text-emerald-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-200">Member of {hub.name || hub.url}{hub.version ? ` (DCS ${hub.version})` : ''}</p>
          <p className="text-[11px] text-slate-500 truncate">as "{hub.member_name}"{hub.vmid ? ` · guest ${hub.vmid}${hub.node ? ` on ${hub.node}` : ''}` : ' · no guest matched yet'} · joined {new Date(hub.joined_at * 1000).toLocaleDateString()} · account {hub.username}</p>
        </div>
        <button type="button" onClick={leave} disabled={leaving} className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:bg-rose-500/15 hover:text-rose-200 flex items-center gap-1.5 disabled:opacity-50">
          {leaving ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />} Leave
        </button>
        {err && <p className="w-full text-[11px] text-rose-300">{err}</p>}
      </div>
    )
  }

  const busy = state === 'running'
  return (
    <div className="space-y-3">
      {state !== 'done' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Hub address</label>
            <input value={hubUrl} onChange={(e) => setHubUrl(e.target.value)} placeholder="http://192.168.1.10:9876" className={`${inputCls} font-mono`} disabled={busy || !!pending} />
          </div>
          <div>
            <label className={labelCls}>Join code</label>
            {pending
              ? <div className={`${inputCls} flex items-center text-slate-400`}>saved by setup.sh</div>
              : <input value={token} onChange={(e) => setToken(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" className={`${inputCls} font-mono tracking-wider`} disabled={busy} />}
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Name on the hub (empty = this server's name)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="media-services" className={inputCls} disabled={busy} />
          </div>
        </div>
      )}
      {err && <p className="text-xs text-rose-300">{err}</p>}
      {state !== 'idle' && <ProgressCard steps={STEPS} current={current} state={state} status={status} lines={lines} compact={compact} />}
      {state !== 'done' && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-slate-500">The code comes from the hub's Proxmox page (Members → Join code). This server creates the account dcs-hub for the hub and hands it over once.</p>
          <button type="button" onClick={() => void run()} disabled={busy} className="h-9 px-3 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-slate-900 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />} Join the hub
          </button>
        </div>
      )}
    </div>
  )
}
