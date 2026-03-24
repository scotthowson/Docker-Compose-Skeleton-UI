import { RefreshCw, ServerOff, AlertCircle } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { ImageCheckResponse } from '../../../shared/types'

interface Props {
  data: ImageCheckResponse | null
  error?: Error | null
  onRetry?: () => void
}

export default function ImageUpdateAlert({ data, error, onRetry }: Props) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  if (!isConnected && !data) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <ServerOff size={14} className="text-slate-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Image Updates</h3>
        </div>
        <p className="text-xs text-slate-500">Not connected</p>
      </div>
    )
  }

  if (isConnected && !data && error) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={14} className="text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Image Updates</h3>
        </div>
        <p className="text-xs text-slate-500 mb-2">Unable to check image updates</p>
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
          <RefreshCw size={14} className="text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Image Updates</h3>
        </div>
        <div className="space-y-2">
          <div className="h-3 rounded-full bg-slate-800/60 animate-pulse" />
          <div className="h-4 w-32 rounded bg-slate-800/40 animate-pulse" />
        </div>
      </div>
    )
  }

  const { current, aging, stale, total } = data!
  const hasStale = stale > 0

  return (
    <div
      className={`glass-card p-4 md:p-6 animate-fade-in cursor-pointer hover:border-white/10 transition-colors ${hasStale ? 'border-amber-500/30' : ''}`}
      onClick={() => setCurrentPage('updates')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Image Updates</h3>
        </div>
        <span className="text-xs text-slate-500">{total} images</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800/60 mb-3">
        {total > 0 && current > 0 && (
          <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${(current / total) * 100}%` }} title={`${current} current`} />
        )}
        {total > 0 && aging > 0 && (
          <div className="bg-amber-500 transition-all duration-700" style={{ width: `${(aging / total) * 100}%` }} title={`${aging} aging`} />
        )}
        {total > 0 && stale > 0 && (
          <div className="bg-rose-500 transition-all duration-700" style={{ width: `${(stale / total) * 100}%` }} title={`${stale} stale`} />
        )}
      </div>
      <div className="flex items-center gap-4 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-slate-400">Current ({current})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-slate-400">Aging ({aging})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
          <span className="text-slate-400">Stale ({stale})</span>
        </span>
      </div>
    </div>
  )
}
