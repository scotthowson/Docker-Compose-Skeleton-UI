import { Layers, ServerOff, AlertCircle, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { StackInfo } from '../../../shared/types'

interface Props {
  stacks: StackInfo[] | null
  error?: Error | null
  onRetry?: () => void
}

export default function StackStatusGrid({ stacks, error, onRetry }: Props) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  if (!isConnected && !stacks) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <ServerOff size={14} className="text-slate-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Stacks</h3>
        </div>
        <p className="text-xs text-slate-500">Not connected</p>
      </div>
    )
  }

  if (isConnected && !stacks && error) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={14} className="text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Stacks</h3>
        </div>
        <p className="text-xs text-slate-500 mb-2">Unable to load stack data</p>
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

  if (isConnected && !stacks) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <Layers size={14} className="text-violet-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Stacks</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const list = stacks ?? []

  return (
    <div
      className="glass-card p-4 md:p-6 animate-fade-in cursor-pointer hover:border-white/10 transition-colors"
      onClick={() => setCurrentPage('stacks')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-violet-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Stacks</h3>
        </div>
        <span className="text-xs text-slate-500">{list.length} total</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
        {list.map((s) => (
          <div
            key={s.name}
            className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'running' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className="text-xs font-medium text-slate-200 truncate">{s.name}</span>
            </div>
            <p className="text-[10px] text-slate-500">
              {s.running_containers} running
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
