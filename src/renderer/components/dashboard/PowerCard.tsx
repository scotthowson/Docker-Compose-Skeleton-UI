// =============================================================================
// PowerCard — the UPS at a glance: mains or battery, charge, runtime, load,
// and what DCS will do when the battery runs low
// =============================================================================

import { BatteryCharging, BatteryWarning, BatteryLow, Zap, RefreshCw, Settings2, AlertCircle } from 'lucide-react'
import { usePolling } from '../../hooks/usePolling'
import { useConnectionStore } from '../../stores/connectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { fetchPower } from '../../api/endpoints'
import type { CardCommonProps } from './cardShared'

function fmtRuntime(s: number | null | undefined): string {
  if (s === null || s === undefined) return '—'
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`
  return `${Math.round(s / 60)} min`
}

export default function PowerCard(_props: CardCommonProps) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore.getState().setCurrentPage
  const { data, error, refetch } = usePolling(fetchPower, 15000, { enabled: isConnected })
  const title = <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Power</h3>

  if (!data && error) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3"><AlertCircle size={14} className="text-amber-400" />{title}</div>
        <p className="text-xs text-slate-500 mb-2">Unable to read the power status</p>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-[10px] text-cyan-400 hover:text-cyan-300"><RefreshCw size={10} /> Retry</button>
      </div>
    )
  }
  if (!data) return <div className="glass-card p-4 md:p-6 h-full skeleton" />

  if (!data.enabled) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3"><Zap size={14} className="text-slate-500" />{title}</div>
        <p className="text-xs text-slate-500 flex-1">No UPS is watched. Point DCS at a NUT server (the <span className="text-slate-300">nut-upsd</span> template serves a USB unit) or apcupsd, and it will alert you and stop the stacks cleanly before the battery runs out.</p>
        <button onClick={() => setCurrentPage('config')} className="mt-3 self-start flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300"><Settings2 size={11} /> Set it up in Server Config →</button>
      </div>
    )
  }

  if (!data.ok) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3"><AlertCircle size={14} className="text-amber-400" />{title}</div>
        <p className="text-xs text-amber-300/90 flex-1">{data.error || 'The UPS did not answer'}</p>
        {!data.loop_running && <p className="text-[10px] text-slate-500 mt-2">The watch loop is not running: restart the API from the Updates page after changing the power settings.</p>}
      </div>
    )
  }

  const charge = data.charge ?? null
  const onBatt = !!data.on_battery
  const low = !!data.low_battery
  const tone = low ? 'rose' : onBatt ? 'amber' : 'emerald'
  const Icon = low ? BatteryLow : onBatt ? BatteryWarning : BatteryCharging
  const label = low ? 'Battery low' : onBatt ? 'On battery' : 'On mains'
  const ring: Record<string, string> = { rose: 'text-rose-400 bg-rose-500/15', amber: 'text-amber-400 bg-amber-500/15', emerald: 'text-emerald-400 bg-emerald-500/15' }
  const bar: Record<string, string> = { rose: 'bg-rose-500', amber: 'bg-amber-400', emerald: 'bg-emerald-400' }

  return (
    <div className="glass-card p-4 md:p-6 animate-fade-in h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={ring[tone].split(' ')[0]} />
        {title}
        <span className={`ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${ring[tone]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${bar[tone]} ${onBatt ? 'animate-pulse' : ''}`} />
          {label}
        </span>
      </div>
      <div className="flex items-end gap-3 mb-2">
        <span className={`text-3xl font-bold tabular-nums ${ring[tone].split(' ')[0]}`}>{charge === null ? '—' : `${charge}%`}</span>
        <span className="text-[11px] text-slate-500 mb-1.5">{fmtRuntime(data.runtime_seconds)} left{data.load !== null && data.load !== undefined ? ` · load ${data.load}%` : ''}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all duration-700 ${bar[tone]}`} style={{ width: `${Math.max(0, Math.min(100, charge ?? 0))}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-500 flex-1">
        <span>Source</span><span className="text-slate-300 text-right font-mono">{data.source}{data.ups ? ` · ${data.ups}` : ''}</span>
        {data.model && (<><span>Model</span><span className="text-slate-300 text-right truncate">{data.model}</span></>)}
        {data.input_voltage !== null && data.input_voltage !== undefined && (<><span>Input</span><span className="text-slate-300 text-right tabular-nums">{data.input_voltage} V</span></>)}
        {data.status && (<><span>Status</span><span className="text-slate-300 text-right font-mono">{data.status}</span></>)}
      </div>
      {data.stacks_stopped && <p className="mt-2 text-[10px] text-amber-300">The stacks were stopped for the battery. Start them from the Stacks page once mains is back.</p>}
      {data.last_event && !data.stacks_stopped && <p className="mt-2 text-[10px] text-slate-500 truncate" title={data.last_event}>{data.last_event}</p>}
      {(data.stale || !data.loop_running) && <p className="mt-2 text-[10px] text-amber-400/80">{!data.loop_running ? 'Watch loop not running — restart the API from the Updates page.' : 'Reading is stale.'}</p>}
    </div>
  )
}
