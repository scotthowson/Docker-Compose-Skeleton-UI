import { useState } from 'react'
import { FileText, ServerOff, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { LogStatsResponse } from '../../../shared/types'

interface Props {
  data: LogStatsResponse | null
  error?: Error | null
  onRetry?: () => void
  collapsible?: boolean
}

export default function LogHealthSummary({ data, error, onRetry, collapsible = false }: Props) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false
    try { return localStorage.getItem('dash-loghealth-collapsed') === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('dash-loghealth-collapsed', String(next)) } catch {}
  }

  if (!isConnected && !data) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <ServerOff size={14} className="text-slate-600" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Log Health</h3>
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
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Log Health</h3>
        </div>
        <p className="text-xs text-slate-500 mb-2">Unable to load log statistics</p>
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
          <FileText size={14} className="text-violet-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Log Health</h3>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 w-16 rounded-full bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const { levels, total_lines, file_size } = data!
  const hasCritical = levels.critical > 0

  return (
    <div
      className={`glass-card p-4 md:p-6 animate-fade-in cursor-pointer hover:border-white/[0.1] transition-colors ${hasCritical ? 'border-rose-500/30' : ''}`}
      onClick={collapsible ? undefined : () => setCurrentPage('logs')}
    >
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer select-none' : ''} ${collapsed ? '' : 'mb-3'}`}
        onClick={collapsible ? toggleCollapsed : undefined}
      >
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-violet-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Log Health</h3>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && <span className="text-[10px] text-slate-500">{file_size}</span>}
          {collapsible && (
            <ChevronDown
              size={16}
              className={`text-slate-500 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
            />
          )}
        </div>
      </div>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${collapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}
      >
        <div className="flex flex-wrap gap-1.5 mb-3" onClick={() => setCurrentPage('logs')}>
          {levels.critical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-[10px] font-semibold text-rose-400">
              {levels.critical} critical
            </span>
          )}
          {levels.error > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[10px] font-semibold text-rose-400">
              {levels.error} errors
            </span>
          )}
          {levels.warning > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
              {levels.warning} warnings
            </span>
          )}
          {levels.critical === 0 && levels.error === 0 && levels.warning === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
              Clean
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-500">{total_lines.toLocaleString()} total lines</p>
      </div>
    </div>
  )
}
