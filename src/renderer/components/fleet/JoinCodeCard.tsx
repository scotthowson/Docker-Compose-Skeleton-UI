// =============================================================================
// JoinCodeCard — mints and shows a join code with the two commands a Docker VM
// runs to become a member of this hub. Used by the wizard and the Proxmox page.
// =============================================================================

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { createFleetJoinToken, fetchFleetJoinTokens, revokeFleetJoinToken } from '../../api/endpoints'
import type { FleetJoinToken } from '../../../shared/types'
import { CopyChip } from './fleetShared'

const CLONE = 'git clone https://github.com/scotthowson/Docker-Compose-Skeleton-AIO.git ~/.Docker-Compose-Skeleton-AIO && cd ~/.Docker-Compose-Skeleton-AIO'

export default function JoinCodeCard({ compact = false, autoMint = true }: { compact?: boolean; autoMint?: boolean }) {
  const [hubUrl, setHubUrl] = useState('')
  const [tokens, setTokens] = useState<FleetJoinToken[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const load = async () => {
    try {
      const r = await fetchFleetJoinTokens()
      setHubUrl(r.hub_url); setTokens(r.tokens)
      return r.tokens
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not read the join codes'); return [] }
  }
  const mint = async () => {
    setBusy(true); setErr('')
    try { await createFleetJoinToken(24); await load() } catch (e) { setErr(e instanceof Error ? e.message : 'Could not mint a join code') } finally { setBusy(false) }
  }
  useEffect(() => {
    void (async () => { const t = await load(); if (autoMint && t.length === 0) await mint() })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const latest = tokens[tokens.length - 1]
  const cmd = latest ? `DCS_HUB_URL=${hubUrl} DCS_JOIN_TOKEN=${latest.token} ./setup.sh` : ''
  const joinCmd = latest ? `./setup.sh --join ${hubUrl} ${latest.token}` : ''
  return (
    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-200"><KeyRound size={13} /> Join code for the other VMs</div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={mint} disabled={busy} className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:bg-white/10 flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} New code
          </button>
        </div>
      </div>
      {err && <p className="text-[11px] text-rose-300">{err}</p>}
      {latest ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-mono tracking-wider text-slate-100 bg-black/30 rounded-lg px-2.5 py-1">{latest.token}</code>
            <CopyChip text={latest.token} label="Copy" />
            <span className="text-[11px] text-slate-500">valid until {new Date(latest.expires_at * 1000).toLocaleString()}{latest.uses ? ` · used ${latest.uses}×` : ''}</span>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-400">On a fresh Docker VM (installs DCS and joins this hub):</p>
            <div className="flex items-start gap-2">
              <pre className="flex-1 min-w-0 text-[11px] font-mono text-slate-300 bg-black/30 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">{CLONE}{'\n'}{cmd}</pre>
              <CopyChip text={`${CLONE} && ${cmd}`} label="Copy" />
            </div>
            {!compact && (
              <>
                <p className="text-[11px] text-slate-400">On a VM that already runs DCS:</p>
                <div className="flex items-start gap-2">
                  <pre className="flex-1 min-w-0 text-[11px] font-mono text-slate-300 bg-black/30 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">{joinCmd}</pre>
                  <CopyChip text={joinCmd} label="Copy" />
                </div>
              </>
            )}
            <p className="text-[10px] text-slate-500">The VM creates an account for this hub and hands it over once; the hub reaches it at http://&lt;its address&gt;:9876. The join finishes in that VM's setup wizard when the VM is brand new.</p>
          </div>
          {tokens.length > 1 && !compact && (
            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
              Older codes still valid: {tokens.slice(0, -1).map((t) => (
                <span key={t.token} className="inline-flex items-center gap-1 font-mono text-slate-400">{t.token}
                  <button type="button" onClick={() => revokeFleetJoinToken(t.token).then(load).catch(() => {})} className="text-slate-500 hover:text-rose-300" title="Revoke"><Trash2 size={11} /></button>
                </span>
              ))}
            </div>
          )}
        </>
      ) : busy ? <p className="text-[11px] text-slate-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Minting a join code…</p>
        : <p className="text-[11px] text-slate-400">No join code yet.</p>}
    </div>
  )
}
