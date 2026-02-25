// =============================================================================
// ServerInfo — Detailed server info card for Dashboard
// =============================================================================

import React from 'react'
import {
  Server, Globe, Cpu, MemoryStick, Clock, Network,
  HardDrive, Layers, Box, Activity,
} from 'lucide-react'
import { useSystemStore } from '../../stores/systemStore'
import { useConnectionStore } from '../../stores/connectionStore'

function InfoRow({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-white/[0.03] last:border-b-0">
      <span className={`${color} opacity-60 shrink-0`}>{icon}</span>
      <span className="text-[10px] text-slate-500 uppercase tracking-wider shrink-0 w-16 md:w-20">{label}</span>
      <span className={`ml-auto text-xs font-mono ${color} text-right truncate`}>{value}</span>
    </div>
  )
}

export default function ServerInfo() {
  const status = useSystemStore((s) => s.status)
  const version = useSystemStore((s) => s.version)
  const connectionStatus = useConnectionStore((s) => s.status)

  if (!status && connectionStatus === 'connected') {
    return (
      <div className="glass-card p-4 md:p-6 animate-pulse">
        <div className="h-5 w-32 rounded bg-slate-700/50 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-slate-800/40" />
          ))}
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
          <Server size={14} className="text-emerald-400" />
          Server Details
        </h3>
        <p className="text-xs text-slate-500 text-center py-6">Connect to view server info</p>
      </div>
    )
  }

  const memTotal = status.system.memory_mb.total
  const memAvail = status.system.memory_mb.available
  const memUsed = memTotal - memAvail
  const memPct = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0

  const dockerVersion = version?.docker_version?.replace('Docker version ', '').split(',')[0] ?? '--'
  const composeVersion = version?.compose_version?.replace(/Docker Compose version\s*/i, '').split(' ')[0] ?? '--'
  const apiVersion = version?.api_version ?? '--'

  return (
    <div className="glass-card p-4 md:p-6 animate-fade-in">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
        <Server size={14} className="text-emerald-400" />
        Server Details
      </h3>

      <div className="space-y-0">
        <InfoRow
          icon={<Globe size={12} />}
          label="Hostname"
          value={status.hostname}
          color="text-emerald-400"
        />
        <InfoRow
          icon={<Clock size={12} />}
          label="Uptime"
          value={formatUptime(status.uptime_seconds)}
          color="text-cyan-400"
        />
        <InfoRow
          icon={<Cpu size={12} />}
          label="Load Avg"
          value={status.system.load_average.map((v) => v.toFixed(2)).join(' / ')}
          color={status.system.load_average[0] > 4 ? 'text-rose-400' : status.system.load_average[0] > 2 ? 'text-amber-400' : 'text-emerald-400'}
        />
        <InfoRow
          icon={<MemoryStick size={12} />}
          label="Memory"
          value={`${formatMb(memUsed)} / ${formatMb(memTotal)} (${memPct}%)`}
          color={memPct > 85 ? 'text-rose-400' : memPct > 70 ? 'text-amber-400' : 'text-emerald-400'}
        />
        <InfoRow
          icon={<HardDrive size={12} />}
          label="Disk"
          value={`${status.system.disk.used} / ${status.system.disk.total} (${status.system.disk.percent})`}
          color="text-cyan-400"
        />
        <InfoRow
          icon={<Layers size={12} />}
          label="Stacks"
          value={`${status.stacks.running} / ${status.stacks.total} running`}
          color={status.stacks.running === status.stacks.total ? 'text-emerald-400' : 'text-amber-400'}
        />
        <InfoRow
          icon={<Box size={12} />}
          label="Containers"
          value={`${status.docker.containers.running} running, ${status.docker.containers.stopped} stopped`}
          color={status.docker.containers.stopped > 0 ? 'text-amber-400' : 'text-emerald-400'}
        />
        <InfoRow
          icon={<Activity size={12} />}
          label="Images"
          value={`${status.docker.images} images`}
          color="text-cyan-400"
        />
        <InfoRow
          icon={<Network size={12} />}
          label="Networks"
          value={`${status.docker.networks} networks, ${status.docker.volumes} volumes`}
          color="text-violet-400"
        />
        <InfoRow
          icon={<Server size={12} />}
          label="Docker"
          value={dockerVersion}
          color="text-slate-300"
        />
        <InfoRow
          icon={<Server size={12} />}
          label="Compose"
          value={composeVersion}
          color="text-slate-300"
        />
        <InfoRow
          icon={<Server size={12} />}
          label="API"
          value={`v${apiVersion}`}
          color="text-emerald-400"
        />
      </div>
    </div>
  )
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return parts.join(' ')
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb.toFixed(0)} MB`
}
