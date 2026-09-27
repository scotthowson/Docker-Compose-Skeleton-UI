// =============================================================================
// Settings panels for the integrations that talk to other machines:
//   ProxmoxTestPanel  — "Test connection" for the Proxmox card (no save needed)
//   TraefikFeedPanel  — status of the feed a Traefik elsewhere pulls, with the
//                       token, the snippet to paste, and a rotate button
// =============================================================================

import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, PlugZap, RefreshCw, Copy, Check, Radio } from 'lucide-react'
import { usePolling } from '../../hooks/usePolling'
import { useConnectionStore } from '../../stores/connectionStore'
import { proxmoxTest, fetchTraefikFeedStatus, rotateTraefikFeedToken } from '../../api/endpoints'
import type { ProxmoxStatus } from '../../../shared/types'

function CopyChip({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) }).catch(() => {}) }}
      className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:bg-white/10 flex items-center gap-1.5">
      {done ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />} {done ? 'Copied' : label}
    </button>
  )
}

export function ProxmoxTestPanel({ url, tokenId, tokenSecret, verifyTls, secretSource = '', onOpenSecrets }: { url: string; tokenId: string; tokenSecret: string; verifyTls: boolean; secretSource?: string; onOpenSecrets?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<ProxmoxStatus | null>(null)
  const [err, setErr] = useState('')
  const run = async () => {
    setBusy(true); setErr(''); setRes(null)
    try {
      setRes(await proxmoxTest({ url: url || undefined, token_id: tokenId || undefined, token_secret: tokenSecret || undefined, verify_tls: verifyTls }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The test failed')
    } finally { setBusy(false) }
  }
  return (
    <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-slate-400">
          Tests the values above without saving them (a secret you typed is used; an empty one means the saved secret).
          {secretSource === 'secret' && onOpenSecrets && <> The saved secret lives in the secret store — <button type="button" onClick={onOpenSecrets} className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">manage it on the Secrets page</button>.</>}
          {secretSource === 'env' && <span className="text-amber-300/90"> The saved secret sits in .env; save it once more to move it to the secret store.</span>}
        </div>
        <button onClick={run} disabled={busy} className="h-9 px-3 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/25 text-xs font-medium hover:bg-amber-500/25 disabled:opacity-50 flex items-center gap-1.5">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />} Test connection
        </button>
      </div>
      {err && <div className="mt-2 text-xs text-rose-300 flex items-center gap-1.5"><XCircle size={13} /> {err}</div>}
      {res && (
        <div className={`mt-2 text-xs flex items-start gap-1.5 ${res.reachable ? 'text-emerald-300' : 'text-rose-300'}`}>
          {res.reachable ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <XCircle size={13} className="mt-0.5 shrink-0" />}
          <span>{res.reachable ? `Connected: Proxmox VE ${res.version}, ${res.nodes} node${res.nodes === 1 ? '' : 's'}, ${res.vms.total} guests (${res.vms.running} running)` : (res.error || res.hints?.[0] || 'Not reachable')}</span>
        </div>
      )}
    </div>
  )
}

function ago(epoch: number): string {
  if (!epoch) return 'never'
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epoch))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function TraefikFeedPanel({ enabled }: { enabled: boolean }) {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const feed = usePolling(fetchTraefikFeedStatus, 15000, { enabled: isConnected })
  const [rotating, setRotating] = useState(false)
  const f = feed.data
  const rotate = async () => {
    if (!window.confirm('Mint a new feed token? The Traefik that pulls the feed keeps failing until you paste the new one.')) return
    setRotating(true)
    try { await rotateTraefikFeedToken(); feed.refresh() } finally { setRotating(false) }
  }
  if (!f) return null
  const fresh = f.last_poll > 0 && Date.now() / 1000 - f.last_poll < 60
  return (
    <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <Radio size={13} className={enabled && f.ready ? (fresh ? 'text-emerald-400' : 'text-amber-400') : 'text-slate-500'} />
          <span className="text-slate-300">
            {!enabled ? 'Feed is off — save with the toggle on to mint a token.' : !f.ready ? 'Feed is on but has no token yet — save once more.' : fresh ? `Pulled ${ago(f.last_poll)} by ${f.last_client}` : f.last_poll ? `Last pulled ${ago(f.last_poll)} by ${f.last_client}` : 'Never pulled yet — paste the snippet into the other Traefik'}
          </span>
        </div>
        <div className="text-[11px] text-slate-500">{f.routes} route{f.routes === 1 ? '' : 's'} served{f.skipped.length ? ` · ${f.skipped.length} skipped` : ''}{f.local_traefik ? ' · local Traefik too' : ' · no local Traefik'}</div>
      </div>
      {enabled && f.ready && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[11px] font-mono text-slate-300 bg-black/30 rounded-lg px-2 py-1 break-all">{f.token}</code>
            <CopyChip text={f.token} label="Copy token" />
            <button onClick={rotate} disabled={rotating} className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:bg-white/10 flex items-center gap-1.5 disabled:opacity-50">
              <RefreshCw size={12} className={rotating ? 'animate-spin' : ''} /> Rotate
            </button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-400">Paste into that Traefik's static config (traefik.yml), then restart it:</span>
              <CopyChip text={f.snippet} label="Copy snippet" />
            </div>
            <pre className="text-[11px] font-mono text-slate-300 bg-black/30 rounded-lg p-2.5 overflow-x-auto whitespace-pre">{f.snippet}</pre>
            <div className="text-[11px] text-slate-500 mt-1">Through the dashboard instead of the API port: <code className="font-mono">https://&lt;dashboard&gt;/api/traefik/dynamic?token=…</code>. Traefik v3 can send the token as a header instead: <code className="font-mono">headers: {'{'} Authorization: "Bearer …" {'}'}</code>.</div>
          </div>
          {f.skipped.length > 0 && (
            <div className="text-[11px] text-amber-300/90">
              Not offered: {f.skipped.map((s) => `${s.service} (${s.reason})`).join('; ')}
            </div>
          )}
        </>
      )}
    </div>
  )
}
