// =============================================================================
// PowerCard — the UPS at a glance: mains or battery, charge, runtime, load,
// and what DCS will do when the battery runs low
// =============================================================================

import { BatteryCharging, BatteryWarning, BatteryLow } from 'lucide-react'
import { Badge } from '@mantine/core'
import { usePolling } from '../../hooks/usePolling'
import { useConnectionStore } from '../../stores/connectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { pageLabel } from '../../constants/pageTitles'
import { fetchPower } from '../../api/endpoints'
import { BTN_CARD, TONE_OK } from '../../lib/ui'
import { Card, CardBody, CardEmpty, CardError, CardLoading, TONE_FILL, TONE_TEXT, type CardCommonProps, type Tone } from './cardShared'

function fmtRuntime(s: number | null | undefined): string {
  if (s === null || s === undefined) return '—'
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`
  return `${Math.round(s / 60)} min`
}

export default function PowerCard(_props: CardCommonProps) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const { data, error, refresh } = usePolling(fetchPower, 15000, { enabled: isConnected })

  if (!data && error) return <Card card="power" tone="attention"><CardError title="Could not read the power status" error={error} onRetry={refresh} /></Card>
  if (!data) return <Card card="power"><CardLoading label="Reading the power status…" rows={3} /></Card>

  if (!data.enabled) {
    return (
      <Card card="power">
        <CardEmpty
          icon={<BatteryCharging size={22} />}
          title="No UPS is watched"
          hint="Point DCS at a NUT server (the nut-upsd template serves a USB unit) or apcupsd, and it will alert you and stop the stacks cleanly before the battery runs out."
          action={<button type="button" onClick={() => setCurrentPage('config')} className={`${BTN_CARD} ${TONE_OK}`}>Set it up in {pageLabel('config')}</button>}
        />
      </Card>
    )
  }

  if (!data.ok) {
    return (
      <Card card="power" tone="attention">
        <CardEmpty
          icon={<BatteryWarning size={22} className="text-amber-400" />}
          title={data.error || 'The UPS did not answer'}
          hint={!data.loop_running ? `The watch loop is not running: restart the API from the ${pageLabel('updates')} page after changing the power settings.` : undefined}
        />
      </Card>
    )
  }

  const charge = data.charge ?? null
  const onBatt = !!data.on_battery
  const low = !!data.low_battery
  const tone: Tone = low ? 'problem' : onBatt ? 'attention' : 'ok'
  const Icon = low ? BatteryLow : onBatt ? BatteryWarning : BatteryCharging
  const label = low ? 'Battery low' : onBatt ? 'On battery' : 'On mains'
  const color = low ? 'rose' : onBatt ? 'amber' : 'emerald'

  return (
    <Card
      card="power"
      icon={Icon}
      tone={low ? 'problem' : onBatt ? 'attention' : undefined}
      badge={<Badge component="span" color={color} leftSection={<span className={`w-1.5 h-1.5 rounded-full ${TONE_FILL[tone]} ${onBatt ? 'animate-pulse' : ''}`} />}>{label}</Badge>}
    >
      <CardBody>
        <div className="flex items-end gap-3 mb-2">
          <span className={`text-3xl font-bold tabular-nums ${TONE_TEXT[tone]}`}>{charge === null ? '—' : `${charge}%`}</span>
          <span className="text-[11px] text-slate-500 mb-1.5">{fmtRuntime(data.runtime_seconds)} left{data.load !== null && data.load !== undefined ? ` · load ${data.load}%` : ''}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-3" role="meter" aria-label="Battery charge" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, charge ?? 0))}>
          <div className={`h-full rounded-full transition-all duration-700 ${TONE_FILL[tone]}`} style={{ width: `${Math.max(0, Math.min(100, charge ?? 0))}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>Source</span><span className="text-slate-300 text-right font-mono">{data.source}{data.ups ? ` · ${data.ups}` : ''}</span>
          {data.model && (<><span>Model</span><span className="text-slate-300 text-right truncate">{data.model}</span></>)}
          {data.input_voltage !== null && data.input_voltage !== undefined && (<><span>Input</span><span className="text-slate-300 text-right tabular-nums">{data.input_voltage} V</span></>)}
          {data.status && (<><span>Status</span><span className="text-slate-300 text-right font-mono">{data.status}</span></>)}
        </div>
        {data.stacks_stopped && <p className="mt-2 text-[11px] text-amber-300">The stacks were stopped for the battery. Start them from the {pageLabel('stacks')} page once mains is back.</p>}
        {data.last_event && !data.stacks_stopped && <p className="mt-2 text-[11px] text-slate-500 truncate" title={data.last_event}>{data.last_event}</p>}
        {(data.stale || !data.loop_running) && <p className="mt-2 text-[11px] text-amber-400">{!data.loop_running ? `Watch loop not running — restart the API from the ${pageLabel('updates')} page.` : 'Reading is stale.'}</p>}
      </CardBody>
    </Card>
  )
}
