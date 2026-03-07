import { TrendingUp, ServerOff, AlertCircle, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { MetricsTrendsResponse } from '../../../shared/types'

function MiniChart({ points, color, height = 48 }: { points: number[]; color: string; height?: number }) {
  if (points.length < 2) return null
  const max = Math.max(...points, 1)
  const w = 200
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w
    const y = height - (p / max) * (height - 4)
    return `${x},${y}`
  })
  const polyline = coords.join(' ')
  const areaPath = `M0,${height} ${coords.map((c) => `L${c}`).join(' ')} L${w},${height} Z`
  const gradId = `grad-${color.replace('#', '')}`

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

interface Props {
  data: MetricsTrendsResponse | null
  error?: Error | null
  onRetry?: () => void
}

export default function PersistentTrends({ data, error, onRetry }: Props) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  if (!isConnected && !data) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <ServerOff size={14} className="text-slate-600" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Trends</h3>
        </div>
        <p className="text-xs text-slate-600">Not connected</p>
      </div>
    )
  }

  if (isConnected && !data && error) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={14} className="text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Trends</h3>
        </div>
        <p className="text-xs text-slate-500 mb-2">Unable to load trend data</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <RefreshCw size={10} />
            Retry
          </button>
        )}
      </div>
    )
  }

  if (isConnected && !data) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Trends</h3>
        </div>
        <div className="h-12 rounded bg-slate-800/40 animate-pulse" />
      </div>
    )
  }

  const pts = data!.points
  const cpuPts = pts.map((p) => p.cpu_pct)
  const memPts = pts.map((p) => p.mem_pct)
  const diskPts = pts.map((p) => p.disk_pct)

  return (
    <div
      className="glass-card p-4 md:p-6 animate-fade-in cursor-pointer hover:border-white/[0.1] transition-colors"
      onClick={() => setCurrentPage('trends')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Trends</h3>
        </div>
        <span className="text-[10px] text-slate-500">{data!.range} — {pts.length} pts</span>
      </div>
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-slate-500">CPU</span>
            <span className="text-[10px] text-emerald-400 font-medium">{cpuPts.length > 0 ? `${cpuPts[cpuPts.length - 1].toFixed(0)}%` : '\u2014'}</span>
          </div>
          <MiniChart points={cpuPts} color="#10b981" height={32} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-slate-500">Memory</span>
            <span className="text-[10px] text-cyan-400 font-medium">{memPts.length > 0 ? `${memPts[memPts.length - 1].toFixed(0)}%` : '\u2014'}</span>
          </div>
          <MiniChart points={memPts} color="#06b6d4" height={32} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-slate-500">Disk</span>
            <span className="text-[10px] text-amber-400 font-medium">{diskPts.length > 0 ? `${diskPts[diskPts.length - 1].toFixed(0)}%` : '\u2014'}</span>
          </div>
          <MiniChart points={diskPts} color="#f59e0b" height={32} />
        </div>
      </div>
    </div>
  )
}
