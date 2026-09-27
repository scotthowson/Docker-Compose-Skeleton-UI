// =============================================================================
// Proxmox — the VMs and LXC containers of the Proxmox host DCS is linked to:
// node load, every guest with its state and resources, and power actions with
// a confirmation. Works on phones (cards, 44 px buttons, bottom-sheet confirm).
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Server, Cpu, MemoryStick, HardDrive, Clock, Play, Power, Square, RotateCw, Zap, Pause, PlayCircle,
  RefreshCw, Search, AlertTriangle, Settings2, ShieldCheck, Boxes, Box, Tag, ListChecks, X, Loader2,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { fetchProxmoxStatus, fetchProxmoxNodes, fetchProxmoxVms, fetchProxmoxTasks, proxmoxVmAction } from '../api/endpoints'
import type { ProxmoxVm, ProxmoxNode, ProxmoxTask, ProxmoxVmAction } from '../../shared/types'

const STATUS_POLL = 15_000
const LIST_POLL = 10_000
const TASK_POLL = 30_000

function fmtBytes(n: number): string {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / Math.pow(1024, i)).toFixed(i >= 3 ? 1 : 0)} ${u[i]}`
}
function fmtUptime(s: number): string {
  if (!s) return '—'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
function ago(epoch: number): string {
  if (!epoch) return ''
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epoch))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
function pctColor(p: number): string {
  return p >= 90 ? 'bg-rose-500' : p >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
}
function Bar({ pct, className = '' }: { pct: number; className?: string }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div className={`h-1.5 rounded-full bg-white/[0.06] overflow-hidden ${className}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${pctColor(p)}`} style={{ width: `${p}%` }} />
    </div>
  )
}
function StatusDot({ status }: { status: string }) {
  const cls = status === 'running' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.6)]' : status === 'paused' || status === 'suspended' ? 'bg-amber-400' : 'bg-slate-500'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${cls}`} aria-label={status} />
}

const ACTION_META: Record<ProxmoxVmAction, { label: string; icon: React.ElementType; danger: boolean; question: (v: ProxmoxVm) => string; note?: string }> = {
  start:    { label: 'Start',     icon: Play,       danger: false, question: (v) => `Start ${v.name}?` },
  shutdown: { label: 'Shut down', icon: Power,      danger: false, question: (v) => `Shut down ${v.name} cleanly?`, note: 'Sends ACPI power-off (VM) or a clean stop (container); the guest gets time to close.' },
  stop:     { label: 'Stop',      icon: Square,     danger: true,  question: (v) => `Stop ${v.name} now?`, note: 'Like pulling the plug: nothing inside gets to save. Use Shut down unless it hangs.' },
  reboot:   { label: 'Reboot',    icon: RotateCw,   danger: false, question: (v) => `Reboot ${v.name}?` },
  reset:    { label: 'Reset',     icon: Zap,        danger: true,  question: (v) => `Hard-reset ${v.name}?`, note: 'A hardware reset. Only for a VM that no longer answers.' },
  suspend:  { label: 'Suspend',   icon: Pause,      danger: false, question: (v) => `Suspend ${v.name}?` },
  resume:   { label: 'Resume',    icon: PlayCircle, danger: false, question: (v) => `Resume ${v.name}?` },
}

function actionsFor(vm: ProxmoxVm): ProxmoxVmAction[] {
  if (vm.status === 'running') return vm.type === 'qemu' ? ['shutdown', 'reboot', 'stop', 'reset', 'suspend'] : ['shutdown', 'reboot', 'stop']
  if (vm.status === 'paused' || vm.status === 'suspended') return ['resume', 'stop']
  return ['start']
}

function ConfirmSheet({ vm, action, onClose, onDone }: { vm: ProxmoxVm; action: ProxmoxVmAction; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { addToast } = useToast()
  const meta = ACTION_META[action]
  const Icon = meta.icon
  const run = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const r = await proxmoxVmAction(vm.node, vm.type, vm.vmid, action)
      addToast({ type: 'success', message: `${r.message || `${meta.label} sent`}${r.upid ? ` · task ${r.upid.split(':')[5] || ''}` : ''}` })
      onDone(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request failed')
      setBusy(false)
    }
  }
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-md glass rounded-t-3xl sm:rounded-2xl p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${meta.danger ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}><Icon size={18} /></div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-100">{meta.question(vm)}</h3>
            <p className="text-sm text-slate-400 mt-1">{vm.type === 'qemu' ? 'VM' : 'Container'} {vm.vmid} on {vm.node}{meta.note ? ` — ${meta.note}` : ''}</p>
            {error && <p className="text-sm text-rose-400 mt-2">{error}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 text-sm font-medium">Cancel</button>
          <button onClick={run} disabled={busy} className={`flex-1 h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 ${meta.danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />} {meta.label}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function NodeCard({ node, vmCount }: { node: ProxmoxNode; vmCount: number }) {
  return (
    <div className="glass-card p-4 rounded-2xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={node.status === 'online' ? 'running' : 'stopped'} />
          <span className="font-semibold text-slate-100 truncate">{node.node}</span>
          <span className="text-[11px] text-slate-500 shrink-0">{vmCount} guest{vmCount === 1 ? '' : 's'}</span>
        </div>
        <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0"><Clock size={11} /> {fmtUptime(node.uptime)}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1"><span className="flex items-center gap-1"><Cpu size={11} /> CPU</span><span className="tabular-nums text-slate-300">{node.cpu}%</span></div>
          <Bar pct={node.cpu} />
          <div className="text-slate-600 mt-1">{node.maxcpu} cores</div>
        </div>
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1"><span className="flex items-center gap-1"><MemoryStick size={11} /> RAM</span><span className="tabular-nums text-slate-300">{node.mem_pct}%</span></div>
          <Bar pct={node.mem_pct} />
          <div className="text-slate-600 mt-1">{fmtBytes(node.mem)} / {fmtBytes(node.maxmem)}</div>
        </div>
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1"><span className="flex items-center gap-1"><HardDrive size={11} /> Root</span><span className="tabular-nums text-slate-300">{node.disk_pct}%</span></div>
          <Bar pct={node.disk_pct} />
          <div className="text-slate-600 mt-1">{fmtBytes(node.disk)} / {fmtBytes(node.maxdisk)}</div>
        </div>
      </div>
    </div>
  )
}

function VmRow({ vm, isAdmin, onAction }: { vm: ProxmoxVm; isAdmin: boolean; onAction: (vm: ProxmoxVm, a: ProxmoxVmAction) => void }) {
  const acts = actionsFor(vm)
  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <StatusDot status={vm.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-100 truncate">{vm.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${vm.type === 'qemu' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' : 'bg-violet-500/10 text-violet-300 border-violet-500/20'}`}>{vm.type === 'qemu' ? 'VM' : 'LXC'}</span>
            <span className="text-[11px] text-slate-500 font-mono">#{vm.vmid}</span>
            {vm.intended && <span className="text-[10px] text-emerald-400/80" title="DCS asked for the last change">by DCS</span>}
            {vm.lock && <span className="text-[10px] text-amber-400/80">locked: {vm.lock}</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1"><Server size={10} /> {vm.node}</span>
            <span className="capitalize">{vm.status}</span>
            {vm.status === 'running' && <span className="flex items-center gap-1"><Clock size={10} /> {fmtUptime(vm.uptime)}</span>}
            {vm.tags.length > 0 && <span className="flex items-center gap-1"><Tag size={10} /> {vm.tags.join(', ')}</span>}
          </div>
        </div>
      </div>
      {vm.status === 'running' && (
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1"><span>CPU</span><span className="tabular-nums text-slate-300">{vm.cpu}% of {vm.maxcpu}</span></div>
            <Bar pct={vm.cpu} />
          </div>
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1"><span>RAM</span><span className="tabular-nums text-slate-300">{fmtBytes(vm.mem)} / {fmtBytes(vm.maxmem)}</span></div>
            <Bar pct={vm.mem_pct} />
          </div>
        </div>
      )}
      {isAdmin && (
        <div className="flex items-center gap-2 flex-wrap">
          {acts.map((a) => {
            const meta = ACTION_META[a]; const Icon = meta.icon
            return (
              <button key={a} onClick={() => onAction(vm, a)} title={meta.label}
                className={`h-10 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-colors ${meta.danger ? 'border-rose-500/20 text-rose-300 bg-rose-500/5 hover:bg-rose-500/15' : a === 'start' || a === 'resume' ? 'border-emerald-500/20 text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/15' : 'border-white/10 text-slate-300 bg-white/5 hover:bg-white/10'}`}>
                <Icon size={13} /> {meta.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Proxmox() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole === 'admin')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const status = usePolling(fetchProxmoxStatus, STATUS_POLL, { enabled: isConnected })
  const configured = !!status.data?.configured
  const reachable = !!status.data?.reachable
  const nodes = usePolling(fetchProxmoxNodes, LIST_POLL, { enabled: isConnected && configured && reachable })
  const vms = usePolling(fetchProxmoxVms, LIST_POLL, { enabled: isConnected && configured && reachable })
  const tasks = usePolling(fetchProxmoxTasks, TASK_POLL, { enabled: isConnected && configured && reachable })
  const [query, setQuery] = useState('')
  // A search result ("VM X") lands here with the guest pre-filtered
  const navigationPayload = useSettingsStore((s) => s.navigationPayload)
  useEffect(() => {
    const p = useSettingsStore.getState().navigationPayload
    if (p && typeof p.search === 'string') { setQuery(p.search); useSettingsStore.getState().consumeNavigationPayload() }
  }, [navigationPayload])
  const [show, setShow] = useState<'all' | 'running' | 'stopped' | 'qemu' | 'lxc'>('all')
  const [pending, setPending] = useState<{ vm: ProxmoxVm; action: ProxmoxVmAction } | null>(null)

  const list = useMemo(() => {
    const all = vms.data?.vms ?? []
    const q = query.trim().toLowerCase()
    return all.filter((v) => {
      if (show === 'running' && v.status !== 'running') return false
      if (show === 'stopped' && v.status === 'running') return false
      if (show === 'qemu' && v.type !== 'qemu') return false
      if (show === 'lxc' && v.type !== 'lxc') return false
      if (q && !(`${v.name} ${v.vmid} ${v.node} ${v.tags.join(' ')}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [vms.data, query, show])

  const refreshAll = () => { status.refresh(); nodes.refresh(); vms.refresh(); tasks.refresh() }
  const s = status.data

  return (
    <div className="space-y-5">
      <DisconnectedBanner />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Server size={20} className="text-amber-400" /> Proxmox</h1>
          <p className="text-sm text-slate-400 mt-1">
            {!s ? 'Checking the link…' : !configured ? 'Not linked yet.' : !reachable ? 'Linked, but Proxmox does not answer.' : `Proxmox VE ${s.version} · ${s.nodes_online}/${s.nodes} node${s.nodes === 1 ? '' : 's'} online · ${s.vms.running} of ${s.vms.total} guests running`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <button onClick={() => setCurrentPage('config')} className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 flex items-center gap-2"><Settings2 size={14} /> Settings</button>}
          <button onClick={refreshAll} className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center justify-center" title="Refresh"><RefreshCw size={14} className={vms.loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {s && !configured && (
        <div className="glass-card rounded-2xl p-6 text-center">
          <Server size={36} className="mx-auto text-amber-400/70" />
          <h2 className="mt-3 text-lg font-semibold text-slate-100">Link DCS to your Proxmox host</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">On Proxmox open <b>Datacenter → Permissions → API Tokens</b>, add a token for a user (untick <i>Privilege Separation</i>, or give the token the roles <code>VM.Audit</code>, <code>VM.PowerMgmt</code> and <code>Sys.Audit</code> on <code>/</code>). Then enter the URL, token ID and secret in Server Config → Proxmox and press <i>Test connection</i>.</p>
          {isAdmin && <button onClick={() => setCurrentPage('config')} className="mt-4 h-11 px-5 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-slate-900 text-sm font-semibold">Open Server Config</button>}
          <p className="mt-3 text-[11px] text-slate-500">Full walkthrough: docs/PROXMOX.md in the DCS repository</p>
        </div>
      )}

      {s && configured && !reachable && (
        <div className="glass-card rounded-2xl p-5 border border-rose-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-rose-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-slate-100">Proxmox did not answer</div>
              <div className="text-sm text-slate-400 mt-1 break-words">{s.error || s.hints?.[0]}</div>
              <div className="text-[11px] text-slate-500 mt-2 font-mono break-all">{s.url} · {s.token_id}</div>
            </div>
          </div>
        </div>
      )}

      {configured && reachable && (
        <>
          {nodes.data && nodes.data.nodes.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Boxes size={12} /> Nodes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {nodes.data.nodes.map((n) => <NodeCard key={n.node} node={n} vmCount={(vms.data?.vms ?? []).filter((v) => v.node === n.node).length} />)}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Box size={12} /> VMs &amp; containers {vms.data ? <span className="text-slate-600">{list.length}/{vms.data.total}</span> : null}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, id, node, tag" className="h-10 pl-8 pr-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder-slate-600 w-52 focus:outline-none focus:ring-1 focus:ring-amber-500/40" />
                </div>
                <div className="flex rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                  {(['all', 'running', 'stopped', 'qemu', 'lxc'] as const).map((k) => (
                    <button key={k} onClick={() => setShow(k)} className={`h-10 px-3 text-xs font-medium capitalize ${show === k ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:text-slate-200'}`}>{k === 'qemu' ? 'VMs' : k === 'lxc' ? 'LXC' : k}</button>
                  ))}
                </div>
              </div>
            </div>
            {vms.error && !vms.data ? (
              <div className="glass-card rounded-2xl p-5 text-sm text-rose-300">{vms.error.message}</div>
            ) : !vms.data ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="glass-card rounded-2xl h-28 animate-pulse" />)}</div>
            ) : list.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-center text-sm text-slate-400">Nothing matches.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {list.map((vm) => <VmRow key={`${vm.node}/${vm.type}/${vm.vmid}`} vm={vm} isAdmin={isAdmin} onAction={(v, a) => setPending({ vm: v, action: a })} />)}
              </div>
            )}
          </section>

          {tasks.data && tasks.data.tasks.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><ListChecks size={12} /> Recent tasks</h2>
              <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
                {tasks.data.tasks.slice(0, 12).map((t: ProxmoxTask) => (
                  <div key={t.upid} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'OK' ? 'bg-emerald-400' : t.status === 'running' ? 'bg-cyan-400 animate-pulse' : 'bg-rose-400'}`} />
                    <span className="font-mono text-xs text-slate-300 w-24 shrink-0 truncate">{t.type}</span>
                    <span className="text-slate-400 truncate flex-1 min-w-0">{t.id ? `#${t.id}` : ''} {t.user ? `· ${t.user}` : ''} {t.node ? `· ${t.node}` : ''}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">{ago(t.starttime)}</span>
                    {t.status && t.status !== 'OK' && t.status !== 'running' && <span className="text-[11px] text-rose-300 truncate max-w-[40%]" title={t.status}>{t.status}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="text-[11px] text-slate-600 flex items-center gap-1"><ShieldCheck size={11} /> Power actions are audited and reach your webhooks; a guest that stops on its own raises a VM alert.</p>
        </>
      )}

      {pending && <ConfirmSheet vm={pending.vm} action={pending.action} onClose={() => setPending(null)} onDone={() => { setTimeout(() => { vms.refresh(); tasks.refresh(); status.refresh() }, 1500) }} />}
    </div>
  )
}
