// =============================================================================
// DNS — Route & subdomain management with Cloudflare DNS integration
// =============================================================================

import { useState, useCallback, useMemo } from 'react'
import {
  Globe, Search, RefreshCw, Loader2, Pencil, Check, X, Trash2,
  AlertTriangle, Shield, ExternalLink, ArrowRight, Network, CheckCircle,
  XCircle, CloudOff,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import {
  fetchRoutes, fetchDnsRecords, checkSubdomain, updateRoute, deleteRoute,
  fetchTraefikStatus,
  type RouteEntry, type DnsRecord,
} from '../api/endpoints'

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

function DeleteRouteModal({ route, onConfirm, onCancel }: {
  route: RouteEntry
  onConfirm: () => void
  onCancel: () => void
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="relative w-full max-w-md mx-4 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/10">
            <Trash2 size={18} className="text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Delete Route</h3>
            <p className="text-[10px] text-slate-500">This will remove the Traefik route and Cloudflare DNS record</p>
          </div>
        </div>
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 mb-4">
          <p className="text-xs text-rose-300">
            <span className="font-semibold text-rose-400">{route.subdomain}</span> will no longer be accessible.
            The route file and DNS record will be permanently removed.
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.03] p-3 mb-5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Service</span>
            <span className="text-slate-300 font-mono">{route.service}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Stack</span>
            <span className="text-slate-300 font-mono">{route.stack}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Backend</span>
            <span className="text-slate-300 font-mono truncate ml-4">{route.target}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">Cancel</button>
          <button onClick={onConfirm} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/25 transition-all">
            <Trash2 size={14} /> Delete Route
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DNS() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const { addToast } = useToast()

  // ---- Data fetching ----
  const { data: routesData, loading: routesLoading, refresh: refreshRoutes } = usePolling(fetchRoutes, 30000, { enabled: isConnected })
  const { data: dnsData, loading: dnsLoading, refresh: refreshDns } = usePolling(fetchDnsRecords, 60000, { enabled: isConnected })
  const { data: traefikStatus } = usePolling(fetchTraefikStatus, 60000, { enabled: isConnected })

  const routes = routesData?.routes ?? []
  const domain = routesData?.domain ?? traefikStatus?.domain ?? ''
  const dnsRecords = dnsData?.records ?? []
  const cfConfigured = dnsData?.cf_configured ?? false

  // ---- UI state ----
  const [searchQuery, setSearchQuery] = useState('')
  const [editingRoute, setEditingRoute] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingRoute, setDeletingRoute] = useState<RouteEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ---- Subdomain availability check ----
  const [checkingSubdomain, setCheckingSubdomain] = useState(false)
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null)

  // ---- Filtered routes ----
  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return routes
    const q = searchQuery.toLowerCase()
    return routes.filter(r =>
      r.subdomain.toLowerCase().includes(q) ||
      r.service.toLowerCase().includes(q) ||
      r.stack.toLowerCase().includes(q),
    )
  }, [routes, searchQuery])

  // ---- Group routes by stack ----
  const routesByStack = useMemo(() => {
    const map: Record<string, RouteEntry[]> = {}
    for (const r of filteredRoutes) {
      if (!map[r.stack]) map[r.stack] = []
      map[r.stack].push(r)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredRoutes])

  // ---- Orphaned DNS records (CNAME exists but no matching route) ----
  const orphanedDns = useMemo(() => {
    // Build a set of known subdomains from routes (both full FQDN and prefix)
    const known = new Set<string>()
    for (const r of routes) {
      known.add(r.subdomain)                    // full FQDN: authelia.howson.dev
      known.add(r.subdomain.split('.')[0])      // prefix: authelia
      known.add(r.service)                       // service name: authelia
    }
    return dnsRecords.filter(d => d.managed && !known.has(d.name) && !known.has(d.subdomain))
  }, [routes, dnsRecords])

  // ---- Handlers ----
  const handleCheckSubdomain = useCallback(async (sub: string) => {
    if (!sub.trim()) return
    setCheckingSubdomain(true)
    setSubdomainAvailable(null)
    try {
      const result = await checkSubdomain(sub.trim())
      setSubdomainAvailable(result.available)
      if (!result.available) {
        addToast({ type: 'warning', message: `${sub} is already used by ${result.existing_service} in ${result.existing_stack}` })
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to check subdomain' })
    } finally {
      setCheckingSubdomain(false)
    }
  }, [addToast])

  const handleRenameStart = useCallback((route: RouteEntry) => {
    setEditingRoute(`${route.stack}/${route.service}`)
    setEditValue(route.subdomain.split('.')[0])
    setSubdomainAvailable(null)
  }, [])

  const handleRenameSave = useCallback(async (route: RouteEntry) => {
    const newSub = editValue.trim().toLowerCase()
    if (!newSub || newSub === route.subdomain.split('.')[0]) {
      setEditingRoute(null)
      return
    }
    setSaving(true)
    try {
      await updateRoute(route.stack, route.service, newSub)
      addToast({ type: 'success', message: `Route updated: ${newSub}.${domain}` })
      setEditingRoute(null)
      refreshRoutes()
      refreshDns()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update route' })
    } finally {
      setSaving(false)
    }
  }, [editValue, domain, addToast, refreshRoutes, refreshDns])

  const handleDelete = useCallback(async (route: RouteEntry) => {
    setDeleting(true)
    try {
      await deleteRoute(route.stack, route.service)
      addToast({ type: 'success', message: `Route deleted: ${route.subdomain}` })
      setDeletingRoute(null)
      refreshRoutes()
      refreshDns()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete route' })
    } finally {
      setDeleting(false)
    }
  }, [addToast, refreshRoutes, refreshDns])

  const refreshAll = useCallback(() => { refreshRoutes(); refreshDns() }, [refreshRoutes, refreshDns])

  // ---- Render ----
  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />

      {/* Delete confirmation modal */}
      {deletingRoute && (
        <DeleteRouteModal
          route={deletingRoute}
          onConfirm={() => handleDelete(deletingRoute)}
          onCancel={() => setDeletingRoute(null)}
        />
      )}

      {/* ---- Page Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight"><span className="text-gradient">DNS & Routes</span></h1>
            <p className="text-sm text-slate-400">
              {domain ? (
                <>
                  <span className="text-slate-300 font-medium">*.{domain}</span>
                  {' — '}
                  <span>{routes.length} route{routes.length !== 1 ? 's' : ''}</span>
                  {cfConfigured && <span className="text-cyan-400 ml-1.5">CF</span>}
                </>
              ) : 'Manage Traefik routes and Cloudflare DNS records'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={routesLoading || dnsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 transition-all disabled:opacity-50 press"
          >
            <RefreshCw size={13} className={(routesLoading || dnsLoading) ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ---- Status Cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
          <Network size={16} className="text-cyan-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Routes</p>
            <p className="text-xl font-bold text-white">{routes.length}</p>
          </div>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
          <Globe size={16} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">DNS Records</p>
            <p className="text-xl font-bold text-white">{dnsRecords.length}</p>
          </div>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
          <Shield size={16} className={traefikStatus?.active ? 'text-emerald-400 shrink-0' : 'text-slate-500 shrink-0'} />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Traefik</p>
            <p className={`text-sm font-bold ${traefikStatus?.active ? 'text-emerald-400' : 'text-slate-500'}`}>{traefikStatus?.active ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
          {!dnsData ? <Loader2 size={16} className="text-slate-500 shrink-0 animate-spin" /> : cfConfigured ? <CheckCircle size={16} className="text-emerald-400 shrink-0" /> : <CloudOff size={16} className="text-slate-500 shrink-0" />}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Cloudflare</p>
            <p className={`text-sm font-bold ${!dnsData ? 'text-slate-500' : cfConfigured ? 'text-emerald-400' : 'text-slate-500'}`}>{!dnsData ? 'Loading...' : cfConfigured ? 'Connected' : 'Not Set'}</p>
          </div>
        </div>
      </div>

      {/* ---- Search ---- */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search routes by subdomain, service, or stack..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all duration-200"
        />
      </div>

      {/* ---- Domain Tree ---- */}
      <div className="glass border border-white/5 rounded-xl overflow-hidden">
        {/* Domain header */}
        <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <Globe size={14} className="text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">{domain || 'No domain configured'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500 border border-white/5">
              {routes.length} route{routes.length !== 1 ? 's' : ''}
            </span>
          </div>
          {domain && (
            <span className="text-[10px] text-slate-600 font-mono hidden sm:block">TRAEFIK_DOMAIN (read-only)</span>
          )}
        </div>

        {/* Routes grouped by stack */}
        {routesLoading && routes.length === 0 ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 size={20} className="animate-spin text-slate-500" />
            <span className="text-sm text-slate-500">Loading routes...</span>
          </div>
        ) : routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Globe size={28} className="text-slate-500" />
            <p className="text-sm text-slate-400">No routes configured</p>
            <p className="text-xs text-slate-500">Deploy a template with Traefik active to create routes</p>
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Search size={20} className="text-slate-500" />
            <p className="text-sm text-slate-500">No routes match "{searchQuery}"</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {routesByStack.map(([stack, stackRoutes]) => (
              <div key={stack}>
                {/* Stack group header */}
                <div className="px-5 py-2 bg-white/[0.02] flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{stack}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-slate-600">{stackRoutes.length}</span>
                </div>

                {/* Route rows */}
                {stackRoutes.map((route) => {
                  const routeKey = `${route.stack}/${route.service}`
                  const isEditing = editingRoute === routeKey
                  const sub = route.subdomain.split('.')[0]

                  return (
                    <div
                      key={routeKey}
                      className="group/row flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors"
                    >
                      {/* Tree connector */}
                      <div className="flex items-center gap-1.5 text-slate-700 shrink-0">
                        <span className="text-[10px] font-mono">├─</span>
                      </div>

                      {/* Subdomain (editable) */}
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => { setEditValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSubdomainAvailable(null) }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSave(route)
                                if (e.key === 'Escape') setEditingRoute(null)
                                if (e.key === 'Tab') { e.preventDefault(); handleCheckSubdomain(editValue) }
                              }}
                              autoFocus
                              className="w-32 bg-slate-900/60 border border-cyan-500/30 rounded px-2 py-0.5 text-xs text-slate-200 font-mono focus:outline-none"
                              placeholder={sub}
                            />
                            <span className="text-[10px] text-slate-600 font-mono">.{domain}</span>
                            {/* Availability indicator */}
                            {checkingSubdomain ? (
                              <Loader2 size={11} className="animate-spin text-slate-500" />
                            ) : subdomainAvailable === true ? (
                              <CheckCircle size={11} className="text-emerald-400" />
                            ) : subdomainAvailable === false ? (
                              <XCircle size={11} className="text-rose-400" />
                            ) : null}
                            <button onClick={() => handleRenameSave(route)} disabled={saving} className="text-emerald-400 hover:text-emerald-300 shrink-0">
                              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            </button>
                            <button onClick={() => setEditingRoute(null)} className="text-slate-500 hover:text-slate-300 shrink-0"><X size={12} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm font-mono text-cyan-400 truncate" title={route.subdomain}>
                              {sub}
                            </span>
                            <span className="text-[10px] text-slate-600 font-mono">.{domain}</span>
                            {route.conflict && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/15 text-rose-400" title="Subdomain conflict">
                                <AlertTriangle size={9} /> conflict
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      <ArrowRight size={12} className="text-slate-700 shrink-0" />

                      {/* Service name */}
                      <span className="text-xs text-slate-300 font-medium shrink-0 w-24 truncate" title={route.service}>
                        {route.service}
                      </span>

                      {/* Backend target */}
                      <span className="text-[10px] text-slate-500 font-mono truncate hidden lg:block max-w-[180px]" title={route.target}>
                        {route.target}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        {isAdmin && !isEditing && (
                          <>
                            <button
                              onClick={() => handleRenameStart(route)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                              title="Edit subdomain"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={() => setDeletingRoute(route)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                              title="Delete route"
                            >
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                        <a
                          href={`https://${route.subdomain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                          title={`Open https://${route.subdomain}`}
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Cloudflare DNS Records ---- */}
      {cfConfigured && dnsRecords.length > 0 && (
        <div className="glass border border-white/5 rounded-xl p-4 md:p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cloudflare DNS Records</h3>
            </div>
            <div className="flex items-center gap-2">
              {orphanedDns.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/15">
                  {orphanedDns.length} orphaned
                </span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500 border border-white/5">
                {dnsRecords.length} record{dnsRecords.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 md:-mx-6">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">Record</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">Target</th>
                  <th className="text-center px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">Proxied</th>
                  <th className="text-center px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {dnsRecords.map((rec: DnsRecord) => {
                  const hasRoute = routes.some(r => r.subdomain === rec.name || r.subdomain.split('.')[0] === rec.subdomain || r.service === rec.subdomain)
                  return (
                    <tr key={rec.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-mono text-cyan-400">{rec.subdomain}</span>
                        <span className="text-[10px] text-slate-600 font-mono">.{domain}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-slate-400 font-mono">{rec.content}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {rec.proxied ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><Shield size={10} /> Yes</span>
                        ) : (
                          <span className="text-[10px] text-slate-500">No</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {rec.managed ? (
                          hasRoute ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                              <CheckCircle size={9} /> Synced
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-400" title="DNS record exists but no matching route file">
                              <AlertTriangle size={9} /> Orphaned
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-white/[0.04] text-slate-500">
                            External
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- No Cloudflare banner — only show after DNS data has loaded ---- */}
      {!cfConfigured && isConnected && dnsData && !dnsLoading && (
        <div className="glass border border-white/5 rounded-xl p-5 flex items-center gap-4 animate-fade-in">
          <CloudOff size={20} className="text-slate-500 shrink-0" />
          <div>
            <p className="text-sm text-slate-300 font-medium">Cloudflare DNS not configured</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Set <span className="font-mono text-slate-400">CF_DNS_API_TOKEN</span> in Server Config to enable DNS record management
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
