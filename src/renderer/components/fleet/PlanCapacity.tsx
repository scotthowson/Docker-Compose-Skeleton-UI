// =============================================================================
// PlanCapacity — what the VMs about to be built ask of the Proxmox node, next to
// what the node has and what its running guests (the hub among them) already
// hold: memory as a bar (running | planned | free — red when the plan does not
// fit), disk on the chosen storage, and the vCPUs. Memory and disk are real
// limits; vCPUs may be shared, so they are only reported.
// =============================================================================

import { Progress, Tooltip } from '@mantine/core'
import { AlertTriangle, Cpu, HardDrive, MemoryStick } from 'lucide-react'
import type { FleetProvisionDefaults } from '../../../shared/types'

// the theme's colours (lib/themeEngine sets them; the fallbacks are the stock dark look); the VMs being planned
// wear the fleet's violet (Mantine's, which every theme keeps) — amber is for what needs attention, and only the
// over-full plan does (rose)
const C = {
  held: 'color-mix(in srgb, var(--dcs-text-muted, #94a3b8) 45%, transparent)',
  planned: 'var(--mantine-color-violet-5)',
  over: 'var(--dcs-danger, #fb7185)',
  free: 'color-mix(in srgb, var(--dcs-text-muted, #94a3b8) 12%, transparent)',
}
const gb = (n: number) => `${Math.round(n * 10) / 10} GB`

export interface PlannedVm { cores: number; memGb: number; diskGb: number }

export default function PlanCapacity({ plan, defaults, storage }: { plan: PlannedVm[]; defaults: FleetProvisionDefaults | null; storage: string }) {
  if (!defaults || plan.length === 0) return null
  const cap = defaults.capacity
  const plannedMem = plan.reduce((n, v) => n + v.memGb, 0)
  const plannedDisk = plan.reduce((n, v) => n + v.diskGb, 0)
  const plannedCpu = plan.reduce((n, v) => n + v.cores, 0)
  // what the node's running guests hold already (the hub is one of them)
  const running = (defaults.guests ?? []).filter((g) => g.status === 'running' && (!defaults.node || g.node === defaults.node))
  const heldMem = running.reduce((n, g) => n + (g.maxmem_gb ?? 0), 0)
  const total = cap?.memory_gb ?? 0
  const st = defaults.storages.find((s) => s.storage === storage)
  const freeDisk = st ? st.avail / 1073741824 : 0
  const memOver = total > 0 && heldMem + plannedMem > total
  const diskOver = freeDisk > 0 && plannedDisk > freeDisk
  const denom = Math.max(total, heldMem + plannedMem, 1)
  const pct = (n: number) => (n / denom) * 100
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3 space-y-2.5">
      <p className="text-[11px] text-slate-300 flex items-center gap-x-3 gap-y-1 flex-wrap">
        <b className="text-slate-100">{plan.length} VM{plan.length === 1 ? '' : 's'}</b>
        <span className="inline-flex items-center gap-1"><Cpu size={11} className="text-slate-500" />{plannedCpu} vCPU{cap?.cores ? <span className="text-slate-500"> on {cap.cores} cores</span> : null}</span>
        <span className="inline-flex items-center gap-1"><MemoryStick size={11} className="text-slate-500" />{gb(plannedMem)} RAM</span>
        <span className="inline-flex items-center gap-1"><HardDrive size={11} className="text-slate-500" />{plannedDisk} GB disk{st ? <span className="text-slate-500"> on {st.storage}</span> : null}</span>
      </p>
      {total > 0 && (
        <div className="space-y-1">
          <Progress.Root size={8} radius="xl" styles={{ root: { background: C.free } }} aria-label={`Memory on ${defaults.node}: ${gb(heldMem)} in use by running guests, ${gb(plannedMem)} planned, ${gb(total)} in the node`}>
            <Tooltip label={`${gb(heldMem)} held by the guests running on ${defaults.node || 'the node'}${running.length ? ` (${running.map((g) => g.name).join(', ')})` : ''}`}>
              <Progress.Section value={pct(heldMem)} color={C.held} />
            </Tooltip>
            <Tooltip label={`${gb(plannedMem)} for the ${plan.length} planned VM${plan.length === 1 ? '' : 's'}`}>
              <Progress.Section value={pct(plannedMem)} color={memOver ? C.over : C.planned} />
            </Tooltip>
          </Progress.Root>
          <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500 flex-wrap">
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: C.held }} />{gb(heldMem)} running</span>
              <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: memOver ? C.over : C.planned }} />{gb(plannedMem)} planned</span>
            </span>
            <span className={memOver ? 'text-rose-300 font-medium' : ''}>{gb(heldMem + plannedMem)} of {gb(total)} in {defaults.node || 'the node'}</span>
          </div>
        </div>
      )}
      {(memOver || diskOver) && (
        <p className="text-[11px] text-rose-300 flex items-start gap-2">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>
            {memOver ? <>The VMs and what already runs on {defaults.node || 'the node'} need {gb(heldMem + plannedMem)} of the {gb(total)} it has — some would not start (or the node would swap). Make them smaller, or keep some stacks on the hub. </> : null}
            {diskOver ? <>{plannedDisk} GB of disks on {st?.storage} which has {Math.round(freeDisk)} GB free (a thin-provisioned disk only fills as it is used).</> : null}
          </span>
        </p>
      )}
    </div>
  )
}
