// =============================================================================
// What the Discord tab says about itself: the status card (is it on, is it
// wired into CrowdSec, is the plugin loaded, who wrote the file, is it working,
// what the last change / test / delivery said), the honest progress while a
// change is applied, and the outcome of a test message.
// =============================================================================

import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, FileCheck2, Info, Loader2, MessageSquare, Radio, Send, ShieldCheck, TriangleAlert, Webhook } from 'lucide-react'
import type { CrowdSecNotifyResponse } from '../../../shared/types'
import { CARD, Chip, Dot, Switch, fmtAgo, fmtTime, useNow, type Tone } from './kit'
import { redact, sampleLabel } from './NotifyModel'
import { Notice } from './NotifyFields'

export interface TestOutcomeData { at: number; ok: boolean; http: number; message: string; sample: string }

const MODE_SHORT: Record<string, string> = { global: 'Global', custom: 'Custom', keep: 'Kept from file' }

/** the one sentence at the top: what the situation is, from what the server reports (not from the draft) */
export function healthOf(v: CrowdSecNotifyResponse): { tone: Tone; title: string; detail: string } {
  const st = v.state
  const problems = v.status.delivery_errors.length
  if (!st.enabled && !st.wired) return { tone: 'mute', title: 'Discord alerts are off', detail: 'CrowdSec detects and bans as usual. Nothing is sent to Discord.' }
  if (!st.enabled && st.wired) return { tone: 'warn', title: 'Off in the settings, but CrowdSec still sends alerts', detail: 'The profile in CrowdSec still points at the Discord plugin. Save and apply to write the profile again.' }
  if (!v.webhook.configured) return { tone: 'warn', title: 'Turned on, but there is no webhook to post to', detail: `The ${MODE_SHORT[v.webhook.mode]?.toLowerCase() ?? 'chosen'} webhook source has no address. Choose a webhook below.` }
  if (!st.wired) return { tone: 'warn', title: 'Turned on, but CrowdSec does not send alerts yet', detail: 'Save and apply writes the profile and the notification file, then restarts CrowdSec.' }
  if (!st.plugin_active) return { tone: 'warn', title: 'The Discord plugin is not active in CrowdSec', detail: 'CrowdSec did not load the notification. Save and apply again, or look at the CrowdSec log.' }
  if (problems > 0) return { tone: 'warn', title: 'Set up, but CrowdSec reported delivery problems', detail: `${problems} problem${problems === 1 ? '' : 's'} in the last 24 hours, listed below.` }
  return { tone: 'good', title: 'Discord alerts are working', detail: 'Alerts are wired into CrowdSec, the plugin is active and a webhook is set. Send a test message to see it arrive.' }
}

function Check({ label, value, tone, title }: { label: string; value: string; tone: Tone; title?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 sm:py-2 min-w-0" title={title}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">{label}</p>
      <p className="mt-0.5 sm:mt-1 flex items-center gap-1.5 text-[13px] sm:text-sm text-slate-200 min-w-0"><Dot tone={tone} /><span className="truncate">{value}</span></p>
    </div>
  )
}

function Outcome({ icon: Icon, tone, title, children }: { icon: React.ElementType; tone: Tone; title: string; children: React.ReactNode }) {
  const cls = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-rose-400' : tone === 'warn' ? 'text-amber-400' : 'text-slate-500'
  // a quiet line is just its title; a problem always says what it is
  const show = tone === 'bad' || tone === 'warn'
  return (
    <li className="flex items-start gap-2.5 py-1.5 first:pt-0 last:pb-0 min-w-0">
      <Icon size={15} className={`shrink-0 mt-0.5 ${cls}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200 leading-snug">{title}</p>
        {show && <div className="text-xs text-slate-500 mt-0.5 leading-relaxed break-words">{children}</div>}
      </div>
    </li>
  )
}

export function StatusCard({ data, isAdmin, enabled, onToggle, busy, refreshFailed, onOpenNotifications, lastTest }: {
  data: CrowdSecNotifyResponse
  isAdmin: boolean
  /** the switch shows the draft */
  enabled: boolean
  onToggle: (v: boolean) => void
  busy: boolean
  refreshFailed: boolean
  onOpenNotifications: () => void
  lastTest: TestOutcomeData | null
}) {
  const now = useNow()
  const st = data.state
  const wh = data.webhook
  const h = healthOf(data)
  const file = st.file === 'dcs' ? { v: 'Written by DCS', tone: 'good' as Tone, t: 'The notification file was written by this page' }
    : st.file === 'other' ? { v: 'Set up elsewhere', tone: 'warn' as Tone, t: 'The notification file was not written by this page: it is CrowdSec’s own sample, comes from a stack template or was edited by hand. Saving here replaces it (a copy is kept).' }
    : { v: 'Not created', tone: (st.enabled ? 'warn' : 'mute') as Tone, t: 'There is no notification file yet' }
  const t = lastTest
  const la = data.status.last_apply
  const errs = data.status.delivery_errors
  return (
    <section className={`${CARD} p-4`} aria-label="Status of the Discord alerts">
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl border border-white/5 flex items-center justify-center shrink-0 ${h.tone === 'good' ? 'bg-emerald-500/15 text-emerald-400' : h.tone === 'warn' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[0.05] text-slate-400'}`}><MessageSquare size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-100">{h.title}</h2>
            <Chip tone={h.tone}>{h.tone === 'good' ? 'working' : h.tone === 'warn' ? 'needs attention' : 'off'}</Chip>
            {refreshFailed && <Chip tone="warn" title="The last refresh failed. What you see is the last answer.">could not refresh</Chip>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{h.detail}</p>
          {isAdmin && !st.enabled && !st.wired && !data.status.last_apply && (
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">To start: choose where the messages go (Webhook), turn the switch below on, press Save and apply, then send a test message.</p>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3">
          <div className="pt-0.5"><Switch id="notify-enabled" checked={enabled} onChange={onToggle} label="Send CrowdSec's alerts to Discord" disabled={busy} /></div>
          <div className="min-w-0 flex-1">
            <label htmlFor="notify-enabled" className="block text-sm text-slate-100 cursor-pointer">Send CrowdSec’s alerts to Discord</label>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">When on, CrowdSec posts a message to your channel for each ban it makes.<span className="hidden sm:inline"> Applying a change restarts CrowdSec for a few seconds; bans stay in place.</span> Default: on for a new setup.</p>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        <Check label="Alerts" value={st.enabled ? 'On' : 'Off'} tone={st.enabled ? 'good' : 'mute'} title="Whether the saved settings send alerts" />
        <Check label="Webhook" value={wh.configured ? (MODE_SHORT[wh.mode] ?? 'Set') : 'Not set'} tone={wh.configured ? 'good' : st.enabled ? 'warn' : 'mute'} title={wh.configured ? undefined : 'No address for the chosen webhook source'} />
        <Check label="In the profile" value={st.wired ? 'Yes' : 'No'} tone={st.wired ? 'good' : st.enabled ? 'warn' : 'mute'} title="Whether CrowdSec’s profile hands alerts to the Discord plugin" />
        <Check label="Plugin" value={st.plugin_active ? 'Active' : 'Not active'} tone={st.plugin_active ? 'good' : st.enabled ? 'warn' : 'mute'} title="Whether CrowdSec loaded the http_default notification" />
        <Check label="Notification file" value={file.v} tone={file.tone} title={file.t} />
        <Check label="Delivering" value={st.working ? (errs.length > 0 ? 'With problems' : 'Yes') : 'Not yet'} tone={st.working ? (errs.length > 0 ? 'warn' : 'good') : 'mute'} title="On, wired, plugin active and a webhook set" />
      </div>
      {st.drift && (
        <div className="mt-3"><Notice tone="warn" icon={TriangleAlert} title="The notification file was changed by hand after DCS wrote it">Saving here writes it again from the settings on this page.</Notice></div>
      )}

      <ul className="mt-4 divide-y divide-white/5 border-t border-white/5 pt-3" aria-label="Recent outcomes">
        {la
          ? <Outcome icon={la.ok ? ShieldCheck : CircleAlert} tone={la.ok ? 'good' : 'bad'} title={la.ok ? `Last change applied ${fmtAgo(la.at, now)}` : `The last change failed ${fmtAgo(la.at, now)}`}>{redact(la.message)}</Outcome>
          : <Outcome icon={ShieldCheck} tone="mute" title="No change has been applied from this page yet">Settings you save here are written to CrowdSec, which restarts to load them.</Outcome>}
        {t
          ? <Outcome icon={t.ok ? Send : CircleAlert} tone={t.ok ? 'good' : 'bad'} title={t.ok ? `Last test message delivered ${fmtAgo(t.at, now)}` : `The last test message failed ${fmtAgo(t.at, now)}`}>
              {redact(t.message)} <span className="text-slate-600">· {sampleLabel(t.sample)}{t.http ? ` · HTTP ${t.http}` : ''}</span>
            </Outcome>
          : <Outcome icon={Send} tone="mute" title="No test message has been sent yet">{isAdmin ? 'Use “Send test message” next to the preview to see one arrive in your channel.' : 'An administrator can send a test message.'}</Outcome>}
        {errs.length > 0
          ? <Outcome icon={Radio} tone="warn" title={`${errs.length} delivery problem${errs.length === 1 ? '' : 's'} reported by CrowdSec in the last 24 hours`}>
              <ul className="space-y-1 mt-1">
                {errs.map((e) => (
                  <li key={`${e.time}-${e.message}`} className="min-w-0"><span className="text-slate-400 tabular-nums" title={fmtTime(e.time)}>{fmtAgo(e.time, now)}</span> <span className="font-mono text-[11px] text-amber-300 break-words">{redact(e.message)}</span></li>
                ))}
              </ul>
            </Outcome>
          : <Outcome icon={Radio} tone="mute" title="No delivery problems reported">{data.status.note}</Outcome>}
      </ul>

      <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
        <p className="text-[11px] text-slate-500 flex items-start gap-1.5"><Info size={12} className="shrink-0 mt-0.5" />{data.status.note}</p>
        <p className="text-[11px] text-slate-500 flex items-start gap-1.5"><Info size={12} className="shrink-0 mt-0.5" /><span>{data.info.unban} <button type="button" onClick={onOpenNotifications} className="text-cyan-400 hover:text-cyan-300 whitespace-nowrap">Open the Notifications page</button></span></p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// While a change is applied (10 to 40 seconds: CrowdSec is checked, written, restarted, watched)
// ---------------------------------------------------------------------------

const STEPS = [
  { until: 3, label: 'Checking the settings with CrowdSec', icon: FileCheck2 },
  { until: 7, label: 'Saving the files', icon: Webhook },
  { until: 30, label: 'Restarting CrowdSec', icon: Loader2 },
  { until: Infinity, label: 'Waiting until it is healthy again', icon: ShieldCheck },
]

/** the stages are a guess from the clock (the API answers once, at the end); it says so and never claims to be done before the answer */
export function ApplyProgress({ startedAt, what }: { startedAt: number; what: string }) {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSec(Math.floor((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(t)
  }, [startedAt])
  const cur = STEPS.findIndex((s) => sec < s.until)
  return (
    <div role="status" aria-live="polite" className="w-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-slate-100 flex items-center gap-2"><Loader2 size={14} className="animate-spin text-emerald-400" /> {what}</p>
        <span className="text-xs tabular-nums text-slate-400">{sec}s · usually 10 to 40 seconds</span>
      </div>
      <ol className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.label} className={`flex items-center gap-1.5 text-[11px] rounded-md px-2 py-1.5 border ${i < cur ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.06]' : i === cur ? 'text-slate-100 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-500 border-white/5 bg-white/[0.02]'}`}>
            {i < cur ? <CircleCheck size={12} className="shrink-0" /> : i === cur ? <Loader2 size={12} className="shrink-0 animate-spin" /> : <span className="h-3 w-3 rounded-full border border-slate-600 shrink-0" />}
            <span className="leading-tight">{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-slate-500 mt-2">{sec > 60 ? 'This is taking longer than usual. CrowdSec may be slow to come back: keep this page open, the answer will show here.' : 'Detection pauses for a moment while CrowdSec restarts; bans stay in place. The steps are an estimate from the clock. The real result replaces this box when CrowdSec answers.'}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The outcome of a test message
// ---------------------------------------------------------------------------

export function TestOutcome({ t, webhook }: { t: TestOutcomeData; webhook?: string }) {
  const now = useNow()
  return (
    <div role="status" className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2.5 ${t.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/[0.08] border-rose-500/25 text-rose-300'}`}>
      {t.ok ? <CircleCheck size={15} className="shrink-0 mt-0.5" /> : <CircleAlert size={15} className="shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1 leading-relaxed">
        <p className="text-sm font-medium leading-snug">{t.ok ? 'Delivered' : 'Not delivered'} <span className="font-normal opacity-80">· {fmtAgo(t.at, now)}</span></p>
        <p className="mt-0.5 break-words">{redact(t.message)}</p>
        <p className="mt-1 text-[11px] opacity-75 break-all">{sampleLabel(t.sample)}{t.http ? ` · HTTP ${t.http}` : ' · no answer'}{webhook ? ` · ${webhook}` : ''}</p>
      </div>
    </div>
  )
}
