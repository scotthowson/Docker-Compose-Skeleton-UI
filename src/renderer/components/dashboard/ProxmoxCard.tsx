// =============================================================================
// ProxmoxCard — the Proxmox host at a glance: node load and every VM/LXC with
// its state. Read-only here; the Proxmox page has the power buttons.
// =============================================================================

import React from 'react'
import { Server, Settings2, Cpu, MemoryStick } from 'lucide-react'
import { usePolling } from '../../hooks/usePolling'
import { useConnectionStore } from '../../stores/connectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { fetchProxmoxStatus, fetchProxmoxVms, fetchProxmoxNodes } from '../../api/endpoints'
import { CardHeader, CardLoading, CardError, CardEmpty } from './cardShared'

function fmtGb(n: number): string { return n ? `${(n / 1073741824).toFixed(n >= 10737418240 ? 0 : 1)} GB` : '0' }

export default function ProxmoxCard() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const status = usePolling(fetchProxmoxStatus, 30000, { enabled: isConnected })
  const ready = !!status.data?.configured && !!status.data?.reachable
  const vms = usePolling(fetchProxmoxVms, 15000, { enabled: isConnected && ready })
  const nodes = usePolling(fetchProxmoxNodes, 15000, { enabled: isConnected && ready })
  const s = status.data

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <CardHeader
        icon={<Server size={15} />}
        title="Proxmox"
        count={s?.reachable ? `${s.vms.running}/${s.vms.total} running` : undefined}
        right={ready ? (
          <button onClick={() => setCurrentPage('proxmox')} className="rounded-full px-2 py-0.5 text-[10px] font-medium border bg-amber-500/10 text-amber-300 border-amber-500/20 hover:bg-amber-500/20" title="Open the Proxmox page">PVE {s?.version}</button>
        ) : undefined}
      />
      {status.error && !s ? (
        <CardError error={status.error} onRetry={status.refresh} />
      ) : !s ? (
        <CardLoading label="Checking Proxmox…" />
      ) : !s.configured ? (
        <CardEmpty icon={<Server size={20} />} title="Not linked" hint="Add the Proxmox URL and an API token in Server Config → Proxmox" action={<button onClick={() => setCurrentPage('config')} className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1"><Settings2 size={11} /> Open Config</button>} />
      ) : !s.reachable ? (
        <CardEmpty icon={<Server size={20} />} title="Proxmox does not answer" hint={s.error || s.hints?.[0] || ''} action={<button onClick={() => setCurrentPage('proxmox')} className="text-[11px] text-amber-300 hover:text-amber-200">Details</button>} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mt-1">
          {(nodes.data?.nodes ?? []).map((n) => (
            <div key={n.node} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-200 truncate">{n.node}</span>
                <span className={`text-[10px] ${n.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>{n.status}</span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-1.5 text-slate-400"><Cpu size={10} /><div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full ${n.cpu >= 90 ? 'bg-rose-500' : n.cpu >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, n.cpu)}%` }} /></div><span className="tabular-nums w-9 text-right text-slate-300">{n.cpu}%</span></div>
                <div className="flex items-center gap-1.5 text-slate-400"><MemoryStick size={10} /><div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full ${n.mem_pct >= 90 ? 'bg-rose-500' : n.mem_pct >= 75 ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${Math.min(100, n.mem_pct)}%` }} /></div><span className="tabular-nums w-9 text-right text-slate-300">{n.mem_pct}%</span></div>
              </div>
            </div>
          ))}
          <div className="divide-y divide-white/[0.04]">
            {(vms.data?.vms ?? []).slice(0, 8).map((v) => (
              <button key={`${v.node}/${v.type}/${v.vmid}`} onClick={() => setCurrentPage('proxmox')} className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-white/[0.03] rounded-lg px-1">
                <span className={`w-2 h-2 rounded-full shrink-0 ${v.status === 'running' ? 'bg-emerald-400' : v.status === 'paused' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                <span className="text-xs text-slate-200 truncate flex-1 min-w-0">{v.name}</span>
                <span className={`text-[9px] px-1 rounded border ${v.type === 'qemu' ? 'text-cyan-300 border-cyan-500/20' : 'text-violet-300 border-violet-500/20'}`}>{v.type === 'qemu' ? 'VM' : 'LXC'}</span>
                <span className="text-[10px] text-slate-500 tabular-nums w-16 text-right">{v.status === 'running' ? `${v.cpu}% · ${fmtGb(v.mem)}` : v.status}</span>
              </button>
            ))}
            {(vms.data?.vms.length ?? 0) > 8 && <button onClick={() => setCurrentPage('proxmox')} className="w-full text-[11px] text-slate-500 hover:text-slate-300 py-1.5">and {(vms.data?.vms.length ?? 0) - 8} more…</button>}
          </div>
        </div>
      )}
    </div>
  )
}
