import { useState } from 'react'
import { Wrench, ServerOff, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { MaintenanceReport } from '../../../shared/types'

interface Props {
  data: MaintenanceReport | null
  error?: Error | null
  onRetry?: () => void
  collapsible?: boolean
}

export default function MaintenanceSummary({ data, error, onRetry, collapsible = false }: Props) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false
    try { return localStorage.getItem('dash-maintenance-collapsed') === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('dash-maintenance-collapsed', String(next)) } catch {}
  }

  if (!isConnected && !data) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <ServerOff size={14} className="text-slate-600" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Maintenance</h3>
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
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Maintenance</h3>
        </div>
        <p className="text-xs text-slate-500 mb-2">Unable to load maintenance data</p>
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
          <Wrench size={14} className="text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Maintenance</h3>
        </div>
        <div className="space-y-2">
          <div className="h-5 w-24 rounded bg-slate-800/40 animate-pulse" />
          <div className="h-4 w-40 rounded bg-slate-800/40 animate-pulse" />
        </div>
      </div>
    )
  }

  const { images, volumes } = data!
  const hasDangling = images.dangling > 0 || volumes.dangling > 0

  return (
    <div
      className={`glass-card p-4 md:p-6 animate-fade-in cursor-pointer hover:border-white/[0.1] transition-colors ${hasDangling ? 'border-amber-500/30' : ''}`}
      onClick={collapsible ? undefined : () => setCurrentPage('maintenance')}
    >
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer select-none' : ''} ${collapsed ? '' : 'mb-3'}`}
        onClick={collapsible ? toggleCollapsed : undefined}
      >
        <div className="flex items-center gap-2">
          <Wrench size={14} className="text-amber-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Maintenance</h3>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && hasDangling && (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
              Cleanup available
            </span>
          )}
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
        <div className="grid grid-cols-2 gap-2" onClick={() => setCurrentPage('maintenance')}>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Dangling Images</p>
            <p className={`text-lg font-bold ${images.dangling > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {images.dangling}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Dangling Volumes</p>
            <p className={`text-lg font-bold ${volumes.dangling > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {volumes.dangling}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          {images.total} images, {volumes.total} volumes total
        </p>
      </div>
    </div>
  )
}
