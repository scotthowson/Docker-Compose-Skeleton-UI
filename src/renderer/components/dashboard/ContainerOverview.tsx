// =============================================================================
// ContainerOverview — live container status list for the Dashboard, with a
//                     compact donut of the status breakdown
// =============================================================================

import { Box, RotateCcw } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useConnectionStore } from '../../stores/connectionStore'
import { useContainerStore } from '../../stores/containerStore'
import type { ContainerInfo } from '../../../shared/types'
import { Card, CardBody, CardEmpty, CardLoading, CardOffline } from './cardShared'

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusDot(state: string): string {
  switch (state) {
    case 'running': return 'bg-emerald-400'
    case 'exited': return 'bg-slate-500'
    case 'paused': return 'bg-amber-400'
    case 'restarting': return 'bg-amber-400 animate-pulse'
    default: return 'bg-rose-400'
  }
}

function healthBadge(health: string): string {
  switch (health) {
    case 'healthy': return 'bg-emerald-500/10 text-emerald-400'
    case 'unhealthy': return 'bg-rose-500/10 text-rose-400'
    case 'starting': return 'bg-amber-500/10 text-amber-400'
    default: return 'bg-slate-500/10 text-slate-400'
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}

// ---------------------------------------------------------------------------
// The donut: running is fine, paused needs a look, stopped is off (neutral)
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  running: '#10b981',  // emerald-500
  stopped: '#64748b',  // slate-500
  paused: '#f59e0b',   // amber-500
  other: '#94a3b8',    // slate-400
}

function StatusDonut({ containers }: { containers: ContainerInfo[] }) {
  const running = containers.filter((c) => c.state === 'running').length
  const stopped = containers.filter((c) => c.state === 'exited').length
  const paused = containers.filter((c) => c.state === 'paused').length
  const other = containers.length - running - stopped - paused

  const data = [
    { name: 'Running', value: running, color: STATUS_COLORS.running },
    { name: 'Stopped', value: stopped, color: STATUS_COLORS.stopped },
    { name: 'Paused', value: paused, color: STATUS_COLORS.paused },
    { name: 'Other', value: other, color: STATUS_COLORS.other },
  ].filter((d) => d.value > 0)

  // If no containers, show a single grey ring
  if (data.length === 0) data.push({ name: 'None', value: 1, color: '#1e293b' })

  return (
    <div className="relative h-20 w-20 shrink-0" role="img" aria-label={`${containers.length} containers: ${running} running, ${stopped} stopped, ${paused} paused`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={26}
            outerRadius={36}
            paddingAngle={data.length > 1 ? 3 : 0}
            dataKey="value"
            stroke="none"
            animationBegin={0}
            animationDuration={600}
          >
            {data.map((entry, index) => (
              <Cell key={`status-cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-white leading-none">{containers.length}</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">total</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function ContainerOverview({ containers }: { containers: ContainerInfo[] }) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const loading = useContainerStore((s) => s.loading)

  if (!isConnected && containers.length === 0) return <Card card="container-overview" dim><CardOffline /></Card>
  if (containers.length === 0) {
    return (
      <Card card="container-overview" open="containers">
        {loading
          ? <CardLoading label="Loading the containers…" rows={5} />
          : <CardEmpty icon={<Box size={22} />} title="No containers yet" hint="Start a stack or deploy a template and its containers appear here." />}
      </Card>
    )
  }

  const running = containers.filter((c) => c.state === 'running')
  const stopped = containers.filter((c) => c.state !== 'running')
  const sorted = [...running, ...stopped]
  const exited = containers.filter((c) => c.state === 'exited').length
  const paused = containers.filter((c) => c.state === 'paused').length

  return (
    <Card
      card="container-overview"
      open="containers"
      meta={<><span className="text-emerald-400 font-medium">{running.length}</span><span className="text-slate-600 mx-0.5">/</span>{containers.length}</>}
    >
      <CardBody>
        <div className="flex items-center gap-4 mb-3 pb-3 border-b border-white/5">
          <StatusDonut containers={containers} />
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
            {running.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                <span className="text-slate-400">{running.length} running</span>
              </div>
            )}
            {exited > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-500" aria-hidden />
                <span className="text-slate-400">{exited} stopped</span>
              </div>
            )}
            {paused > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                <span className="text-slate-400">{paused} paused</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-0.5">
          {sorted.map((container) => (
            <div
              key={`${container.member ?? ''}|${container.name}`}
              className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group"
            >
              <span className={`h-2 w-2 rounded-full ${statusDot(container.state)} shrink-0`} aria-hidden />
              <span className="flex-1 text-xs font-mono text-slate-300 truncate group-hover:text-white transition-colors" title={container.name}>
                {container.name}
              </span>
              {container.health && container.health !== 'none' && container.health !== '' && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${healthBadge(container.health)}`}>{container.health}</span>
              )}
              {container.state === 'running' && container.uptime_seconds > 0 && (
                <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{formatUptime(container.uptime_seconds)}</span>
              )}
              {container.restart_count > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 tabular-nums shrink-0"
                  title={`${container.restart_count} restart${container.restart_count === 1 ? '' : 's'}`}
                  role="img"
                  aria-label={`${container.restart_count} restart${container.restart_count === 1 ? '' : 's'}`}
                >
                  <RotateCcw size={9} aria-hidden />{container.restart_count}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
