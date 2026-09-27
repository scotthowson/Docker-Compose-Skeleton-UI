// =============================================================================
// Proxmox — the VMs and LXC containers of the Proxmox host DCS is linked to:
// node load, every guest with its state and resources, power actions with a
// confirmation — and, on a hub, the DCS member running in each guest with its
// stacks (start/stop/restart, deploy here), the scan that finds installs, the
// join code, and the members that still need a guest. A member shows the hub
// it belongs to. Works on phones (cards, 44 px buttons, bottom sheets).
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Server, Cpu, MemoryStick, HardDrive, Clock, Play, Power, Square, RotateCw, Zap, Pause, PlayCircle,
  RefreshCw, Search, AlertTriangle, Settings2, ShieldCheck, Boxes, Box, Tag, ListChecks, X, Loader2,
  Satellite, Link2, KeyRound, Radar, Rocket, MoreHorizontal, PlugZap, Pencil, Trash2, Layers, ExternalLink, Home,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import {
  fetchProxmoxStatus, fetchProxmoxNodes, fetchProxmoxVms, fetchProxmoxTasks, proxmoxVmAction,
  fetchFleetStatus, fetchFleetOverview, fetchFleetDiscover, fetchStacks, startStack, stopStack, restartStack,
  testFleetMember, removeFleetMember, fetchFleetJobs, fetchFleetProvisionDefaults, fetchProxmoxCapabilities,
} from '../api/endpoints'
import type { ProxmoxVm, ProxmoxNode, ProxmoxTask, ProxmoxVmAction, FleetMemberBase, FleetMemberLive, FleetGuestScan, StackInfo } from '../../shared/types'
import FleetLinkPanel from '../components/fleet/FleetLinkPanel'
import JoinHubPanel from '../components/fleet/JoinHubPanel'
import JoinCodeCard from '../components/fleet/JoinCodeCard'
import MemberSheet, { type MemberSheetPrefill } from '../components/fleet/MemberSheet'
import { Sheet, MATCH_LABEL } from '../components/fleet/fleetShared'
import FleetJobsPanel from '../components/fleet/FleetJobsPanel'
import NewVmSheet, { CapabilityNote } from '../components/fleet/NewVmSheet'

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

type StackAct = 'start' | 'stop' | 'restart'

function MemberStacks({ member, live, isAdmin, onStackAction, busyKey }: { member: FleetMemberBase; live?: FleetMemberLive; isAdmin: boolean; onStackAction: (m: FleetMemberBase, stack: string, a: StackAct) => void; busyKey: string }) {
  const stacks = live?.stacks ?? []
  if (!live) return <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Reading {member.name}'s stacks…</p>
  if (!live.reachable) return <p className="text-[11px] text-rose-300/90">{member.name} did not answer{live.error ? `: ${live.error}` : ''}</p>
  if (stacks.length === 0) return <p className="text-[11px] text-slate-500">No stacks on {member.name} yet — deploy a template here.</p>
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] divide-y divide-white/[0.04]">
      {stacks.map((st: StackInfo) => {
        const key = `${member.id}/${st.name}`
        const busy = busyKey === key
        return (
          <div key={st.name} className="flex items-center gap-2.5 px-3 py-2">
            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${st.status === 'running' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">{st.name}</p>
              <p className="text-[10px] text-slate-500">{st.status === 'running' ? `${st.running_containers} container${st.running_containers === 1 ? '' : 's'} running` : 'stopped'}</p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1">
                {busy ? <Loader2 size={13} className="animate-spin text-cyan-400" /> : (
                  <>
                    {st.status !== 'running' && <button type="button" onClick={() => onStackAction(member, st.name, 'start')} title="Start" className="h-8 w-8 rounded-lg text-emerald-300 hover:bg-emerald-500/15 flex items-center justify-center"><Play size={13} /></button>}
                    {st.status === 'running' && <button type="button" onClick={() => onStackAction(member, st.name, 'restart')} title="Restart" className="h-8 w-8 rounded-lg text-slate-300 hover:bg-white/10 flex items-center justify-center"><RotateCw size={13} /></button>}
                    {st.status === 'running' && <button type="button" onClick={() => onStackAction(member, st.name, 'stop')} title="Stop" className="h-8 w-8 rounded-lg text-rose-300 hover:bg-rose-500/15 flex items-center justify-center"><Square size={13} /></button>}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface VmRowProps {
  vm: ProxmoxVm
  isAdmin: boolean
  isHub: boolean
  member?: FleetMemberBase
  live?: FleetMemberLive
  scan?: FleetGuestScan
  busyKey: string
  onAction: (vm: ProxmoxVm, a: ProxmoxVmAction) => void
  onStackAction: (m: FleetMemberBase, stack: string, a: StackAct) => void
  onDeploy: (m: FleetMemberBase) => void
  onLink: (p: MemberSheetPrefill) => void
  onMemberMenu: (m: FleetMemberBase) => void
}

function VmRow({ vm, isAdmin, isHub, member, live, scan, busyKey, onAction, onStackAction, onDeploy, onLink, onMemberMenu }: VmRowProps) {
  const acts = actionsFor(vm)
  const found = scan?.dcs && !scan.member ? scan.dcs : null
  return (
    <div className={`glass-card rounded-2xl p-4 flex flex-col gap-3 ${member ? 'border border-amber-500/15' : ''}`}>
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
        {member && isAdmin && (
          <button type="button" onClick={() => onMemberMenu(member)} className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center justify-center shrink-0" title={`Manage ${member.name}`}><MoreHorizontal size={15} /></button>
        )}
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
      {/* the DCS inside this guest */}
      {member ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium ${live && !live.reachable ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-amber-500/10 text-amber-200 border-amber-500/20'}`}>
              <Satellite size={10} /> {member.name}{member.version ? ` · DCS ${member.version}` : ''}
            </span>
            {live?.reachable && <span className="text-slate-400">{live.stacks_total} stack{live.stacks_total === 1 ? '' : 's'} · {live.containers_running}/{live.containers_total} containers</span>}
            <span className="text-slate-600 font-mono truncate">{member.url}</span>
            {member.matched_by && <span className="text-slate-600" title={MATCH_LABEL[member.matched_by]}>· {member.matched_by === 'manual' ? 'mapped by hand' : member.matched_by === 'provision' ? 'built by the hub' : `matched by ${member.matched_by}`}</span>}
          </div>
          <MemberStacks member={member} live={live} isAdmin={isAdmin} onStackAction={onStackAction} busyKey={busyKey} />
          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => onDeploy(member)} className="h-9 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-amber-500/25 text-amber-200 bg-amber-500/10 hover:bg-amber-500/20"><Rocket size={13} /> Deploy here</button>
              {member.identity?.dashboard !== false && <a href={member.url.replace(/:\d+$/, ':3000')} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-white/10 text-slate-300 bg-white/5 hover:bg-white/10" title="Open that server's own dashboard (port 3000)"><ExternalLink size={13} /> Its dashboard</a>}
            </div>
          )}
        </div>
      ) : isHub && vm.status === 'running' && isAdmin ? (
        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
          {found ? (
            <>
              <span className="text-amber-200 flex items-center gap-1.5"><Radar size={11} /> DCS {found.version} answers at {found.ip}:{found.port}</span>
              <button type="button" onClick={() => onLink({ name: vm.name, url: found.url, vmid: vm.vmid, node: vm.node, type: vm.type })} className="h-8 px-2.5 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/25 font-medium hover:bg-amber-500/25 flex items-center gap-1.5"><Link2 size={12} /> Link</button>
            </>
          ) : (
            <>
              <span className="text-slate-500">No DCS linked to this guest{scan && scan.ips.length === 0 ? ' · address unknown (no guest agent)' : ''}</span>
              <button type="button" onClick={() => onLink({ name: vm.name, vmid: vm.vmid, node: vm.node, type: vm.type })} className="h-8 px-2.5 rounded-lg bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 flex items-center gap-1.5"><Link2 size={12} /> Link…</button>
            </>
          )}
        </div>
      ) : null}
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

function MemberMenuSheet({ member, vms, onClose, onEdit, onChanged }: { member: FleetMemberBase; vms: ProxmoxVm[]; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  const { addToast } = useToast()
  const [busy, setBusy] = useState<'test' | 'remove' | ''>('')
  const [note, setNote] = useState('')
  const test = async () => {
    setBusy('test'); setNote('')
    try {
      const r = await testFleetMember(member.id)
      if (!r.reachable) { setNote(`Not reachable: ${r.error}`); return }
      setNote(`Answers as ${r.identity?.hostname || member.url}${r.version ? ` (DCS ${r.version})` : ''}${r.match ? ` · guest ${r.match.vmid} ${r.match.name} — ${MATCH_LABEL[r.match.matched_by]}` : ' · no guest matched'}`)
      onChanged()
    } catch (e) { setNote(e instanceof Error ? e.message : 'The test failed') } finally { setBusy('') }
  }
  const remove = async () => {
    if (!window.confirm(`Forget ${member.name}? Its stacks keep running; only the hub stops managing it.`)) return
    setBusy('remove')
    try { await removeFleetMember(member.id); addToast({ type: 'success', message: `${member.name} removed from the fleet` }); onChanged(); onClose() }
    catch (e) { setNote(e instanceof Error ? e.message : 'Could not remove'); setBusy('') }
  }
  const destroy = async () => {
    const typed = window.prompt(`Stop and destroy VM ${member.vmid} (${member.name}) on Proxmox, with its disks? Everything in it is lost. Type the stack name to confirm:`)
    if (typed !== member.name) { if (typed !== null) setNote('The name did not match — nothing was destroyed'); return }
    setBusy('remove')
    try { await removeFleetMember(member.id, true); addToast({ type: 'success', message: `VM ${member.vmid} (${member.name}) destroyed` }); onChanged(); onClose() }
    catch (e) { setNote(e instanceof Error ? e.message : 'Could not destroy the VM'); setBusy('') }
  }
  const guest = vms.find((v) => v.vmid === member.vmid)
  return (
    <Sheet title={member.name} subtitle={`${member.url} · account ${member.username}${guest ? ` · ${guest.type === 'qemu' ? 'VM' : 'LXC'} ${guest.vmid} ${guest.name}` : member.vmid ? ` · guest ${member.vmid}` : ' · no guest yet'}`} icon={<Satellite size={18} />} onClose={onClose}>
      <div className="space-y-2">
        <p className="text-[11px] text-slate-500">Added {new Date(member.added_at * 1000).toLocaleString()} by {member.added_by} ({member.source === 'join' ? 'joined with a code' : 'added by address'}) · last answered {member.last_seen ? ago(member.last_seen) : 'never'}{member.last_error ? ` · ${member.last_error}` : ''}</p>
        {note && <p className="text-xs text-slate-300 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">{note}</p>}
        <button type="button" onClick={test} disabled={!!busy} className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 hover:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-50">{busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <PlugZap size={15} />} Test the link and re-match the guest</button>
        <button type="button" onClick={onEdit} disabled={!!busy} className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 hover:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-50"><Pencil size={15} /> Edit name, address, account or guest</button>
        <button type="button" onClick={remove} disabled={!!busy} className="w-full h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-200 hover:bg-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-50">{busy === 'remove' ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Remove from the fleet</button>
        {member.vmid && member.type !== 'lxc' && <button type="button" onClick={destroy} disabled={!!busy} className="w-full h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 text-sm text-rose-200 hover:bg-rose-500/25 flex items-center justify-center gap-2 disabled:opacity-50"><Trash2 size={15} /> Stop and destroy the VM on Proxmox</button>}
      </div>
    </Sheet>
  )
}

export default function Proxmox() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole === 'admin')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const { addToast } = useToast()
  const status = usePolling(fetchProxmoxStatus, STATUS_POLL, { enabled: isConnected })
  const configured = !!status.data?.configured
  const reachable = !!status.data?.reachable
  const nodes = usePolling(fetchProxmoxNodes, LIST_POLL, { enabled: isConnected && configured && reachable })
  const vms = usePolling(fetchProxmoxVms, LIST_POLL, { enabled: isConnected && configured && reachable })
  const tasks = usePolling(fetchProxmoxTasks, TASK_POLL, { enabled: isConnected && configured && reachable })
  // the fleet: what this server is, the members and what they run, the last scan
  const fleet = usePolling(fetchFleetStatus, STATUS_POLL, { enabled: isConnected })
  const role = fleet.data?.role ?? 'standalone'
  const memberCount = fleet.data?.members ?? 0
  const isHub = role === 'hub' || memberCount > 0
  const overview = usePolling(fetchFleetOverview, LIST_POLL, { enabled: isConnected && memberCount > 0 })
  const scan = usePolling(fetchFleetDiscover, 60_000, { enabled: isConnected && isAdmin && configured && reachable && isHub })
  const localStacks = usePolling(fetchStacks, LIST_POLL, { enabled: isConnected && (isHub || role === 'member') })
  // the hub's own stacks only: GET /stacks also carries the members' stacks (placement "vm")
  const hubOwn = (localStacks.data?.stacks ?? []).filter((s) => s.placement !== 'vm')
  // VMs being built by the hub, and what creating one needs
  const jobs = usePolling(fetchFleetJobs, 5000, { enabled: isConnected && isAdmin && configured && reachable })
  const provDefaults = usePolling(fetchFleetProvisionDefaults, 60_000, { enabled: isConnected && isAdmin && configured && reachable })
  const caps = usePolling(fetchProxmoxCapabilities, 60_000, { enabled: isConnected && isAdmin && configured && reachable })
  const [newVm, setNewVm] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // A search result ("VM X") lands here with the guest pre-filtered
  const navigationPayload = useSettingsStore((s) => s.navigationPayload)
  useEffect(() => {
    const p = useSettingsStore.getState().navigationPayload
    if (p && typeof p.search === 'string') { setQuery(p.search); useSettingsStore.getState().consumeNavigationPayload() }
  }, [navigationPayload])
  const [show, setShow] = useState<'all' | 'running' | 'stopped' | 'qemu' | 'lxc'>('all')
  const [pending, setPending] = useState<{ vm: ProxmoxVm; action: ProxmoxVmAction } | null>(null)
  const [sheet, setSheet] = useState<'link' | 'code' | null>(null)
  const [adding, setAdding] = useState<MemberSheetPrefill | null>(null)
  const [editing, setEditing] = useState<FleetMemberBase | null>(null)
  const [menu, setMenu] = useState<FleetMemberBase | null>(null)
  const [busyKey, setBusyKey] = useState('')

  const members = overview.data?.members ?? []
  const liveById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const memberByVm = useMemo(() => { const m = new Map<number, FleetMemberLive>(); for (const x of members) if (x.vmid) m.set(x.vmid, x); return m }, [members])
  const scanByVm = useMemo(() => new Map((scan.data?.guests ?? []).map((g) => [g.vmid, g])), [scan.data])
  const unmapped = members.filter((m) => !m.vmid)

  const list = useMemo(() => {
    const all = vms.data?.vms ?? []
    const q = query.trim().toLowerCase()
    return all.filter((v) => {
      if (show === 'running' && v.status !== 'running') return false
      if (show === 'stopped' && v.status === 'running') return false
      if (show === 'qemu' && v.type !== 'qemu') return false
      if (show === 'lxc' && v.type !== 'lxc') return false
      const m = memberByVm.get(v.vmid)
      const hay = `${v.name} ${v.vmid} ${v.node} ${v.tags.join(' ')} ${m ? `${m.name} ${m.url} ${m.stacks.map((st) => st.name).join(' ')}` : ''}`.toLowerCase()
      if (q && !hay.includes(q)) return false
      return true
    })
  }, [vms.data, query, show, memberByVm])

  const refreshAll = () => { status.refresh(); nodes.refresh(); vms.refresh(); tasks.refresh(); fleet.refresh(); overview.refresh(); scan.refresh(); localStacks.refresh(); jobs.refresh() }
  const refreshFleet = () => { fleet.refresh(); overview.refresh(); scan.refresh(); jobs.refresh(); vms.refresh() }
  const s = status.data

  const stackAction = async (m: FleetMemberBase, stack: string, a: StackAct) => {
    const key = `${m.id}/${stack}`
    setBusyKey(key)
    try {
      const fn = a === 'start' ? startStack : a === 'stop' ? stopStack : restartStack
      const r = await fn(stack, m.id)
      addToast({ type: r.success === false ? 'error' : 'success', message: (r as { message?: string }).message || `${stack} on ${m.name}: ${a}` })
    } catch (e) {
      addToast({ type: 'error', message: `${stack} on ${m.name}: ${e instanceof Error ? e.message : 'failed'}` })
    } finally { setBusyKey(''); setTimeout(() => overview.refresh(), 1200) }
  }
  // "Deploy here": the VM is the stack — open Templates with that stack preselected (the hub forwards the deploy)
  const deployTo = (m: FleetMemberBase & { stacks?: unknown[] }) => {
    const first = Array.isArray(m.stacks) && m.stacks.length ? m.stacks[0] : null
    const stack = typeof first === 'string' ? first : first && typeof first === 'object' && 'name' in first ? String((first as { name: string }).name) : m.name
    setCurrentPage('templates', { targetStack: stack })
  }

  const roleChip = role === 'member'
    ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1"><Satellite size={10} /> member of {fleet.data?.hub?.name || fleet.data?.hub?.url}</span>
    : isHub ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/20 flex items-center gap-1"><Satellite size={10} /> hub · {memberCount} member{memberCount === 1 ? '' : 's'}</span>
    : null

  return (
    <div className="space-y-5">
      <DisconnectedBanner />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Server size={20} className="text-amber-400" /> Proxmox {roleChip}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {!s ? 'Checking the link…' : !configured ? 'Not linked yet.' : !reachable ? 'Linked, but Proxmox does not answer.' : `Proxmox VE ${s.version} · ${s.nodes_online}/${s.nodes} node${s.nodes === 1 ? '' : 's'} online · ${s.vms.running} of ${s.vms.total} guests running`}
            {overview.data && memberCount > 0 && ` · ${overview.data.totals.reachable}/${overview.data.totals.members} members answering · ${overview.data.totals.stacks} stacks · ${overview.data.totals.containers_running}/${overview.data.totals.containers_total} containers`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && configured && reachable && role !== 'member' && (
            <>
              <button onClick={() => setNewVm('')} className="h-10 px-3 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-slate-900 text-sm font-semibold flex items-center gap-2"><Rocket size={14} /> New VM stack</button>
              <button onClick={() => setSheet('link')} className="h-10 px-3 rounded-xl bg-amber-500/15 border border-amber-500/25 text-sm text-amber-200 hover:bg-amber-500/25 flex items-center gap-2"><Radar size={14} /> Link VMs</button>
              <button onClick={() => setSheet('code')} className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 flex items-center gap-2"><KeyRound size={14} /> Join code</button>
              <button onClick={() => setAdding({})} className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 flex items-center gap-2"><Link2 size={14} /> Add member</button>
            </>
          )}
          {isAdmin && <button onClick={() => setCurrentPage('config')} className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 flex items-center gap-2"><Settings2 size={14} /> Settings</button>}
          <button onClick={refreshAll} className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center justify-center" title="Refresh"><RefreshCw size={14} className={vms.loading || overview.loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {/* a member: the hub it belongs to */}
      {fleet.data && role === 'member' && (
        <JoinHubPanel hub={fleet.data.hub} onLeft={() => { addToast({ type: 'success', message: 'Left the hub' }); refreshFleet() }} />
      )}
      {fleet.data?.pending_join && role !== 'member' && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-sm font-semibold text-slate-100 flex items-center gap-2"><Satellite size={15} className="text-amber-400" /> setup.sh saved a join to {fleet.data.pending_join.hub_url}</p>
          <p className="text-xs text-slate-400 mt-1 mb-3">It runs here, on the progress card.</p>
          <JoinHubPanel pending={fleet.data.pending_join} onJoined={() => refreshFleet()} />
        </div>
      )}

      {s && !configured && (
        <div className="glass-card rounded-2xl p-6">
          <div className="text-center">
            <Server size={36} className="mx-auto text-amber-400/70" />
            <h2 className="mt-3 text-lg font-semibold text-slate-100">Link DCS to your Proxmox host</h2>
            <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">On Proxmox open <b>Datacenter → Permissions → API Tokens</b>, add a token for a user (untick <i>Privilege Separation</i>, or give the token the roles <code>VM.Audit</code>, <code>VM.PowerMgmt</code> and <code>Sys.Audit</code> on <code>/</code>). Then enter the URL, token ID and secret in Server Config → Proxmox and press <i>Test connection</i>.</p>
            {isAdmin && <button onClick={() => setCurrentPage('config')} className="mt-4 h-11 px-5 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-slate-900 text-sm font-semibold">Open Server Config</button>}
            <p className="mt-3 text-[11px] text-slate-500">Full walkthrough: docs/PROXMOX.md in the DCS repository</p>
          </div>
          {isAdmin && role !== 'member' && (
            <div className="mt-6 pt-5 border-t border-white/5">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Satellite size={14} className="text-emerald-400" /> Or: this VM runs stacks under a hub</h3>
              <p className="text-xs text-slate-400 mt-1 mb-3">The hub (the DCS linked to Proxmox) shows this server's stacks under its VM and deploys here. Enter the hub's address and a join code from its Proxmox page.</p>
              <JoinHubPanel onJoined={() => refreshFleet()} compact />
            </div>
          )}
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
          {isAdmin && caps.data && !caps.data.can_provision && (
            <div className="glass-card rounded-2xl p-4 border border-amber-500/20"><CapabilityNote caps={caps.data} /></div>
          )}
          {jobs.data && jobs.data.jobs.length > 0 && <FleetJobsPanel jobs={jobs.data.jobs} onChanged={refreshFleet} />}
          {nodes.data && nodes.data.nodes.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Boxes size={12} /> Nodes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {nodes.data.nodes.map((n) => <NodeCard key={n.node} node={n} vmCount={(vms.data?.vms ?? []).filter((v) => v.node === n.node).length} />)}
              </div>
            </section>
          )}

          {/* this server's own stacks, so everything is on one page */}
          {(isHub || role === 'member') && localStacks.data && (
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Home size={12} /> This server{fleet.data?.server_name ? ` · ${fleet.data.server_name}` : ''}{isHub ? ' (hub)' : ''}</h2>
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <p className="text-[11px] text-slate-400">{hubOwn.length} stack{hubOwn.length === 1 ? '' : 's'} run here, on DCS {fleet.data?.version}{isHub ? ' — the hub itself keeps stacks like any member' : ''}</p>
                  <button type="button" onClick={() => setCurrentPage('stacks')} className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:bg-white/10 flex items-center gap-1.5"><Layers size={12} /> Stacks page</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hubOwn.map((st) => (
                    <button key={st.name} type="button" onClick={() => setCurrentPage('stacks', { highlight: st.name })} className="h-8 px-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] text-slate-300 hover:bg-white/10 flex items-center gap-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${st.status === 'running' ? 'bg-emerald-400' : 'bg-slate-500'}`} /> {st.name} <span className="text-slate-600">{st.running_containers}</span>
                    </button>
                  ))}
                  {hubOwn.length === 0 && <span className="text-[11px] text-slate-500">no stacks yet</span>}
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Box size={12} /> VMs &amp; containers {vms.data ? <span className="text-slate-600">{list.length}/{vms.data.total}</span> : null}{isHub && <span className="text-slate-600 normal-case tracking-normal">· each with the DCS it runs</span>}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, id, node, tag, stack" className="h-10 pl-8 pr-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder-slate-600 w-56 focus:outline-none focus:ring-1 focus:ring-amber-500/40" />
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
                {list.map((vm) => {
                  const m = memberByVm.get(vm.vmid)
                  return <VmRow key={`${vm.node}/${vm.type}/${vm.vmid}`} vm={vm} isAdmin={isAdmin} isHub={isHub || role === 'standalone'} member={m} live={m ? liveById.get(m.id) : undefined} scan={scanByVm.get(vm.vmid)} busyKey={busyKey}
                    onAction={(v, a) => setPending({ vm: v, action: a })} onStackAction={stackAction} onDeploy={deployTo} onLink={(p) => setAdding(p)} onMemberMenu={(mm) => setMenu(mm)} />
                })}
              </div>
            )}
          </section>

          {unmapped.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Satellite size={12} /> Members without a guest</h2>
              <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
                {unmapped.map((m) => (
                  <div key={m.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`inline-block w-2 h-2 rounded-full ${m.reachable ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200">{m.name} <span className="text-[11px] text-slate-500 font-mono">{m.url}</span></p>
                        <p className="text-[11px] text-slate-500">{m.reachable ? `${m.stacks_total} stacks · ${m.containers_running}/${m.containers_total} containers` : m.error || 'no answer'} · the hub could not tell which guest this is</p>
                      </div>
                      {isAdmin && <button type="button" onClick={() => setEditing(m)} className="h-9 px-3 rounded-xl bg-amber-500/15 text-amber-200 border border-amber-500/25 text-xs font-medium hover:bg-amber-500/25 flex items-center gap-1.5"><Pencil size={12} /> Pick the guest</button>}
                      {isAdmin && <button type="button" onClick={() => setMenu(m)} className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center justify-center"><MoreHorizontal size={14} /></button>}
                    </div>
                    <MemberStacks member={m} live={m} isAdmin={isAdmin} onStackAction={stackAction} busyKey={busyKey} />
                  </div>
                ))}
              </div>
            </section>
          )}

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

          <p className="text-[11px] text-slate-600 flex items-center gap-1"><ShieldCheck size={11} /> Power actions are audited and reach your webhooks; a guest that stops on its own raises a VM alert{isHub ? '; a member that stops answering raises a fleet alert' : ''}.</p>
        </>
      )}

      {pending && <ConfirmSheet vm={pending.vm} action={pending.action} onClose={() => setPending(null)} onDone={() => { setTimeout(() => { vms.refresh(); tasks.refresh(); status.refresh() }, 1500) }} />}
      {sheet === 'link' && (
        <Sheet title="Link the VMs" subtitle="Scan the guests for DCS installs and link them; VMs without one get the join code" icon={<Radar size={18} />} onClose={() => setSheet(null)} wide>
          <FleetLinkPanel vms={vms.data?.vms} onChanged={refreshFleet} />
        </Sheet>
      )}
      {sheet === 'code' && (
        <Sheet title="Join code" subtitle="What a Docker VM runs to become a member of this hub" icon={<KeyRound size={18} />} onClose={() => setSheet(null)} wide>
          <JoinCodeCard />
        </Sheet>
      )}
      {adding && <MemberSheet prefill={adding} vms={vms.data?.vms ?? []} onClose={() => setAdding(null)} onSaved={(m) => { setAdding(null); addToast({ type: 'success', message: `${m.name} joined the fleet` }); refreshFleet() }} />}
      {editing && <MemberSheet member={editing} vms={vms.data?.vms ?? []} onClose={() => setEditing(null)} onSaved={(m) => { setEditing(null); addToast({ type: 'success', message: `${m.name} saved` }); refreshFleet() }} />}
      {menu && <MemberMenuSheet member={menu} vms={vms.data?.vms ?? []} onClose={() => setMenu(null)} onEdit={() => { setEditing(menu); setMenu(null) }} onChanged={refreshFleet} />}
      {newVm !== null && <NewVmSheet defaults={provDefaults.data ?? null} caps={caps.data ?? null} initialStack={newVm} onClose={() => setNewVm(null)} onQueued={() => { addToast({ type: 'success', message: 'The VM is being built — follow it on the card' }); refreshFleet() }} />}
    </div>
  )
}
