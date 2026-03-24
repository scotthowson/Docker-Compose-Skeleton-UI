import { useState } from 'react'
import { Zap, ServerOff, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { AutomationListResponse } from '../../../shared/types'

interface Props {
  data: AutomationListResponse | null
  error?: Error | null
  onRetry?: () => void
  collapsible?: boolean
}

export default function ActiveAutomations({ data, error, onRetry, collapsible = false }: Props) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false
    try { return localStorage.getItem('dash-automations-collapsed') === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('dash-automations-collapsed', String(next)) } catch {}
  }

  if (!isConnected && !data) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <ServerOff size={14} className="text-slate-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Automations</h3>
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
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Automations</h3>
        </div>
        <p className="text-xs text-slate-500 mb-2">Unable to load automation data</p>
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
          <Zap size={14} className="text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Automations</h3>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const automations = data!.automations
  const enabled = automations.filter((a) => a.enabled).length
  const recent = automations.slice(0, 3)

  return (
    <div
      className="glass-card p-4 md:p-6 animate-fade-in cursor-pointer hover:border-white/10 transition-colors"
      onClick={collapsible ? undefined : () => setCurrentPage('automations')}
    >
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer select-none' : ''} ${collapsed ? '' : 'mb-3'}`}
        onClick={collapsible ? toggleCollapsed : undefined}
      >
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Automations</h3>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && <span className="text-[10px] text-slate-500">{enabled}/{automations.length} enabled</span>}
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
        <div onClick={() => setCurrentPage('automations')}>
          {recent.length === 0 ? (
            <p className="text-xs text-slate-500">No automations configured</p>
          ) : (
            <div className="space-y-1.5">
              {recent.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/[0.03] px-2.5 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    <span className="text-[11px] text-slate-300 truncate">{a.name}</span>
                  </div>
                  <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase shrink-0 ${
                    a.trigger_type === 'schedule' ? 'bg-violet-500/10 text-violet-400' : 'bg-cyan-500/10 text-cyan-400'
                  }`}>
                    {a.trigger_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
