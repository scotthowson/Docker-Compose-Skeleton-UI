import { useState } from 'react'
import { Bell, ServerOff, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { NotificationHistoryResponse } from '../../../shared/types'

interface Props {
  data: NotificationHistoryResponse | null
  error?: Error | null
  onRetry?: () => void
  collapsible?: boolean
}

export default function NotificationStatus({ data, error, onRetry, collapsible = false }: Props) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false
    try { return localStorage.getItem('dash-notifications-collapsed') === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('dash-notifications-collapsed', String(next)) } catch {}
  }

  if (!isConnected && !data) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in opacity-60">
        <div className="flex items-center gap-2 mb-3">
          <ServerOff size={14} className="text-slate-600" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Notifications</h3>
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
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Notifications</h3>
        </div>
        <p className="text-xs text-slate-500 mb-2">Unable to load notification data</p>
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
          <Bell size={14} className="text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Notifications</h3>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const history = data!.history
  const recent = history.slice(0, 3)

  const now = Date.now()
  const dayAgo = now - 24 * 60 * 60 * 1000
  const recentCount = history.filter((h) => {
    const ts = new Date(h.timestamp).getTime()
    return ts > dayAgo
  }).length

  return (
    <div
      className="glass-card p-4 md:p-6 animate-fade-in cursor-pointer hover:border-white/[0.1] transition-colors"
      onClick={collapsible ? undefined : () => setCurrentPage('notifications')}
    >
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer select-none' : ''} ${collapsed ? '' : 'mb-3'}`}
        onClick={collapsible ? toggleCollapsed : undefined}
      >
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Notifications</h3>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && <span className="text-[10px] text-slate-500">{recentCount} in 24h</span>}
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
        <div onClick={() => setCurrentPage('notifications')}>
          {recent.length === 0 ? (
            <p className="text-xs text-slate-500">No notifications sent</p>
          ) : (
            <div className="space-y-1.5">
              {recent.map((h, i) => {
                const ok = h.status_code >= 200 && h.status_code < 300
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/[0.04] px-2.5 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                        h.type === 'error' ? 'bg-rose-500/10 text-rose-400'
                        : h.type === 'warning' ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {h.type}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">{h.title}</span>
                    </div>
                    <span className={`shrink-0 w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
