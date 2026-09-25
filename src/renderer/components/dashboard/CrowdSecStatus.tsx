// =============================================================================
// CrowdSecStatus — dashboard card: is the intrusion prevention running, is the
// current visitor banned, which addresses are trusted, and one-click fixes.
// =============================================================================

import { useState } from 'react'
import { ShieldCheck, ShieldOff, ShieldAlert, RefreshCw, Loader2, Unlock, UserCheck, AlertCircle } from 'lucide-react'
import { useConnectionStore } from '../../stores/connectionStore'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useToast } from '../common/Toast'
import { crowdsecUnbanMe, crowdsecTrust, crowdsecUnban } from '../../api/endpoints'
import type { CrowdSecStatusResponse } from '../../../shared/types'

interface Props {
  data: CrowdSecStatusResponse | null
  error?: Error | null
  onRetry?: () => void
}

export default function CrowdSecStatus({ data, error, onRetry }: Props) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const setCurrentPage = useSettingsStore.getState().setCurrentPage
  const { addToast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<{ message?: string }>, done: string) => {
    setBusy(key)
    try {
      const res = await fn()
      addToast({ type: 'success', message: res.message || done })
      onRetry?.()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Request failed' })
    } finally {
      setBusy(null)
    }
  }

  const title = <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Protection</h3>

  if (!isConnected && !data) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in opacity-60">
        <div className="flex items-center gap-2 mb-3"><ShieldOff size={14} className="text-slate-500" />{title}</div>
        <p className="text-xs text-slate-500">Not connected</p>
      </div>
    )
  }
  if (!data && error) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3"><AlertCircle size={14} className="text-amber-400" />{title}</div>
        <p className="text-xs text-slate-500 mb-2">Unable to load CrowdSec status</p>
        {onRetry && <button onClick={onRetry} className="flex items-center gap-1.5 text-[10px] text-cyan-400 hover:text-cyan-300"><RefreshCw size={10} /> Retry</button>}
      </div>
    )
  }
  if (!data) {
    return <div className="glass-card p-4 md:p-6 h-full skeleton" />
  }
  if (!data.installed) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3"><ShieldOff size={14} className="text-slate-500" />{title}</div>
        <p className="text-xs text-slate-500 flex-1">CrowdSec is not running. Deploy the <span className="text-slate-300">crowdsec</span> template to block scanners and brute-force attempts at the reverse proxy.</p>
        <button onClick={() => setCurrentPage('templates')} className="mt-3 self-start text-[11px] text-cyan-400 hover:text-cyan-300">Open templates →</button>
      </div>
    )
  }

  const decisions = data.decisions ?? []
  const banned = data.client_banned
  const trusted = data.trusted ?? []
  const whitelist = data.whitelist?.addresses ?? []

  return (
    <div className="glass-card p-4 md:p-6 animate-fade-in h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {banned ? <ShieldAlert size={14} className="text-rose-400" /> : <ShieldCheck size={14} className="text-emerald-400" />}
          {title}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${decisions.length ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
          {decisions.length} active ban{decisions.length === 1 ? '' : 's'}
        </span>
      </div>

      {banned && (
        <div className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          Your address <span className="font-mono">{data.client_ip}</span> is currently banned.
        </div>
      )}

      <div className="text-[11px] text-slate-500 space-y-1 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <p>
          Whitelist follows the home address{data.whitelist?.public_ip ? <> (<span className="font-mono text-slate-300">{data.whitelist.public_ip}</span>)</> : null}
          {data.whitelist?.synced_at ? <> · synced {new Date(data.whitelist.synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</> : null}
        </p>
        {whitelist.length > 0 && (
          <p className="truncate">Trusted: <span className="font-mono text-slate-300">{whitelist.join(', ')}</span></p>
        )}
        {decisions.slice(0, 5).map((d) => (
          <div key={`${d.ip}-${d.scenario}`} className="flex items-center justify-between gap-2">
            <span className="truncate"><span className="font-mono text-slate-300">{d.ip}</span> <span className="text-slate-600">{d.scenario?.replace('crowdsecurity/', '')}</span></span>
            {isAdmin && (
              <button
                onClick={() => run(`unban-${d.ip}`, () => crowdsecUnban(d.ip), `Unbanned ${d.ip}`)}
                disabled={busy !== null}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 shrink-0 disabled:opacity-50"
              >
                {busy === `unban-${d.ip}` ? <Loader2 size={10} className="animate-spin" /> : 'unban'}
              </button>
            )}
          </div>
        ))}
        {decisions.length > 5 && <p className="text-slate-600">+{decisions.length - 5} more</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => run('me', () => crowdsecUnbanMe(), 'Your addresses were unbanned')}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
          title="Remove any ban on your current address and the home public address"
        >
          {busy === 'me' ? <Loader2 size={11} className="animate-spin" /> : <Unlock size={11} />} Unban me
        </button>
        {isAdmin && (
          <button
            onClick={() => run('trust', () => crowdsecTrust(), 'Address added to the whitelist')}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            title="Whitelist the home public address and your current address so they can never be banned"
          >
            {busy === 'trust' ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />} Trust my address
          </button>
        )}
        <span className="ml-auto text-[10px] text-slate-600">{trusted.length} trusted</span>
      </div>
    </div>
  )
}
