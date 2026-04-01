// =============================================================================
// ResourceChart — Resource usage donut charts + load average for the Dashboard
//                 with tabbed Gauges / Trending views
// =============================================================================

import React, { useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip as RechartsTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { useSystemStore } from '../../stores/systemStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { ServerOff } from 'lucide-react'

// Dark theme palette
const COLORS = {
  used: '#10b981',       // emerald-500
  available: '#334155',  // slate-700
  diskUsed: '#06b6d4',   // cyan-500
  diskAvailable: '#1e293b', // slate-800
  cpuUsed: '#f59e0b',    // amber-500
  cpuAvailable: '#1e293b', // slate-800
}

// ---------------------------------------------------------------------------
// History point type (passed in from Dashboard)
// ---------------------------------------------------------------------------

export interface ResourceHistoryPoint {
  time: string
  cpu: number
  mem: number
}

// ---------------------------------------------------------------------------
// Donut sub-component
// ---------------------------------------------------------------------------

interface DonutProps {
  title: string
  data: { name: string; value: number }[]
  colors: string[]
  centerLabel: string
  centerValue: string
  unit?: string
}

function DonutChart({ title, data, colors, centerLabel, centerValue, unit = '' }: DonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activeSegment = activeIndex !== null ? data[activeIndex] : null

  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <div className="relative h-28 w-28 md:h-36 md:w-36">
        {/* Tooltip rendered outside/above the donut */}
        <div
          className={`
            absolute -top-9 left-1/2 -translate-x-1/2 z-20
            flex items-center gap-1.5
            px-2.5 py-1 rounded-lg
            backdrop-blur-md
            shadow-lg shadow-black/30
            text-[11px] font-medium
            whitespace-nowrap pointer-events-none
            transition-all duration-150 origin-bottom
            ${activeSegment ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
          `}
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#e2e8f0' }}
        >
          {activeSegment && (
            <>
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: colors[activeIndex!] }}
              />
              <span>{activeSegment.name}</span>
              <span className="text-slate-400">
                {unit.trim() === 'MB' && activeSegment.value >= 1024
                  ? `${(activeSegment.value / 1024).toFixed(1)} GB`
                  : `${activeSegment.value.toLocaleString()}${unit}`
                }
              </span>
            </>
          )}
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={52}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              animationBegin={0}
              animationDuration={800}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                  style={{
                    filter: activeIndex === index ? 'brightness(1.3)' : 'none',
                    transition: 'filter 0.2s ease',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Pie>
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

// ---------------------------------------------------------------------------
// Load average sub-component
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Trending charts sub-component
// ---------------------------------------------------------------------------

function TrendingCharts({ history }: { history: ResourceHistoryPoint[] }) {
  const tooltipStyle = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    fontSize: '11px',
    color: '#e2e8f0',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  }

  if (history.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <p className="text-sm text-slate-500">Collecting data...</p>
        <p className="text-xs text-slate-500 mt-1">Charts appear after a few poll cycles</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* CPU Load trending */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          CPU Load
        </p>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <RechartsTooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'CPU']}
                labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#cpuGradient)"
                animationDuration={400}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Memory Usage trending */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Memory Usage
        </p>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <RechartsTooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Memory']}
                labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area
                type="monotone"
                dataKey="mem"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#memGradient)"
                animationDuration={400}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type TabId = 'gauges' | 'trending'

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function ResourceChart({ history = [] }: { history?: ResourceHistoryPoint[] }) {
  const status = useSystemStore((s) => s.status)
  const systemInfo = useSystemStore((s) => s.system)
  const connectionStatus = useConnectionStore((s) => s.status)
  const isDisconnected = !status && connectionStatus !== 'connected'

  const [activeTab, setActiveTab] = useState<TabId>('gauges')

  // Show skeleton while connected but no data yet
  if (!status && connectionStatus === 'connected') {
    return (
      <div className="glass-card p-4 md:p-6 animate-pulse">
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
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-slate-400">
          System Resources
        </h3>
        <div className="flex flex-col items-center justify-center py-10 text-slate-500">
          <ServerOff className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm text-slate-500">No resource data</p>
          <p className="text-xs text-slate-500 mt-1">Connect to API server to view system metrics</p>
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

  // Swap
  const swapInfo = (status?.system as Record<string, unknown>)?.swap_mb as { total: number; free: number } | undefined
  const swapTotal = swapInfo?.total ?? 0
  const swapFree = swapInfo?.free ?? 0
  const swapUsed = Math.max(0, swapTotal - swapFree)
  const swapPercent = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0
  const hasSwap = swapTotal > 0

  const swapData = hasSwap ? [
    { name: 'Used', value: swapUsed || 1 },
    { name: 'Free', value: swapFree || 1 },
  ] : []

  // Load average & CPU
  const loadAvg = status?.system.load_average ?? [0, 0, 0] as [number, number, number]
  const cpuCount = systemInfo?.cpu_count ?? 1
  const cpuPercent = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100))
  const cpuFree = Math.max(0, 100 - cpuPercent)

  const cpuData = [
    { name: 'Load', value: cpuPercent },
    { name: 'Available', value: cpuFree },
  ]

  const tabs: { id: TabId; label: string }[] = [
    { id: 'gauges', label: 'Gauges' },
    { id: 'trending', label: 'Trending' },
  ]

  return (
    <div className="glass-card p-4 md:p-6 animate-fade-in">
      {/* Header with tabs */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          System Resources
        </h3>
        <div className="flex items-center gap-1 rounded-lg bg-slate-800/60 p-0.5 border border-white/[0.03]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-slate-700/80 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'gauges' ? (
        <>
          <div className="flex flex-wrap items-start justify-around gap-2 md:gap-4">
            <DonutChart
              title="CPU"
              data={cpuData}
              colors={[COLORS.cpuUsed, COLORS.cpuAvailable]}
              centerValue={`${cpuPercent}%`}
              centerLabel="load"
              unit="%"
            />
            <div className={`flex items-start ${hasSwap ? 'gap-1' : ''}`}>
              <DonutChart
                title="Memory"
                data={memoryData}
                colors={[COLORS.used, COLORS.available]}
                centerValue={`${memPercent}%`}
                centerLabel="used"
                unit=" MB"
              />
              {hasSwap && (
                <div className="flex flex-col items-center mt-0.5" title={`Swap: ${swapUsed > 1024 ? (swapUsed / 1024).toFixed(1) + ' GB' : swapUsed + ' MB'} used of ${swapTotal > 1024 ? (swapTotal / 1024).toFixed(0) + ' GB' : swapTotal + ' MB'}`}>
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">Swap</p>
                  <div className="relative h-14 w-14 md:h-16 md:w-16">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="14" fill="none"
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke={swapPercent > 80 ? '#f43f5e' : swapPercent > 50 ? '#f59e0b' : '#8b5cf6'}
                        strokeDasharray={`${swapPercent * 0.88} 88`}
                        style={{ transition: 'stroke-dasharray 0.7s ease' }}
                      />
                    </svg>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[11px] font-bold text-white">{swapPercent}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DonutChart
              title="Disk"
              data={diskData}
              colors={[COLORS.diskUsed, COLORS.diskAvailable]}
              centerValue={diskPercent.replace('%', '') + '%'}
              centerLabel="used"
              unit=" MB"
            />
          </div>

          <div className="mt-3 border-t border-white/5 pt-3">
            <LoadAverage values={loadAvg} />
          </div>

          {/* Quick stat callouts */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-800/40 px-2.5 py-2 border border-white/[0.03]">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">CPU Cores</p>
              <p className="text-sm font-semibold text-slate-100 mt-0.5">{cpuCount}</p>
            </div>
            <div className="rounded-lg bg-slate-800/40 px-2.5 py-2 border border-white/[0.03]">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Memory</p>
              <p className="text-sm font-semibold text-slate-100 mt-0.5">
                {memTotal > 1024 ? `${(memTotal / 1024).toFixed(1)} GB` : `${memTotal} MB`}
                {hasSwap && <span className="text-[10px] text-slate-400 font-normal"> + {swapTotal > 1024 ? `${(swapTotal / 1024).toFixed(0)} GB` : `${swapTotal} MB`} swap</span>}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/40 px-2.5 py-2 border border-white/[0.03]">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Disk Used</p>
              <p className="text-sm font-semibold text-slate-100 mt-0.5">
                {status?.system.disk.used ?? '--'} / {status?.system.disk.total ?? '--'}
              </p>
            </div>
          </div>
        </>
      ) : (
        <TrendingCharts history={history} />
      )}
    </div>
  )
}
