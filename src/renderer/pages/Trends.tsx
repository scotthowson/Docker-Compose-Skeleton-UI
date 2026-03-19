// =============================================================================
// Trends — Resource Usage Trends page with historical CPU, Memory, and Disk
//           charts powered by server-side metrics collection (cron snapshots)
// =============================================================================

import { useState, useCallback, useMemo } from 'react'
import {
  TrendingUp, Clock, Cpu, HardDrive, MemoryStick,
  RefreshCw, Loader2, Database, WifiOff, Camera,
  Activity, BarChart3, Timer, Settings2, X, Save,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { fetchMetricsTrends, captureMetricsSnapshot, fetchAlertConfig, updateAlertConfig } from '../api/endpoints'
import type { MetricsTrendsResponse, AlertConfigResponse, AlertThresholds } from '../../shared/types'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type TimeRange = '1h' | '6h' | '24h' | '7d'

const TIME_RANGES: { id: TimeRange; label: string; shortLabel: string }[] = [
  { id: '1h', label: '1 Hour', shortLabel: '1h' },
  { id: '6h', label: '6 Hours', shortLabel: '6h' },
  { id: '24h', label: '24 Hours', shortLabel: '24h' },
  { id: '7d', label: '7 Days', shortLabel: '7d' },
]

const tooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '10px',
  fontSize: '11px',
  color: '#e2e8f0',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
}

const tooltipLabelStyle = { color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format epoch timestamp to a readable time label based on the selected range */
function formatTimeLabel(epoch: number, range: TimeRange): string {
  const d = new Date(epoch * 1000)
  if (range === '1h' || range === '6h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hours}:${mins}`
}

/** Build chart-ready data from the API response */
function buildChartData(data: MetricsTrendsResponse | null, range: TimeRange) {
  if (!data?.points?.length) return []
  return data.points.map((p) => ({
    time: formatTimeLabel(p.epoch, range),
    epoch: p.epoch,
    cpu: p.cpu_pct,
    load1: p.load1,
    mem: p.mem_pct,
    disk: p.disk_pct,
  }))
}

// ---------------------------------------------------------------------------
// Stat Card sub-component
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  subValue?: string
  color: string
  delay: number
}

function StatCard({ icon, label, value, subValue, color, delay }: StatCardProps) {
  const colorMap: Record<string, string> = {
    amber: 'from-amber-500/20 to-orange-500/20 border-amber-500/10 text-amber-400',
    emerald: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/10 text-emerald-400',
    cyan: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/10 text-cyan-400',
    slate: 'from-slate-500/20 to-slate-600/20 border-slate-500/10 text-slate-400',
  }
  const classes = colorMap[color] || colorMap.slate

  return (
    <div
      className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-3 md:p-4 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${classes} border flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="text-xl md:text-2xl font-bold text-slate-100 tabular-nums">{value}</p>
      {subValue && (
        <p className="text-[10px] text-slate-600 mt-0.5">{subValue}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart Card sub-component
// ---------------------------------------------------------------------------

interface ChartCardProps {
  title: string
  icon: React.ReactNode
  gradientId: string
  strokeColor: string
  dataKey: string
  data: ReturnType<typeof buildChartData>
  thresholdWarning?: number
  thresholdCritical?: number
  delay: number
  unit?: string
}

function ChartCard({
  title,
  icon,
  gradientId,
  strokeColor,
  dataKey,
  data,
  thresholdWarning,
  thresholdCritical,
  delay,
  unit = '%',
}: ChartCardProps) {
  // Compute min/max for the dataKey
  const values = data.map((d) => (d as Record<string, number>)[dataKey] ?? 0)
  const peak = values.length > 0 ? Math.max(...values) : 0
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0

  return (
    <div
      className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6 animate-fade-in gradient-border"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Chart header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-600">
            Avg: <span className="text-slate-400 font-medium tabular-nums">{avg.toFixed(1)}{unit}</span>
          </span>
          <span className="text-[10px] text-slate-600">
            Peak: <span className="text-slate-400 font-medium tabular-nums">{peak.toFixed(1)}{unit}</span>
          </span>
        </div>
      </div>

      {/* Chart area - responsive height */}
      <div className="h-40 md:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
                <stop offset="50%" stopColor={strokeColor} stopOpacity={0.12} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.5)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              width={40}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              formatter={(value: number) => [`${value.toFixed(1)}${unit}`, title]}
              animationDuration={150}
            />
            {/* Threshold warning line */}
            {thresholdWarning != null && (
              <ReferenceLine
                y={thresholdWarning}
                stroke="#fbbf24"
                strokeDasharray="6 3"
                strokeWidth={1}
                strokeOpacity={0.5}
                label={{
                  value: `Warn ${thresholdWarning}%`,
                  position: 'insideTopRight',
                  fill: '#fbbf24',
                  fontSize: 9,
                  opacity: 0.6,
                }}
              />
            )}
            {/* Threshold critical line */}
            {thresholdCritical != null && (
              <ReferenceLine
                y={thresholdCritical}
                stroke="#f43f5e"
                strokeDasharray="6 3"
                strokeWidth={1}
                strokeOpacity={0.5}
                label={{
                  value: `Crit ${thresholdCritical}%`,
                  position: 'insideTopRight',
                  fill: '#f43f5e',
                  fontSize: 9,
                  opacity: 0.6,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              animationDuration={600}
              dot={false}
              activeDot={{
                r: 4,
                stroke: strokeColor,
                strokeWidth: 2,
                fill: 'rgba(15, 23, 42, 0.9)',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Trends Page
// ---------------------------------------------------------------------------

export default function Trends() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const { addToast } = useToast()

  const [range, setRange] = useState<TimeRange>('1h')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [capturing, setCapturing] = useState(false)

  // Alert threshold config modal state
  const [showAlertConfig, setShowAlertConfig] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [editThresholds, setEditThresholds] = useState<AlertThresholds | null>(null)

  // Fetch trends data with polling
  const fetchTrends = useCallback(() => fetchMetricsTrends(range), [range])

  const { data, loading, error, refresh } = usePolling<MetricsTrendsResponse>(
    fetchTrends,
    60000,
    { enabled: isConnected && autoRefresh },
  )

  // Fetch alert thresholds (once, low frequency)
  const { data: alertConfig } = usePolling<AlertConfigResponse>(
    fetchAlertConfig,
    300000,
    { enabled: isConnected },
  )

  // Build chart data
  const chartData = useMemo(() => buildChartData(data, range), [data, range])

  // Latest data point for summary stats
  const latest = data?.points?.length ? data.points[data.points.length - 1] : null
  const pointCount = data?.count ?? 0

  // Thresholds from alert config
  const thresholds = alertConfig?.thresholds

  // Manual snapshot capture
  const handleCaptureSnapshot = useCallback(async () => {
    setCapturing(true)
    try {
      await captureMetricsSnapshot()
      // Refresh trends data after capturing
      setTimeout(() => refresh(), 500)
    } catch {
      // Silently fail - the user can see the error in the console
    } finally {
      setCapturing(false)
    }
  }, [refresh])

  // Manual refresh (also performs a one-time fetch when autoRefresh is off)
  const handleRefresh = useCallback(() => {
    refresh()
  }, [refresh])

  // Open alert config modal
  const openAlertConfig = useCallback(() => {
    setEditThresholds(thresholds ? { ...thresholds } : {
      cpu_warning: 75,
      cpu_critical: 90,
      memory_warning: 80,
      memory_critical: 95,
      disk_warning: 80,
      disk_critical: 95,
      restart_threshold: 5,
    })
    setShowAlertConfig(true)
  }, [thresholds])

  // Save alert thresholds
  const handleSaveAlertConfig = useCallback(async () => {
    if (!editThresholds) return
    setSavingConfig(true)
    try {
      await updateAlertConfig(editThresholds)
      addToast({ type: 'success', message: 'Alert thresholds updated' })
      setShowAlertConfig(false)
    } catch {
      addToast({ type: 'error', message: 'Failed to update alert thresholds' })
    } finally {
      setSavingConfig(false)
    }
  }, [editThresholds, addToast])

  // -------------------------------------------------------------------------
  // Disconnected state
  // -------------------------------------------------------------------------

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
          <WifiOff size={24} className="text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">Connect to a server to view resource trends</p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* ----------------------------------------------------------------- */}
      {/* Page header                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/10 flex items-center justify-center text-emerald-400">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Resource Trends</h2>
            <p className="text-xs text-slate-500">
              {pointCount > 0
                ? `${pointCount} data point${pointCount === 1 ? '' : 's'} \u00b7 ${TIME_RANGES.find((r) => r.id === range)?.label ?? range}`
                : 'Historical resource usage metrics'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Capture Snapshot — admin only */}
          {isAdmin && (
            <button
              onClick={handleCaptureSnapshot}
              disabled={capturing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 disabled:opacity-50 press"
            >
              {capturing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Camera size={13} />
              )}
              <span className="hidden sm:inline">Capture Snapshot</span>
              <span className="sm:hidden">Capture</span>
            </button>
          )}

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 press ${
              autoRefresh
                ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/25'
                : 'bg-white/[0.04] text-slate-500 border-white/[0.06] hover:bg-white/[0.08] hover:text-slate-400'
            }`}
            title={autoRefresh ? 'Auto-refresh enabled (1 min)' : 'Auto-refresh disabled'}
          >
            <Timer size={13} />
            <span className="hidden sm:inline">{autoRefresh ? 'Auto' : 'Paused'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-all duration-200 disabled:opacity-50 press"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Time range selector                                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg bg-white/[0.03] border border-white/[0.06] p-0.5">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.id}
              onClick={() => setRange(tr.id)}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                range === tr.id
                  ? 'bg-white/[0.08] text-slate-200 shadow-sm shadow-black/20'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <Clock size={12} className={range === tr.id ? 'text-emerald-400' : 'text-slate-600'} />
              <span className="hidden sm:inline">{tr.label}</span>
              <span className="sm:hidden">{tr.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Configure Alerts gear button — admin only */}
        {isAdmin && (
          <button
            onClick={openAlertConfig}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-slate-300 transition-all duration-200 press"
            title="Configure alert thresholds"
          >
            <Settings2 size={13} />
            <span className="hidden sm:inline">Alerts</span>
          </button>
        )}

        {/* Subtle connection indicator */}
        {autoRefresh && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Summary stats row                                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <StatCard
          icon={<Cpu size={14} />}
          label="Current CPU"
          value={latest ? `${latest.cpu_pct.toFixed(1)}%` : '--'}
          subValue={latest ? `Load: ${latest.load1.toFixed(2)}` : undefined}
          color="amber"
          delay={0}
        />
        <StatCard
          icon={<MemoryStick size={14} />}
          label="Current Memory"
          value={latest ? `${latest.mem_pct.toFixed(1)}%` : '--'}
          subValue={latest ? `${latest.mem_used_mb.toLocaleString()} / ${latest.mem_total_mb.toLocaleString()} MB` : undefined}
          color="emerald"
          delay={60}
        />
        <StatCard
          icon={<HardDrive size={14} />}
          label="Current Disk"
          value={latest ? `${latest.disk_pct.toFixed(1)}%` : '--'}
          color="cyan"
          delay={120}
        />
        <StatCard
          icon={<Database size={14} />}
          label="Data Points"
          value={pointCount > 0 ? pointCount.toLocaleString() : '--'}
          subValue={data?.range ? `Range: ${data.range}` : undefined}
          color="slate"
          delay={180}
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Loading state (initial load only)                                  */}
      {/* ----------------------------------------------------------------- */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
          <Loader2 size={28} className="animate-spin text-emerald-500/60" />
          <p className="text-sm text-slate-500">Loading trend data...</p>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Error state                                                        */}
      {/* ----------------------------------------------------------------- */}
      {error && !data && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-rose-500/15 rounded-xl p-6 text-center animate-fade-in">
          <Activity size={28} className="text-rose-500/40 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-1">Failed to load trend data</p>
          <p className="text-xs text-slate-600 mb-4">{error.message}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Empty state                                                        */}
      {/* ----------------------------------------------------------------- */}
      {data && chartData.length === 0 && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-8 md:p-12 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={24} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-400 font-medium mb-1.5">No trend data yet</p>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Metrics are collected every minute via cron. Data will appear here once the first snapshots are recorded. You can also manually capture a snapshot above.
          </p>
          {isAdmin && (
            <button
              onClick={handleCaptureSnapshot}
              disabled={capturing}
              className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
            >
              {capturing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Camera size={13} />
              )}
              Capture First Snapshot
            </button>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Charts                                                             */}
      {/* ----------------------------------------------------------------- */}
      {chartData.length > 0 && (
        <div className="space-y-3 md:space-y-4">
          {/* CPU Load Chart */}
          <ChartCard
            title="CPU Load"
            icon={<Cpu size={14} className="text-amber-400" />}
            gradientId="trendCpuGradient"
            strokeColor="#f59e0b"
            dataKey="cpu"
            data={chartData}
            thresholdWarning={thresholds?.cpu_warning}
            thresholdCritical={thresholds?.cpu_critical}
            delay={0}
          />

          {/* Memory Usage Chart */}
          <ChartCard
            title="Memory Usage"
            icon={<MemoryStick size={14} className="text-emerald-400" />}
            gradientId="trendMemGradient"
            strokeColor="#10b981"
            dataKey="mem"
            data={chartData}
            thresholdWarning={thresholds?.memory_warning}
            thresholdCritical={thresholds?.memory_critical}
            delay={60}
          />

          {/* Disk Usage Chart */}
          <ChartCard
            title="Disk Usage"
            icon={<HardDrive size={14} className="text-cyan-400" />}
            gradientId="trendDiskGradient"
            strokeColor="#06b6d4"
            dataKey="disk"
            data={chartData}
            thresholdWarning={thresholds?.disk_warning}
            thresholdCritical={thresholds?.disk_critical}
            delay={120}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Alert Threshold Configuration Modal                                  */}
      {/* ------------------------------------------------------------------- */}
      {showAlertConfig && editThresholds && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">Alert Thresholds</h3>
              </div>
              <button
                onClick={() => setShowAlertConfig(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* CPU */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Cpu size={14} className="text-amber-400" />
                  <span className="text-xs font-semibold text-slate-300">CPU Load</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-amber-400/80 uppercase tracking-wider font-semibold">Warning</label>
                      <span className="text-xs font-mono text-amber-400 tabular-nums">{editThresholds.cpu_warning}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={editThresholds.cpu_warning}
                      onChange={(e) => setEditThresholds({ ...editThresholds, cpu_warning: Number(e.target.value) })}
                      className="w-full h-1.5 rounded-full appearance-none bg-slate-800 accent-amber-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-rose-400/80 uppercase tracking-wider font-semibold">Critical</label>
                      <span className="text-xs font-mono text-rose-400 tabular-nums">{editThresholds.cpu_critical}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={editThresholds.cpu_critical}
                      onChange={(e) => setEditThresholds({ ...editThresholds, cpu_critical: Number(e.target.value) })}
                      className="w-full h-1.5 rounded-full appearance-none bg-slate-800 accent-rose-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-white/[0.04]" />

              {/* Memory */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MemoryStick size={14} className="text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-300">Memory Usage</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-amber-400/80 uppercase tracking-wider font-semibold">Warning</label>
                      <span className="text-xs font-mono text-amber-400 tabular-nums">{editThresholds.memory_warning}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={editThresholds.memory_warning}
                      onChange={(e) => setEditThresholds({ ...editThresholds, memory_warning: Number(e.target.value) })}
                      className="w-full h-1.5 rounded-full appearance-none bg-slate-800 accent-amber-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-rose-400/80 uppercase tracking-wider font-semibold">Critical</label>
                      <span className="text-xs font-mono text-rose-400 tabular-nums">{editThresholds.memory_critical}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={editThresholds.memory_critical}
                      onChange={(e) => setEditThresholds({ ...editThresholds, memory_critical: Number(e.target.value) })}
                      className="w-full h-1.5 rounded-full appearance-none bg-slate-800 accent-rose-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-white/[0.04]" />

              {/* Disk */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <HardDrive size={14} className="text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-300">Disk Usage</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-amber-400/80 uppercase tracking-wider font-semibold">Warning</label>
                      <span className="text-xs font-mono text-amber-400 tabular-nums">{editThresholds.disk_warning}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={editThresholds.disk_warning}
                      onChange={(e) => setEditThresholds({ ...editThresholds, disk_warning: Number(e.target.value) })}
                      className="w-full h-1.5 rounded-full appearance-none bg-slate-800 accent-amber-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-rose-400/80 uppercase tracking-wider font-semibold">Critical</label>
                      <span className="text-xs font-mono text-rose-400 tabular-nums">{editThresholds.disk_critical}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={editThresholds.disk_critical}
                      onChange={(e) => setEditThresholds({ ...editThresholds, disk_critical: Number(e.target.value) })}
                      className="w-full h-1.5 rounded-full appearance-none bg-slate-800 accent-rose-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06] shrink-0">
              <button
                onClick={() => setShowAlertConfig(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAlertConfig}
                disabled={savingConfig}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 disabled:opacity-50 press"
              >
                {savingConfig ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Thresholds
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
