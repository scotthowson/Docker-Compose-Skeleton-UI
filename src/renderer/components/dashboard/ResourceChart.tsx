// =============================================================================
// ResourceChart — Resource usage donut charts + load average for the Dashboard
// =============================================================================

import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useSystemStore } from '../../stores/systemStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { ServerOff } from 'lucide-react'

// Dark theme palette
const COLORS = {
  used: '#10b981',       // emerald-500
  available: '#334155',  // slate-700
  diskUsed: '#06b6d4',   // cyan-500
  diskAvailable: '#1e293b', // slate-800
}

interface DonutProps {
  title: string
  data: { name: string; value: number }[]
  colors: string[]
  centerLabel: string
  centerValue: string
}

function DonutChart({ title, data, colors, centerLabel, centerValue }: DonutProps) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <div className="relative h-36 w-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                fontSize: '12px',
                color: '#e2e8f0',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
              formatter={(value: number) => [`${value.toLocaleString()}`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-white">{centerValue}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{centerLabel}</span>
        </div>
      </div>
    </div>
  )
}

function LoadAverage({ values }: { values: [number, number, number] }) {
  const labels = ['1 min', '5 min', '15 min']
  return (
    <div className="flex flex-col items-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Load Average
      </p>
      <div className="flex items-center gap-5">
        {values.map((val, i) => {
          const color =
            val < 1.0
              ? 'text-emerald-400'
              : val < 3.0
                ? 'text-amber-400'
                : 'text-rose-400'
          return (
            <div key={labels[i]} className="flex flex-col items-center">
              <span className={`text-xl font-bold tabular-nums ${color}`}>
                {val.toFixed(2)}
              </span>
              <span className="mt-0.5 text-[10px] text-slate-500 uppercase tracking-wider">{labels[i]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function parseDiskToMB(value: string): number {
  const match = value.match(/^([\d.]+)\s*([KMGTP]?)i?B?$/i)
  if (!match) return 0
  const num = parseFloat(match[1])
  const unit = (match[2] || '').toUpperCase()
  switch (unit) {
    case 'K': return num / 1024
    case 'M': return num
    case 'G': return num * 1024
    case 'T': return num * 1024 * 1024
    case 'P': return num * 1024 * 1024 * 1024
    default: return num / (1024 * 1024)
  }
}

export default function ResourceChart() {
  const status = useSystemStore((s) => s.status)
  const connectionStatus = useConnectionStore((s) => s.status)
  const isDisconnected = !status && connectionStatus !== 'connected'

  // Show skeleton while connected but no data yet
  if (!status && connectionStatus === 'connected') {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-5 w-36 rounded bg-slate-700/50 mb-6" />
        <div className="flex items-center justify-around">
          <div className="h-36 w-36 rounded-full bg-slate-800/40" />
          <div className="h-36 w-36 rounded-full bg-slate-800/40" />
        </div>
        <div className="mt-6 flex justify-center gap-6">
          <div className="h-8 w-14 rounded bg-slate-800/40" />
          <div className="h-8 w-14 rounded bg-slate-800/40" />
          <div className="h-8 w-14 rounded bg-slate-800/40" />
        </div>
      </div>
    )
  }

  // No data + disconnected — show empty state
  if (!status && isDisconnected) {
    return (
      <div className="glass-card p-6 animate-fade-in">
        <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-slate-400">
          System Resources
        </h3>
        <div className="flex flex-col items-center justify-center py-10 text-slate-600">
          <ServerOff className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm text-slate-500">No resource data</p>
          <p className="text-xs text-slate-600 mt-1">Connect to API server to view system metrics</p>
        </div>
      </div>
    )
  }

  // Memory
  const memTotal = status?.system.memory_mb.total ?? 0
  const memAvailable = status?.system.memory_mb.available ?? 0
  const memUsed = Math.max(0, memTotal - memAvailable)
  const memPercent = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0

  const memoryData = [
    { name: 'Used', value: memUsed },
    { name: 'Available', value: memAvailable },
  ]

  // Disk
  const diskUsedMB = parseDiskToMB(status?.system.disk.used ?? '0')
  const diskAvailMB = parseDiskToMB(status?.system.disk.available ?? '0')
  const diskPercent = status?.system.disk.percent ?? '0%'

  const diskData = [
    { name: 'Used', value: diskUsedMB },
    { name: 'Available', value: diskAvailMB },
  ]

  // Load average
  const loadAvg = status?.system.load_average ?? [0, 0, 0] as [number, number, number]

  return (
    <div className="glass-card p-6 animate-fade-in">
      <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-slate-400">
        System Resources
      </h3>

      <div className="flex flex-wrap items-start justify-around gap-6">
        <DonutChart
          title="Memory"
          data={memoryData}
          colors={[COLORS.used, COLORS.available]}
          centerValue={`${memPercent}%`}
          centerLabel="used"
        />
        <DonutChart
          title="Disk"
          data={diskData}
          colors={[COLORS.diskUsed, COLORS.diskAvailable]}
          centerValue={diskPercent.replace('%', '') + '%'}
          centerLabel="used"
        />
      </div>

      <div className="mt-6 border-t border-white/5 pt-5">
        <LoadAverage values={loadAvg} />
      </div>

      {/* Quick stat callouts */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-slate-800/40 px-3 py-2.5 border border-white/[0.03]">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Memory</p>
          <p className="text-sm font-semibold text-slate-200 mt-0.5">
            {memTotal > 1024 ? `${(memTotal / 1024).toFixed(1)} GB` : `${memTotal} MB`}
          </p>
        </div>
        <div className="rounded-lg bg-slate-800/40 px-3 py-2.5 border border-white/[0.03]">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Disk Used</p>
          <p className="text-sm font-semibold text-slate-200 mt-0.5">
            {status?.system.disk.used ?? '--'} / {status?.system.disk.total ?? '--'}
          </p>
        </div>
      </div>
    </div>
  )
}
