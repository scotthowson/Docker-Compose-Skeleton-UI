// =============================================================================
// FleetJobsPanel — the VMs the hub is building (or built, or failed to build):
// one progress card per job with the steps the job runner reports, the last
// log lines, Retry for a failed one and Dismiss for a finished one.
// =============================================================================

import { useState } from 'react'
import { Loader2, RefreshCw, Trash2, Server, ChevronDown, ChevronUp } from 'lucide-react'
import { retryFleetJob, deleteFleetJob } from '../../api/endpoints'
import type { FleetJob } from '../../../shared/types'
import ProgressCard, { type ProgressLine, type ProgressState } from '../common/ProgressCard'
import { ago } from './fleetShared'

function jobState(j: FleetJob): ProgressState {
  return j.status === 'done' ? 'done' : j.status === 'failed' ? 'failed' : 'running'
}
function jobCurrent(j: FleetJob): number {
  const i = j.steps.findIndex((s) => s.state === 'running' || s.state === 'failed')
  if (i >= 0) return i
  const lastDone = j.steps.map((s) => s.state).lastIndexOf('done')
  return Math.min(j.steps.length - 1, lastDone + 1)
}
function jobStatus(j: FleetJob): string {
  if (j.status === 'queued') return 'Waiting for its turn (VMs are built one at a time)'
  if (j.status === 'failed') return j.error || 'Failed'
  if (j.kind === 'bake' && j.status === 'done') return `DCS template VM ${j.vmid} for ${j.template_for ?? j.image_id} is baked — VMs built from it clone it in about 40 s`
  if (j.status === 'done' && j.manual && !j.member_id) return `VM ${j.vmid} boots the installer — install the system in its Proxmox console, then join with the code below`
  if (j.status === 'done' && j.manual) return `VM ${j.vmid} at ${j.ip} was installed by hand and joined as ${j.stack}`
  if (j.status === 'done') return `VM ${j.vmid} at ${j.ip} runs the stack ${j.stack}`
  const st = j.steps.find((s) => s.id === j.current)
  return st ? `${st.label}${st.detail ? ` — ${st.detail}` : ''}` : 'Working…'
}

function pill(j: FleetJob): { text: string; cls: string } {
  if (j.kind === 'bake' && j.status === 'done') return { text: 'template ready', cls: 'bg-amber-500/10 text-amber-200 border-amber-500/25' }
  if (j.kind === 'bake' && j.status === 'running') return { text: 'baking', cls: 'bg-amber-500/10 text-amber-200 border-amber-500/25' }
  if (j.status === 'queued') return { text: 'waiting', cls: 'bg-white/5 text-slate-400 border-white/10' }
  if (j.status === 'running') return { text: 'building', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25' }
  if (j.status === 'failed') return { text: 'failed', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/25' }
  if (j.manual && !j.member_id) return { text: 'install by hand', cls: 'bg-amber-500/10 text-amber-200 border-amber-500/25' }
  return { text: 'ready', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' }
}
function took(j: FleetJob): string {
  if (j.started_at && j.finished_at) { const s = j.finished_at - j.started_at; return s >= 120 ? `took ${Math.round(s / 60)} min` : `took ${s} s` }
  if (j.started_at && j.status === 'running') return `started ${ago(j.started_at)}`
  return ''
}
function joinLine(j: FleetJob): string {
  return `git clone https://github.com/scotthowson/Docker-Compose-Skeleton-AIO.git ~/.Docker-Compose-Skeleton-AIO && cd ~/.Docker-Compose-Skeleton-AIO && DCS_HUB_URL=${j.hub_url ?? ''} DCS_JOIN_TOKEN=${j.join_token ?? ''} DCS_STACKS=${j.stack} ./setup.sh`
}
function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) }).catch(() => {}) }}
      className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:bg-white/10 shrink-0">{done ? 'Copied' : 'Copy'}</button>
  )
}

export function FleetJobCard({ job, onChanged, compact = false }: { job: FleetJob; onChanged: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState<'retry' | 'dismiss' | ''>('')
  const [open, setOpen] = useState(job.status !== 'done')
  const lines: ProgressLine[] = (job.log ?? []).slice(-40).map((l) => ({ text: l.text, tone: l.text.startsWith('✗') ? 'bad' : l.text.startsWith('✓') ? 'ok' : l.text.startsWith('→') ? 'plain' : 'muted' }))
  const retry = async () => { setBusy('retry'); try { await retryFleetJob(job.id); onChanged() } finally { setBusy('') } }
  const dismiss = async () => {
    // a failed build may have left a VM behind: offer to take it with the job
    let destroy = false
    if (job.status === 'failed' && job.vmid) {
      destroy = window.confirm(`Also destroy VM #${job.vmid} on Proxmox? Cancel keeps the VM and only forgets the job.`)
    }
    setBusy('dismiss')
    try { await deleteFleetJob(job.id, destroy); onChanged() } finally { setBusy('') }
  }
  return (
    <div className={`glass-card rounded-2xl ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="flex items-center gap-3 flex-wrap">
        <Server size={15} className={job.status === 'done' ? 'text-emerald-400' : job.status === 'failed' ? 'text-rose-400' : 'text-cyan-400'} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100 truncate flex items-center gap-2 flex-wrap">
            <span>{job.kind === 'bake' ? `DCS template for ${job.template_for ?? job.image_id}` : `VM for ${job.stack}`}{job.vmid ? <span className="text-slate-500 font-normal"> · #{job.vmid}</span> : null}{job.cloned_from ? <span className="text-amber-300/80 font-normal text-[11px]"> · cloned from template {job.cloned_from}</span> : null}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${pill(job).cls}`}>{pill(job).text}</span>
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            <span className="text-slate-300">{job.image_kind === 'iso' ? `installer ${(job.iso ?? '').split('/').pop()}` : (job.image_id && job.image_id !== 'url' && job.image_id !== 'proxmox' ? job.image_id : job.image_file)}</span>
            {' · '}{job.cores} {job.cores === 1 ? 'core' : 'cores'} · {job.memory_mb >= 1024 ? `${Math.round(job.memory_mb / 1024 * 10) / 10} GB` : `${job.memory_mb} MB`} RAM · {job.disk_gb} GB disk · {job.ip}/{job.cidr} on {job.bridge} · {job.storage}{took(job) ? ` · ${took(job)}` : ''}
          </p>
        </div>
        {job.status === 'failed' && <button type="button" onClick={retry} disabled={!!busy} className="h-9 px-3 rounded-xl bg-amber-500/15 text-amber-200 border border-amber-500/25 text-xs font-medium hover:bg-amber-500/25 flex items-center gap-1.5 disabled:opacity-50">{busy === 'retry' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Retry</button>}
        {(job.status === 'failed' || job.status === 'done') && <button type="button" onClick={dismiss} disabled={!!busy} className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 flex items-center justify-center disabled:opacity-50" title="Dismiss"><Trash2 size={13} /></button>}
        <button type="button" onClick={() => setOpen((o) => !o)} className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 flex items-center justify-center" title={open ? 'Collapse' : 'Expand'}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
      </div>
      {job.manual && !job.member_id && job.status === 'done' && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 space-y-2">
          <p className="text-xs text-amber-200 font-medium">Finish by hand: open VM #{job.vmid} in the Proxmox console and install the system — give it {job.ip}/{job.cidr} via {job.gateway}. Then run on the VM:</p>
          <div className="flex items-start gap-2">
            <code className="text-[11px] font-mono text-slate-200 bg-black/30 rounded-lg px-2 py-1.5 break-all flex-1">{joinLine(job)}</code>
            <CopyButton text={joinLine(job)} />
          </div>
          <p className="text-[10px] text-slate-500">The join code is valid 48 h; the build closes by itself when the VM joins.</p>
        </div>
      )}
      {open && <ProgressCard steps={job.steps.map((s) => ({ label: s.label, hint: s.hint }))} current={jobCurrent(job)} state={jobState(job)} status={jobStatus(job)} lines={lines} compact={compact} />}
      {!open && <p className={`text-xs ${job.status === 'failed' ? 'text-rose-300' : job.status === 'done' ? 'text-emerald-300' : 'text-slate-300'}`}>{jobStatus(job)}</p>}
    </div>
  )
}

export default function FleetJobsPanel({ jobs, onChanged, compact = false, title = 'VMs being built' }: { jobs: FleetJob[]; onChanged: () => void; compact?: boolean; title?: string }) {
  const [clearing, setClearing] = useState(false)
  if (jobs.length === 0) return null
  const done = jobs.filter((j) => j.status === 'done'), failed = jobs.filter((j) => j.status === 'failed')
  const running = jobs.filter((j) => j.status === 'running'), queued = jobs.filter((j) => j.status === 'queued')
  const active = running.length + queued.length
  // a build takes about as long as the ones that finished (or a minute and a half until one has)
  const durations = done.filter((j) => j.started_at && j.finished_at).map((j) => (j.finished_at as number) - (j.started_at as number))
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 90
  const now = Date.now() / 1000
  const runningLeft = running.reduce((a, j) => a + Math.max(10, avg - (j.started_at ? now - j.started_at : 0)), 0)
  const eta = Math.round((runningLeft + queued.length * avg) / 60)
  const pct = Math.round(((done.length + failed.length + running.reduce((a, j) => a + (j.steps.filter((s) => s.state === 'done').length / Math.max(1, j.steps.length)), 0)) / jobs.length) * 100)
  // finished builds are cleared together; a failed one and a by-hand install still waiting for its join stay
  const clearable = done.filter((j) => !(j.manual && !j.member_id))
  const clearFinished = async () => { setClearing(true); try { for (const j of clearable) await deleteFleetJob(j.id) ; onChanged() } finally { setClearing(false) } }
  return (
    <section className="space-y-2">
      {active > 0 && (
        <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <Loader2 size={14} className="animate-spin text-cyan-400 shrink-0" />
          <p className="text-xs text-slate-200 flex-1 min-w-[12rem]">
            Building {jobs.length} VM{jobs.length === 1 ? '' : 's'} — {done.length} done{failed.length ? `, ${failed.length} failed` : ''}, {running.length} building, {queued.length} waiting{eta > 0 ? ` · about ${eta} min left` : ''}
          </p>
          <div className="w-full sm:w-64 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full bg-cyan-400/80 transition-all duration-700" style={{ width: `${pct}%` }} /></div>
          <span className="text-[11px] text-slate-500 w-10 text-right">{pct}%</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Server size={12} /> {title} <span className="text-slate-600">{active} active</span></h2>
        {clearable.length > 0 && active === 0 && (
          <button type="button" onClick={clearFinished} disabled={clearing} className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:bg-white/10 flex items-center gap-1.5 disabled:opacity-50">
            {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Clear finished
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {jobs.map((j) => <FleetJobCard key={j.id} job={j} onChanged={onChanged} compact={compact} />)}
      </div>
    </section>
  )
}
