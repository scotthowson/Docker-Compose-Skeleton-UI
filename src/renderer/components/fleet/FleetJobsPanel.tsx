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
  if (j.status === 'done') return `VM ${j.vmid} at ${j.ip} runs the stack ${j.stack}`
  const st = j.steps.find((s) => s.id === j.current)
  return st ? `${st.label}${st.detail ? ` — ${st.detail}` : ''}` : 'Working…'
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
          <p className="text-sm font-semibold text-slate-100 truncate">VM for {job.stack}{job.vmid ? <span className="text-slate-500 font-normal"> · #{job.vmid}</span> : null}</p>
          <p className="text-[11px] text-slate-500 truncate">{job.cores} cores · {Math.round(job.memory_mb / 1024)} GB RAM · {job.disk_gb} GB disk · {job.ip}/{job.cidr} on {job.bridge} · {job.storage} · started {job.started_at ? ago(job.started_at) : 'not yet'}{job.finished_at ? ` · finished ${ago(job.finished_at)}` : ''}</p>
        </div>
        {job.status === 'failed' && <button type="button" onClick={retry} disabled={!!busy} className="h-9 px-3 rounded-xl bg-amber-500/15 text-amber-200 border border-amber-500/25 text-xs font-medium hover:bg-amber-500/25 flex items-center gap-1.5 disabled:opacity-50">{busy === 'retry' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Retry</button>}
        {(job.status === 'failed' || job.status === 'done') && <button type="button" onClick={dismiss} disabled={!!busy} className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 flex items-center justify-center disabled:opacity-50" title="Dismiss"><Trash2 size={13} /></button>}
        <button type="button" onClick={() => setOpen((o) => !o)} className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 flex items-center justify-center" title={open ? 'Collapse' : 'Expand'}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
      </div>
      {open && <ProgressCard steps={job.steps.map((s) => ({ label: s.label, hint: s.hint }))} current={jobCurrent(job)} state={jobState(job)} status={jobStatus(job)} lines={lines} compact={compact} />}
      {!open && <p className={`text-xs ${job.status === 'failed' ? 'text-rose-300' : job.status === 'done' ? 'text-emerald-300' : 'text-slate-300'}`}>{jobStatus(job)}</p>}
    </div>
  )
}

export default function FleetJobsPanel({ jobs, onChanged, compact = false, title = 'VMs being built' }: { jobs: FleetJob[]; onChanged: () => void; compact?: boolean; title?: string }) {
  if (jobs.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Server size={12} /> {title} <span className="text-slate-600">{jobs.filter((j) => j.status === 'running' || j.status === 'queued').length} active</span></h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {jobs.map((j) => <FleetJobCard key={j.id} job={j} onChanged={onChanged} compact={compact} />)}
      </div>
    </section>
  )
}
