// =============================================================================
// ResourceChart — resource usage donuts + load average for the Dashboard,
//                 with a Gauges / Trending switch
// =============================================================================

import { useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip as RechartsTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Activity } from 'lucide-react'
import { useSystemStore } from '../../stores/systemStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { Card, CardBody, CardEmpty, CardError, CardLoading, CardOffline, CardSwitch, loadTone, METRIC_HEX, pctTone, TONE_HEX, TONE_TEXT } from './cardShared'

// The unused part of a ring (the theme engine restyles these two slate hexes)
const TRACK = '#1e293b'

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
  subtitle?: string
}

function DonutChart({ title, data, colors, centerLabel, centerValue, unit = '', subtitle }: DonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activeSegment = activeIndex !== null ? data[activeIndex] : null

  return (
    <div className="flex flex-col items-center min-w-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      {subtitle && <p className="mb-1 text-[10px] text-slate-500 truncate max-w-[100px] text-center" title={subtitle}>{subtitle}</p>}
      <div className="donut-box relative h-[5.5rem] w-[5.5rem] sm:h-24 sm:w-24 md:h-28 md:w-28" role="img" aria-label={`${title}: ${centerValue} ${centerLabel}`}>
        {/* Tooltip rendered outside/above the donut */}
        <div
          className={`
            absolute -top-9 left-1/2 -translate-x-1/2 z-20
            flex items-center gap-1.5 px-2.5 py-1 rounded-lg
            backdrop-blur-md shadow-lg shadow-black/30
            text-[11px] font-medium whitespace-nowrap pointer-events-none
            transition-all duration-150 origin-bottom
            ${activeSegment ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
          `}
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#e2e8f0' }}
          aria-hidden
        >
          {activeSegment && (
            <>
              <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colors[activeIndex!] }} />
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
              innerRadius="68%"
              outerRadius="94%"
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
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-white">{centerValue}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{centerLabel}</span>
        </div>
      </div>
    </div>
  )
}

/** the small ring for swap and video memory */
function MiniRing({ title, percent, tip, footer, color }: { title: string; percent: number; tip: string; footer?: string; color: string }) {
  return (
    <div className="flex flex-col items-center mt-0.5" title={tip}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="relative h-14 w-14 sm:h-12 sm:w-12 md:h-14 md:w-14" role="img" aria-label={`${title}: ${percent}% used`}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="14" fill="none" stroke={TRACK} strokeWidth="3" />
          <circle
            cx="18" cy="18" r="14" fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={`${percent * 0.88} 88`}
            style={{ transition: 'stroke-dasharray 0.7s ease' }}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-bold text-white">{percent}%</span>
        </div>
      </div>
      {footer && <p className="text-[10px] text-slate-500 mt-0.5">{footer}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Load average sub-component
// ---------------------------------------------------------------------------

function LoadAverage({ values, cores }: { values: [number, number, number]; cores: number | undefined }) {
  const labels = ['1 min', '5 min', '15 min']
  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Load average</p>
      <div className="flex items-center gap-5">
        {values.map((val, i) => (
          <div key={labels[i]} className="flex flex-col items-center">
            <span className={`text-xl font-bold tabular-nums ${TONE_TEXT[loadTone(val, cores)]}`}>{val.toFixed(2)}</span>
            <span className="mt-0.5 text-[10px] text-slate-500 uppercase tracking-wider">{labels[i]}</span>
          </div>
        ))}
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
    return <CardEmpty icon={<Activity size={22} />} title="Collecting data…" hint="The charts appear after a few refreshes." />
  }

  const chart = (label: string, dataKey: 'cpu' | 'mem', color: string, gradient: string, series: string) => (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
            <RechartsTooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [`${value.toFixed(1)}%`, series]}
              labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gradient})`} animationDuration={400} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {chart('CPU load', 'cpu', METRIC_HEX.cpu, 'cpuGradient', 'CPU')}
      {chart('Memory usage', 'mem', METRIC_HEX.mem, 'memGradient', 'Memory')}
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

type TabId = 'gauges' | 'trending'

const humanMb = (mb: number) => (mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`)

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function ResourceChart({ history = [] }: { history?: ResourceHistoryPoint[] }) {
  const status = useSystemStore((s) => s.status)
  const error = useSystemStore((s) => s.error)
  const systemInfo = useSystemStore((s) => s.system)
  const connectionStatus = useConnectionStore((s) => s.status)
  const isDisconnected = !status && connectionStatus !== 'connected'

  const [activeTab, setActiveTab] = useState<TabId>('gauges')

  // The poll failed before anything loaded: say why instead of a skeleton that never resolves
  if (!status && error) return <Card card="resource-chart"><CardError title="Could not load the resources" error={error} onRetry={() => window.dispatchEvent(new Event('app-refresh'))} /></Card>
  if (!status && connectionStatus === 'connected') return <Card card="resource-chart"><CardLoading label="Loading the resources…" variant="chart" /></Card>
  if (!status && isDisconnected) return <Card card="resource-chart" dim><CardOffline /></Card>

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
  const diskPct = parseInt(diskPercent, 10) || 0

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

  // Load average & CPU
  const loadAvg = status?.system.load_average ?? [0, 0, 0] as [number, number, number]
  const cpuCount = systemInfo?.cpu_count ?? 1
  const cpuPercent = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100))
  const cpuFree = Math.max(0, 100 - cpuPercent)

  const cpuData = [
    { name: 'Load', value: cpuPercent },
    { name: 'Available', value: cpuFree },
  ]

  // GPU (NVIDIA)
  const gpuInfo = (status?.system as Record<string, unknown>)?.gpu as { name: string; utilization: number; memory_used_mb: number; memory_total_mb: number; temperature: number; fan_speed: number } | null | undefined
  const hasGpu = !!gpuInfo
  const gpuUtil = gpuInfo?.utilization ?? 0
  const gpuMemUsed = gpuInfo?.memory_used_mb ?? 0
  const gpuMemTotal = gpuInfo?.memory_total_mb ?? 0
  const gpuMemPercent = gpuMemTotal > 0 ? Math.round((gpuMemUsed / gpuMemTotal) * 100) : 0
  const gpuTemp = gpuInfo?.temperature ?? 0

  return (
    <Card
      card="resource-chart"
      actions={<CardSwitch label="View" value={activeTab} onChange={setActiveTab} data={[{ value: 'gauges', label: 'Gauges' }, { value: 'trending', label: 'Trending' }]} />}
    >
      <CardBody>
        {activeTab === 'gauges' ? (
          <>
            <div className="gauge-grid grid grid-cols-3 gap-x-1 gap-y-3 sm:flex sm:items-start sm:justify-around sm:gap-3">
              <DonutChart
                title="CPU"
                subtitle={systemInfo ? `${cpuCount}-core` : undefined}
                data={cpuData}
                colors={[TONE_HEX[pctTone(cpuPercent)], TRACK]}
                centerValue={`${cpuPercent}%`}
                centerLabel="load"
                unit="%"
              />
              {hasGpu && (
                <div className="gpu-gauges contents">
                  <DonutChart
                    title="GPU"
                    subtitle={gpuInfo?.name?.replace('NVIDIA ', '').replace('GeForce ', '') ?? undefined}
                    data={[
                      { name: 'Used', value: gpuUtil || 1 },
                      { name: 'Available', value: Math.max(0, 100 - gpuUtil) || 1 },
                    ]}
                    colors={[METRIC_HEX.gpu, TRACK]}
                    centerValue={`${gpuUtil}%`}
                    centerLabel="util"
                    unit="%"
                  />
                  <MiniRing title="VRAM" percent={gpuMemPercent} color={TONE_HEX[pctTone(gpuMemPercent)]} tip={`VRAM: ${gpuMemUsed} MB / ${gpuMemTotal} MB | Temp: ${gpuTemp}°C`} footer={`${gpuTemp}°C`} />
                </div>
              )}
              <DonutChart
                title="Memory"
                data={memoryData}
                colors={[TONE_HEX[pctTone(memPercent)], TRACK]}
                centerValue={`${memPercent}%`}
                centerLabel="used"
                unit=" MB"
              />
              {hasSwap && (
                <MiniRing title="Swap" percent={swapPercent} color={TONE_HEX[pctTone(swapPercent)]} tip={`Swap: ${humanMb(Math.round(swapUsed))} used of ${humanMb(swapTotal)}`} />
              )}
              <DonutChart
                title="Disk"
                data={diskData}
                colors={[TONE_HEX[pctTone(diskPct)], TRACK]}
                centerValue={`${diskPercent.replace('%', '')}%`}
                centerLabel="used"
                unit=" MB"
              />
            </div>

            <div className="mt-3 border-t border-white/5 pt-3">
              <LoadAverage values={loadAvg} cores={systemInfo?.cpu_count} />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/[0.03] px-2.5 py-2 border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">CPU cores</p>
                <p className="text-sm font-semibold text-slate-100 mt-0.5">{cpuCount}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] px-2.5 py-2 border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total memory</p>
                <p className="text-sm font-semibold text-slate-100 mt-0.5">
                  {humanMb(memTotal)}
                  {hasSwap && <span className="text-[10px] text-slate-400 font-normal"> + {swapTotal > 1024 ? `${(swapTotal / 1024).toFixed(0)} GB` : `${swapTotal} MB`} swap</span>}
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.03] px-2.5 py-2 border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Disk used</p>
                <p className="text-sm font-semibold text-slate-100 mt-0.5">
                  {status?.system.disk.used ?? '--'} / {status?.system.disk.total ?? '--'}
                </p>
              </div>
            </div>
          </>
        ) : (
          <TrendingCharts history={history} />
        )}
      </CardBody>
    </Card>
  )
}
