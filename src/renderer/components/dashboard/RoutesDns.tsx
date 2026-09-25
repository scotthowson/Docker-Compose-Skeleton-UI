// =============================================================================
// RoutesDns — every Traefik route one click away, with Cloudflare DNS status
// =============================================================================

import React from 'react'
import { Globe, ExternalLink, AlertTriangle, ShieldCheck, ShieldOff, Layers } from 'lucide-react'
import { usePolling } from '../../hooks/usePolling'
import { useConnectionStore } from '../../stores/connectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { fetchRoutes, fetchDnsStatus } from '../../api/endpoints'
import { CardHeader, CardLoading, CardError, CardEmpty } from './cardShared'

export default function RoutesDns() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const routes = usePolling(fetchRoutes, 60000, { enabled: isConnected })
  const dns = usePolling(fetchDnsStatus, 120000, { enabled: isConnected })

  const domain = routes.data?.domain || dns.data?.domain || ''
  const list = routes.data?.routes ?? []
  const dnsOk = dns.data?.cf_configured && dns.data?.token_status === 'active' && dns.data?.zone_found
  const dnsLabel = !dns.data ? '' : !dns.data.cf_configured ? 'DNS not linked' : dnsOk ? 'DNS linked' : `DNS ${dns.data.token_status}`

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <CardHeader
        icon={<Globe size={15} />}
        title="Routes & DNS"
        count={routes.data ? routes.data.total : undefined}
        right={dns.data ? (
          <button onClick={() => setCurrentPage('dns')} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${dnsOk ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200'}`} title="Open DNS & Routes">
            {dnsOk ? <ShieldCheck size={11} /> : <ShieldOff size={11} />}
            {dnsLabel}
          </button>
        ) : undefined}
      />
      {routes.error && !routes.data ? (
        <CardError error={routes.error} onRetry={routes.refresh} />
      ) : !routes.data ? (
        <CardLoading label="Loading routes…" />
      ) : list.length === 0 ? (
        <CardEmpty icon={<Globe size={22} />} title="No routes yet" hint={domain ? `Deploy a template with HTTPS routing to publish it under ${domain}.` : 'Deploy Traefik and set a domain to publish services.'} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 space-y-1">
          {list.map((r) => {
            const host = domain ? `${r.subdomain}.${domain}` : r.subdomain
            const url = `https://${host}`
            return (
              <a
                key={`${r.stack}/${r.service}/${r.subdomain}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-white/[0.02] border border-white/[0.03] hover:bg-white/[0.05] hover:border-white/10 transition-colors no-underline"
                title={`Open ${url}`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${r.conflict ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-mono font-medium text-slate-200 truncate">{host}</span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 truncate"><Layers size={9} />{r.stack} · {r.service}{r.target ? ` → ${r.target}` : ''}</span>
                </div>
                {r.conflict && <span className="flex items-center gap-1 text-[10px] text-amber-400 shrink-0" title="Two services claim this subdomain"><AlertTriangle size={11} />conflict</span>}
                <ExternalLink size={13} className="text-slate-600 group-hover:text-cyan-400 transition-colors shrink-0" />
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
