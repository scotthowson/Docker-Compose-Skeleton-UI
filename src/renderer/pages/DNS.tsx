// =============================================================================
// DNS & Routes — Traefik routes and the Cloudflare zone, managed together.
// Routes are what DCS creates for services; records are what Cloudflare serves.
// The page links the two, creates what is missing and protects what is in use.
// =============================================================================

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  Globe, Search, RefreshCw, Loader2, Pencil, Check, X, Trash2,
  AlertTriangle, Shield, ExternalLink, ArrowRight, Network, CheckCircle,
  XCircle, CloudOff, Cloud, Plus, KeyRound, Link2, Wand2, Lock, Route,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { LoadingState, EmptyState, ErrorState } from '../components/common/PageState'
import {
  fetchRoutes, fetchDnsRecords, fetchDnsStatus, fetchDnsZones, checkSubdomain, updateRoute, deleteRoute,
  fetchTraefikStatus, createDnsRecord, updateDnsRecord, deleteDnsRecord, syncDnsRecords,
  type RouteEntry, type DnsRecord, type DnsRecordInput, type DnsZone,
} from '../api/endpoints'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EDITABLE_TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS'] as const
type EditableType = typeof EDITABLE_TYPES[number]
const PROXIABLE_TYPES = new Set(['A', 'AAAA', 'CNAME'])
const TTL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Auto' }, { value: 60, label: '1 min' }, { value: 300, label: '5 min' }, { value: 1800, label: '30 min' },
  { value: 3600, label: '1 hour' }, { value: 43200, label: '12 hours' }, { value: 86400, label: '1 day' },
]

const TYPE_STYLE: Record<string, string> = {
  A: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  AAAA: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  CNAME: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  TXT: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  MX: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  NS: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
}

function typeClass(type: string): string {
  return TYPE_STYLE[type] || 'bg-white/[0.06] text-slate-400 border-white/[0.06]'
}

function ttlLabel(ttl: number): string {
  if (ttl === 1) return 'Auto'
  const hit = TTL_OPTIONS.find((o) => o.value === ttl)
  if (hit) return hit.label
  if (ttl % 3600 === 0) return `${ttl / 3600} h`
  if (ttl % 60 === 0) return `${ttl / 60} min`
  return `${ttl} s`
}

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const HOST_RE = /^([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.?$/i
const LABEL_RE = /^(\*\.)?([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/i

/** Mirror of the server's checks, so mistakes are caught before the request */
function validateRecordInput(type: EditableType, name: string, content: string, priority: string, comment: string): string | null {
  const n = name.trim()
  if (n && n !== '@' && !LABEL_RE.test(n)) return 'Name must be a hostname label such as app or _acme-challenge.app'
  const c = content.trim()
  if (!c) return 'Content is required'
  switch (type) {
    case 'A': if (!IPV4_RE.test(c)) return 'Content must be an IPv4 address'; break
    case 'AAAA': if (!/^[0-9a-f:]+$/i.test(c) || !c.includes(':')) return 'Content must be an IPv6 address'; break
    case 'CNAME': case 'NS': case 'MX': if (!HOST_RE.test(c)) return 'Content must be a hostname'; break
    case 'TXT': if (c.length > 2048) return 'TXT content is limited to 2048 characters'; break
  }
  if (priority && !/^\d+$/.test(priority)) return 'Priority must be a number'
  if (priority && Number(priority) > 65535) return 'Priority must be 65535 or less'
  if (comment.length > 100) return 'Comment is limited to 100 characters'
  return null
}

function isApex(rec: DnsRecord): boolean {
  return rec.subdomain === '@' && PROXIABLE_TYPES.has(rec.type)
}

function displayName(rec: DnsRecord, zone: string): { head: string; tail: string } {
  if (rec.subdomain === '@') return { head: zone, tail: '' }
  if (rec.name.endsWith(`.${zone}`)) return { head: rec.subdomain, tail: `.${zone}` }
  return { head: rec.name, tail: '' }
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function DeleteRouteModal({ route, onConfirm, onCancel, busy }: {
  route: RouteEntry
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
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
            <p className="text-[10px] text-slate-500">Removes the Traefik route file and its Cloudflare record</p>
          </div>
        </div>
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 mb-4">
          <p className="text-xs text-rose-300">
            <span className="font-semibold text-rose-400">{route.subdomain}</span> will stop answering. The route file and the DNS record are removed; the service keeps running.
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.03] p-3 mb-5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Service</span><span className="text-slate-300 font-mono">{route.service}</span></div>
          <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Stack</span><span className="text-slate-300 font-mono">{route.stack}</span></div>
          <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Backend</span><span className="text-slate-300 font-mono truncate ml-4">{route.target}</span></div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete Route
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function RecordModal({ zone, initial, onClose, onSaved }: {
  zone: string
  initial: DnsRecord | null
  onClose: () => void
  onSaved: (rec: DnsRecord, created: boolean) => void
}) {
  const editing = !!initial
  const [type, setType] = useState<EditableType>((initial && (EDITABLE_TYPES as readonly string[]).includes(initial.type) ? initial.type : 'A') as EditableType)
  const [name, setName] = useState(initial ? initial.subdomain : '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [ttl, setTtl] = useState<number>(initial?.ttl ?? 1)
  const [proxied, setProxied] = useState<boolean>(initial?.proxied ?? PROXIABLE_TYPES.has(type))
  const [priority, setPriority] = useState(initial?.priority != null ? String(initial.priority) : '')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const proxiable = PROXIABLE_TYPES.has(type)
  const fqdn = !name.trim() || name.trim() === '@' ? zone : name.trim().endsWith(`.${zone}`) ? name.trim() : `${name.trim()}.${zone}`

  const placeholder: Record<EditableType, string> = {
    A: '203.0.113.10', AAAA: '2001:db8::10', CNAME: zone, TXT: 'v=spf1 -all', MX: `mail.${zone}`, NS: 'ns1.example.net',
  }

  const submit = useCallback(async () => {
    const problem = validateRecordInput(type, name, content, priority, comment)
    if (problem) { setError(problem); return }
    setSaving(true); setError(null)
    const input: DnsRecordInput = {
      type, name: name.trim() || '@', content: content.trim(), ttl: proxiable && proxied ? 1 : ttl,
      proxied: proxiable ? proxied : false, comment: comment.trim(),
      ...(type === 'MX' ? { priority: priority ? Number(priority) : 10 } : {}),
    }
    try {
      const res = editing ? await updateDnsRecord(initial!.id, input) : await createDnsRecord(input)
      onSaved(res.record, !editing)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSaving(false)
    }
  }, [type, name, content, priority, comment, ttl, proxied, proxiable, editing, initial, onSaved])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void submit() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, submit])

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all'

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg mx-4 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 animate-scale-in max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/10">
              {editing ? <Pencil size={16} className="text-cyan-400" /> : <Plus size={16} className="text-cyan-400" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">{editing ? 'Edit record' : 'Add record'}</h3>
              <p className="text-[10px] text-slate-500 font-mono">{fqdn}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5"><X size={16} /></button>
        </div>

        <div className="px-6 pb-4 space-y-4 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Type</label>
              <select value={type} onChange={(e) => { const t = e.target.value as EditableType; setType(t); setProxied(PROXIABLE_TYPES.has(t) ? proxied : false) }} className={inputCls} disabled={editing}>
                {EDITABLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Name</label>
              <div className="relative">
                <input value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="@ for the root, or app" className={`${inputCls} font-mono pr-32`} autoFocus />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-600 font-mono pointer-events-none truncate max-w-[45%]">.{zone}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">
              {type === 'A' || type === 'AAAA' ? 'Address' : type === 'CNAME' ? 'Target' : type === 'MX' ? 'Mail server' : type === 'NS' ? 'Name server' : 'Content'}
            </label>
            {type === 'TXT' ? (
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={placeholder[type]} rows={3} className={`${inputCls} font-mono resize-y`} />
            ) : (
              <input value={content} onChange={(e) => setContent(e.target.value)} placeholder={placeholder[type]} className={`${inputCls} font-mono`} />
            )}
          </div>

          <div className={`grid gap-3 ${type === 'MX' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">TTL</label>
              <select value={proxiable && proxied ? 1 : ttl} onChange={(e) => setTtl(Number(e.target.value))} className={inputCls} disabled={proxiable && proxied} title={proxiable && proxied ? 'Proxied records always use the automatic TTL' : undefined}>
                {TTL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {type === 'MX' && (
              <div>
                <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Priority</label>
                <input value={priority} onChange={(e) => setPriority(e.target.value.replace(/[^0-9]/g, ''))} placeholder="10" className={`${inputCls} font-mono`} />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Proxy status</label>
              <button
                type="button"
                onClick={() => proxiable && setProxied(!proxied)}
                disabled={!proxiable}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${!proxiable ? 'bg-white/[0.02] border-white/5 text-slate-600 cursor-not-allowed' : proxied ? 'bg-orange-500/10 border-orange-500/25 text-orange-300' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'}`}
                title={proxiable ? 'Proxied records hide the origin address behind Cloudflare' : 'Only A, AAAA and CNAME records can be proxied'}
              >
                <span className="flex items-center gap-1.5">{proxied && proxiable ? <Cloud size={13} /> : <CloudOff size={13} />}{proxied && proxiable ? 'Proxied' : 'DNS only'}</span>
                <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${proxied && proxiable ? 'bg-orange-500' : 'bg-slate-700'}`}>
                  <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${proxied && proxiable ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Comment <span className="normal-case text-slate-600">(optional, shown in Cloudflare)</span></label>
            <input value={comment} onChange={(e) => setComment(e.target.value.slice(0, 100))} placeholder="What this record is for" className={inputCls} />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2">
              <XCircle size={13} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-300">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-white/5">
          <span className="text-[10px] text-slate-600">Ctrl+Enter saves · Esc closes</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">Cancel</button>
            <button onClick={() => void submit()} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/25 transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {editing ? 'Save changes' : 'Create record'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function DeleteRecordModal({ record, zone, onConfirm, onCancel, busy }: {
  record: DnsRecord
  zone: string
  onConfirm: (force: boolean) => void
  onCancel: () => void
  busy: boolean
}) {
  const protectedReason = isApex(record)
    ? `${record.name} is the root of the zone — every DCS route points at it.`
    : record.route && PROXIABLE_TYPES.has(record.type)
      ? `The DCS route ${record.route} answers on this name.`
      : null
  const [typed, setTyped] = useState('')
  const canDelete = !protectedReason || typed.trim().toLowerCase() === record.name.toLowerCase()
  const { head, tail } = displayName(record, zone)
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="relative w-full max-w-md mx-4 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/10"><Trash2 size={18} className="text-rose-400" /></div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Delete DNS record</h3>
            <p className="text-[10px] text-slate-500">Removed from Cloudflare immediately</p>
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.03] p-3 mb-4 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between"><span className="text-slate-500">Record</span><span className="font-mono text-slate-200"><span className={`inline-block px-1.5 py-px rounded border text-[9px] font-semibold mr-2 ${typeClass(record.type)}`}>{record.type}</span>{head}<span className="text-slate-500">{tail}</span></span></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Content</span><span className="font-mono text-slate-300 truncate ml-4" title={record.content}>{record.content}</span></div>
        </div>
        {protectedReason ? (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 mb-4 space-y-2">
            <p className="text-xs text-rose-300 flex items-start gap-2"><Lock size={13} className="shrink-0 mt-0.5" />{protectedReason} Deleting it takes the service offline.</p>
            <p className="text-[10px] text-rose-400/70">Type <span className="font-mono text-rose-300">{record.name}</span> to delete it anyway.</p>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={record.name} className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-rose-500/30 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none" autoFocus />
          </div>
        ) : (
          <div className="rounded-lg bg-amber-500/[0.06] border border-amber-500/15 p-3 mb-4">
            <p className="text-xs text-amber-200/80">Resolvers stop answering for this name once their cache expires{record.managed ? '. DCS created this record; a matching route will show as missing DNS afterwards' : ''}.</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">Cancel</button>
          <button onClick={() => onConfirm(!!protectedReason)} disabled={busy || !canDelete} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete record
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

type Tab = 'routes' | 'records'

export default function DNS() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const setCurrentPage = useSettingsStore.getState().setCurrentPage
  const { addToast } = useToast()

  // ---- Zone selection (only matters when the token sees several zones) ----
  const [zoneId, setZoneId] = useState<string>('')
  const [zones, setZones] = useState<DnsZone[]>([])

  // ---- Data ----
  const { data: routesData, loading: routesLoading, error: routesError, refresh: refreshRoutes } = usePolling(fetchRoutes, 30000, { enabled: isConnected })
  const { data: dnsStatus, refresh: refreshStatus } = usePolling(fetchDnsStatus, 60000, { enabled: isConnected })
  const fetchRecords = useCallback(() => fetchDnsRecords(zoneId ? { zone: zoneId } : {}), [zoneId])
  const { data: dnsData, loading: dnsLoading, error: dnsError, refresh: refreshDns } = usePolling(fetchRecords, 60000, { enabled: isConnected })
  const { data: traefikStatus } = usePolling(fetchTraefikStatus, 60000, { enabled: isConnected })

  const routes = routesData?.routes ?? []
  const domain = routesData?.domain ?? dnsStatus?.domain ?? traefikStatus?.domain ?? ''
  const cfConfigured = dnsStatus?.cf_configured ?? dnsData?.cf_configured ?? false
  const records = dnsData?.records ?? []
  const zoneName = dnsData?.zone?.name || dnsStatus?.zone?.name || domain
  const missingDns = dnsData?.routes_without_dns ?? []

  // Refetch the records when another zone is picked (not on mount)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    refreshDns()
  }, [zoneId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zones are fetched once the token is known to work
  useEffect(() => {
    if (!isConnected || !cfConfigured || !isAdmin || zones.length > 0) return
    fetchDnsZones().then((res) => setZones(res.zones ?? [])).catch(() => {})
  }, [isConnected, cfConfigured, isAdmin, zones.length])

  // ---- UI state ----
  const [tab, setTab] = useState<Tab>(() => {
    try { const t = localStorage.getItem('dcs-dns-tab'); if (t === 'records' || t === 'routes') return t } catch {}
    return 'routes'
  })
  const switchTab = useCallback((t: Tab) => { setTab(t); try { localStorage.setItem('dcs-dns-tab', t) } catch {} }, [])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [editingRoute, setEditingRoute] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingRoute, setDeletingRoute] = useState<RouteEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [checkingSubdomain, setCheckingSubdomain] = useState(false)
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null)
  const [recordModal, setRecordModal] = useState<{ open: boolean; record: DnsRecord | null }>({ open: false, record: null })
  const [deletingRecord, setDeletingRecord] = useState<DnsRecord | null>(null)
  const [busyRecord, setBusyRecord] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  // ---- Derived ----
  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return routes
    const q = searchQuery.toLowerCase()
    return routes.filter((r) => r.subdomain.toLowerCase().includes(q) || r.service.toLowerCase().includes(q) || r.stack.toLowerCase().includes(q))
  }, [routes, searchQuery])

  const routesByStack = useMemo(() => {
    const map: Record<string, RouteEntry[]> = {}
    for (const r of filteredRoutes) { (map[r.stack] ||= []).push(r) }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredRoutes])

  const missingByFqdn = useMemo(() => new Set(missingDns.map((m) => m.fqdn)), [missingDns])
  const recordByName = useMemo(() => {
    const map = new Map<string, DnsRecord>()
    for (const r of records) if (PROXIABLE_TYPES.has(r.type) && !map.has(r.name)) map.set(r.name, r)
    return map
  }, [records])

  const orphanedRecords = useMemo(() => records.filter((r) => r.managed && r.points_to_dcs && !r.route), [records])
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of records) c[r.type] = (c[r.type] || 0) + 1
    return c
  }, [records])

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return records.filter((r) => (!typeFilter || r.type === typeFilter) && (!q || `${r.name} ${r.content} ${r.comment}`.toLowerCase().includes(q)))
  }, [records, typeFilter, searchQuery])

  const refreshAll = useCallback(() => { refreshRoutes(); refreshDns(); refreshStatus() }, [refreshRoutes, refreshDns, refreshStatus])

  // ---- Route handlers ----
  const handleCheckSubdomain = useCallback(async (sub: string) => {
    if (!sub.trim()) return
    setCheckingSubdomain(true); setSubdomainAvailable(null)
    try {
      const result = await checkSubdomain(sub.trim())
      setSubdomainAvailable(result.available)
      if (!result.available) addToast({ type: 'warning', message: `${sub} is already used by ${result.existing_service} in ${result.existing_stack}` })
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
    if (!newSub || newSub === route.subdomain.split('.')[0]) { setEditingRoute(null); return }
    setSaving(true)
    try {
      await updateRoute(route.stack, route.service, newSub)
      addToast({ type: 'success', message: `Route renamed to ${newSub}.${domain} — the DNS record follows` })
      setEditingRoute(null)
      refreshAll()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update route' })
    } finally {
      setSaving(false)
    }
  }, [editValue, domain, addToast, refreshAll])

  const handleDeleteRoute = useCallback(async (route: RouteEntry) => {
    setDeleting(true)
    try {
      await deleteRoute(route.stack, route.service)
      addToast({ type: 'success', message: `Route deleted: ${route.subdomain}` })
      setDeletingRoute(null)
      refreshAll()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete route' })
    } finally {
      setDeleting(false)
    }
  }, [addToast, refreshAll])

  const handleCreateForRoute = useCallback(async (fqdn: string) => {
    if (!domain) return
    setCreatingFor(fqdn)
    try {
      await createDnsRecord({ type: 'CNAME', name: fqdn, content: domain, ttl: 1, proxied: true, comment: 'Auto-created by DCS' })
      addToast({ type: 'success', message: `CNAME ${fqdn} → ${domain} created (proxied)` })
      refreshDns()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to create the record' })
    } finally {
      setCreatingFor(null)
    }
  }, [domain, addToast, refreshDns])

  // ---- Record handlers ----
  const handleRecordSaved = useCallback((rec: DnsRecord, created: boolean) => {
    setRecordModal({ open: false, record: null })
    addToast({ type: 'success', message: `${created ? 'Created' : 'Updated'} ${rec.type} ${rec.name}` })
    refreshDns()
  }, [addToast, refreshDns])

  const handleToggleProxy = useCallback(async (rec: DnsRecord) => {
    setBusyRecord(rec.id)
    try {
      await updateDnsRecord(rec.id, { proxied: !rec.proxied })
      addToast({ type: 'success', message: `${rec.name} is now ${rec.proxied ? 'DNS only' : 'proxied through Cloudflare'}` })
      refreshDns()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to change the proxy status' })
    } finally {
      setBusyRecord(null)
    }
  }, [addToast, refreshDns])

  const handleDeleteRecord = useCallback(async (rec: DnsRecord, force: boolean) => {
    setBusyRecord(rec.id)
    try {
      await deleteDnsRecord(rec.id, { force, zone: zoneId || undefined })
      addToast({ type: 'success', message: `Deleted ${rec.type} ${rec.name}` })
      setDeletingRecord(null)
      refreshDns()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete the record' })
    } finally {
      setBusyRecord(null)
    }
  }, [zoneId, addToast, refreshDns])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await syncDnsRecords()
      const created = res.created?.length ?? 0
      const failed = res.failed?.length ?? 0
      addToast({
        type: failed ? 'warning' : 'success',
        message: created || failed ? `${created} record${created === 1 ? '' : 's'} created${failed ? `, ${failed} failed: ${res.failed.map((f) => `${f.name} (${f.error})`).join('; ')}` : ''}` : 'Every route already has a record',
        duration: 6000,
      })
      refreshDns()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }, [addToast, refreshDns])

  // ---- Status pill ----
  const tokenPill = (() => {
    if (!dnsStatus) return { cls: 'bg-white/5 text-slate-500 border-white/5', icon: <Loader2 size={11} className="animate-spin" />, label: 'Cloudflare' }
    if (!dnsStatus.cf_configured) return { cls: 'bg-white/5 text-slate-400 border-white/5', icon: <CloudOff size={11} />, label: 'Cloudflare not configured' }
    if (dnsStatus.token_status === 'active') return { cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', icon: <CheckCircle size={11} />, label: `Cloudflare token active · ${dnsStatus.token_source === 'secret' ? 'from the secret store' : dnsStatus.token_source === 'env' ? 'from .env' : 'from a stack .env'}` }
    if (dnsStatus.token_status === 'unreachable') return { cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20', icon: <AlertTriangle size={11} />, label: 'Cloudflare unreachable' }
    return { cls: 'bg-rose-500/10 text-rose-300 border-rose-500/20', icon: <XCircle size={11} />, label: `Cloudflare token ${dnsStatus.token_status}` }
  })()

  // ---- Render ----
  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />

      {deletingRoute && <DeleteRouteModal route={deletingRoute} busy={deleting} onConfirm={() => handleDeleteRoute(deletingRoute)} onCancel={() => setDeletingRoute(null)} />}
      {recordModal.open && <RecordModal zone={zoneName} initial={recordModal.record} onClose={() => setRecordModal({ open: false, record: null })} onSaved={handleRecordSaved} />}
      {deletingRecord && <DeleteRecordModal record={deletingRecord} zone={zoneName} busy={busyRecord === deletingRecord.id} onConfirm={(force) => handleDeleteRecord(deletingRecord, force)} onCancel={() => setDeletingRecord(null)} />}

      {/* ---- Page Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight"><span className="text-gradient">DNS &amp; Routes</span></h1>
            <p className="text-sm text-slate-400">
              {domain ? (
                <>
                  <span className="text-slate-300 font-medium">*.{domain}</span>
                  {' — '}{routes.length} route{routes.length !== 1 ? 's' : ''}
                  {cfConfigured && dnsData ? <>, {dnsData.all_total ?? records.length} DNS record{(dnsData.all_total ?? records.length) !== 1 ? 's' : ''}</> : null}
                </>
              ) : 'Traefik routes and Cloudflare DNS records'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${tokenPill.cls}`} title={dnsStatus?.hint || undefined}>{tokenPill.icon}{tokenPill.label}</span>
          <button onClick={refreshAll} disabled={routesLoading || dnsLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 transition-all disabled:opacity-50 press">
            <RefreshCw size={13} className={routesLoading || dnsLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {isAdmin && cfConfigured && (
            <button onClick={() => { switchTab('records'); setRecordModal({ open: true, record: null }) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/25 transition-all press">
              <Plus size={13} /> Add record
            </button>
          )}
        </div>
      </div>

      {/* ---- Not configured: how to fix it ---- */}
      {isConnected && dnsStatus && !dnsStatus.cf_configured && (
        <div className="glass border border-cyan-500/15 rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center shrink-0"><KeyRound size={18} className="text-cyan-400" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 font-medium">Connect Cloudflare to manage DNS from here</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Create an API token in Cloudflare with <span className="text-slate-300">Zone → DNS → Edit</span> for your zone and store it as the secret <span className="font-mono text-slate-300">CF_DNS_API_TOKEN</span>. Traefik&apos;s DNS challenge, dynamic DNS and this page all read it from there; nothing is written in plain text.
              {!domain && <> Deploy the Traefik template first so DCS knows the domain.</>}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setCurrentPage('secrets')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/25 transition-all press shrink-0">
              <KeyRound size={13} /> Open Secrets
            </button>
          )}
        </div>
      )}
      {isConnected && dnsStatus?.cf_configured && dnsStatus.hint && (
        <div className="glass border border-amber-500/15 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200/80">{dnsStatus.hint}</p>
        </div>
      )}

      {/* ---- Status Cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        <StatCard icon={<Network size={16} className="text-cyan-400" />} label="Routes" value={String(routes.length)} />
        <StatCard icon={<Globe size={16} className="text-emerald-400" />} label="DNS records" value={cfConfigured ? String(dnsData?.all_total ?? records.length) : '—'} sub={dnsStatus?.zone?.status ? `zone ${dnsStatus.zone.status}` : undefined} />
        <StatCard icon={<Link2 size={16} className={missingDns.length ? 'text-amber-400' : 'text-slate-500'} />} label="Missing DNS" value={cfConfigured ? String(missingDns.length) : '—'} sub={missingDns.length ? 'routes without a record' : undefined} tone={missingDns.length ? 'warn' : undefined} />
        <StatCard icon={<Shield size={16} className={traefikStatus?.active ? 'text-emerald-400' : 'text-slate-500'} />} label="Traefik" value={traefikStatus?.active ? 'Active' : 'Inactive'} tone={traefikStatus?.active ? 'ok' : undefined} />
      </div>

      {/* ---- Tabs + search ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5 w-fit">
          {(['routes', 'records'] as Tab[]).map((t) => (
            <button key={t} onClick={() => switchTab(t)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t ? 'bg-white/[0.08] text-slate-100 ring-1 ring-white/10' : 'text-slate-500 hover:text-slate-300'}`}>
              {t === 'routes' ? <Route size={13} /> : <Globe size={13} />}
              {t === 'routes' ? `Routes (${routes.length})` : `DNS records${cfConfigured && dnsData ? ` (${dnsData.all_total ?? records.length})` : ''}`}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tab === 'routes' ? 'Search routes by subdomain, service or stack…' : 'Search records by name, content or comment…'}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all"
          />
        </div>
      </div>

      {tab === 'routes' ? (
        <RoutesPanel
          domain={domain} routes={routes} filteredRoutes={filteredRoutes} routesByStack={routesByStack} loading={routesLoading} error={routesError}
          onRetry={refreshRoutes} searchQuery={searchQuery} isAdmin={isAdmin} cfConfigured={cfConfigured}
          editingRoute={editingRoute} editValue={editValue} setEditValue={setEditValue} saving={saving}
          checkingSubdomain={checkingSubdomain} subdomainAvailable={subdomainAvailable}
          onRenameStart={handleRenameStart} onRenameSave={handleRenameSave} onRenameCancel={() => setEditingRoute(null)} onCheckSubdomain={handleCheckSubdomain}
          onDelete={setDeletingRoute} recordByName={recordByName} missingByFqdn={missingByFqdn} creatingFor={creatingFor} onCreateRecord={handleCreateForRoute}
          setSubdomainAvailable={setSubdomainAvailable}
        />
      ) : (
        <RecordsPanel
          zoneName={zoneName} zones={zones} zoneId={zoneId} setZoneId={setZoneId} records={records} filtered={filteredRecords} typeCounts={typeCounts}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter} loading={dnsLoading} error={dnsError} dataError={dnsData?.error} onRetry={refreshDns}
          cfConfigured={cfConfigured} isAdmin={isAdmin} busyRecord={busyRecord} orphaned={orphanedRecords} missing={missingDns} syncing={syncing}
          onSync={handleSync} onAdd={() => setRecordModal({ open: true, record: null })} onEdit={(r) => setRecordModal({ open: true, record: r })}
          onDelete={setDeletingRecord} onToggleProxy={handleToggleProxy} searchQuery={searchQuery}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function StatCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`text-xl font-bold ${tone === 'ok' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : 'text-white'}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  )
}

function RoutesPanel(props: {
  domain: string; routes: RouteEntry[]; filteredRoutes: RouteEntry[]; routesByStack: [string, RouteEntry[]][]
  loading: boolean; error: Error | null | undefined; onRetry: () => void; searchQuery: string; isAdmin: boolean; cfConfigured: boolean
  editingRoute: string | null; editValue: string; setEditValue: (v: string) => void; saving: boolean
  checkingSubdomain: boolean; subdomainAvailable: boolean | null; setSubdomainAvailable: (v: boolean | null) => void
  onRenameStart: (r: RouteEntry) => void; onRenameSave: (r: RouteEntry) => void; onRenameCancel: () => void; onCheckSubdomain: (s: string) => void
  onDelete: (r: RouteEntry) => void; recordByName: Map<string, DnsRecord>; missingByFqdn: Set<string>; creatingFor: string | null; onCreateRecord: (fqdn: string) => void
}) {
  const { domain, routes, filteredRoutes, routesByStack, loading, error, onRetry, searchQuery, isAdmin, cfConfigured, editingRoute, editValue, setEditValue, saving,
    checkingSubdomain, subdomainAvailable, setSubdomainAvailable, onRenameStart, onRenameSave, onRenameCancel, onCheckSubdomain, onDelete, recordByName, missingByFqdn, creatingFor, onCreateRecord } = props

  return (
    <div className="glass border border-white/5 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-2.5">
          <Globe size={14} className="text-cyan-400" />
          <span className="text-sm font-semibold text-slate-200">{domain || 'No domain configured'}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500 border border-white/5">{routes.length} route{routes.length !== 1 ? 's' : ''}</span>
        </div>
        {domain && <span className="text-[10px] text-slate-600 font-mono hidden sm:block">TRAEFIK_DOMAIN</span>}
      </div>

      {loading && routes.length === 0 ? (
        <LoadingState label="Loading routes…" />
      ) : error && routes.length === 0 ? (
        <ErrorState title="Routes could not be loaded" error={error} onRetry={onRetry} />
      ) : routes.length === 0 ? (
        <EmptyState icon={<Globe size={28} className="text-slate-500" />} title="No routes yet" hint="Deploy a template while Traefik is active and its route appears here" />
      ) : filteredRoutes.length === 0 ? (
        <EmptyState icon={<Search size={20} className="text-slate-500" />} title={`No routes match "${searchQuery}"`} />
      ) : (
        <div className="divide-y divide-white/[0.03]">
          {routesByStack.map(([stack, stackRoutes]) => (
            <div key={stack}>
              <div className="px-5 py-2 bg-white/[0.02] flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{stack}</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-slate-600">{stackRoutes.length}</span>
              </div>
              {stackRoutes.map((route) => {
                const routeKey = `${route.stack}/${route.service}`
                const isEditing = editingRoute === routeKey
                const sub = route.subdomain.split('.')[0]
                const rec = recordByName.get(route.subdomain)
                const missing = cfConfigured && (missingByFqdn.has(route.subdomain) || (!rec && route.subdomain.endsWith(`.${domain}`)))
                return (
                  <div key={routeKey} className="group/row flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors">
                    <span className="text-[10px] font-mono text-slate-700 shrink-0">├─</span>
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text" value={editValue}
                            onChange={(e) => { setEditValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSubdomainAvailable(null) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') onRenameSave(route); if (e.key === 'Escape') onRenameCancel(); if (e.key === 'Tab') { e.preventDefault(); onCheckSubdomain(editValue) } }}
                            autoFocus className="w-32 bg-slate-900/60 border border-cyan-500/30 rounded px-2 py-0.5 text-xs text-slate-200 font-mono focus:outline-none" placeholder={sub}
                          />
                          <span className="text-[10px] text-slate-600 font-mono">.{domain}</span>
                          {checkingSubdomain ? <Loader2 size={11} className="animate-spin text-slate-500" /> : subdomainAvailable === true ? <CheckCircle size={11} className="text-emerald-400" /> : subdomainAvailable === false ? <XCircle size={11} className="text-rose-400" /> : null}
                          <button onClick={() => onRenameSave(route)} disabled={saving} className="text-emerald-400 hover:text-emerald-300 shrink-0">{saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}</button>
                          <button onClick={onRenameCancel} className="text-slate-500 hover:text-slate-300 shrink-0"><X size={12} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-mono text-cyan-400 truncate" title={route.subdomain}>{sub}</span>
                          <span className="text-[10px] text-slate-600 font-mono">.{domain}</span>
                          {route.conflict && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/15 text-rose-400" title="Two routes claim this subdomain"><AlertTriangle size={9} /> conflict</span>}
                          {cfConfigured && rec && (
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${rec.proxied ? 'bg-orange-500/10 text-orange-300' : 'bg-white/5 text-slate-400'}`} title={`${rec.type} → ${rec.content}${rec.proxied ? ' (proxied)' : ' (DNS only)'}`}>
                              {rec.proxied ? <Cloud size={9} /> : <Globe size={9} />} {rec.type}
                            </span>
                          )}
                          {missing && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400" title="No A, AAAA or CNAME record answers for this name"><AlertTriangle size={9} /> no DNS</span>}
                        </div>
                      )}
                    </div>
                    <ArrowRight size={12} className="text-slate-700 shrink-0" />
                    <span className="text-xs text-slate-300 font-medium shrink-0 w-24 truncate" title={route.service}>{route.service}</span>
                    <span className="text-[10px] text-slate-500 font-mono truncate hidden lg:block max-w-[180px]" title={route.target}>{route.target}</span>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
                      {isAdmin && missing && !isEditing && (
                        <button onClick={() => onCreateRecord(route.subdomain)} disabled={creatingFor === route.subdomain} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all disabled:opacity-50" title="Create a proxied CNAME pointing at the domain">
                          {creatingFor === route.subdomain ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} DNS
                        </button>
                      )}
                      {isAdmin && !isEditing && (
                        <>
                          <button onClick={() => onRenameStart(route)} className="p-1.5 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all" title="Rename subdomain"><Pencil size={11} /></button>
                          <button onClick={() => onDelete(route)} className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all" title="Delete route"><Trash2 size={11} /></button>
                        </>
                      )}
                      <a href={`https://${route.subdomain}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all" title={`Open https://${route.subdomain}`}><ExternalLink size={11} /></a>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecordsPanel(props: {
  zoneName: string; zones: DnsZone[]; zoneId: string; setZoneId: (id: string) => void; records: DnsRecord[]; filtered: DnsRecord[]
  typeCounts: Record<string, number>; typeFilter: string; setTypeFilter: (t: string) => void
  loading: boolean; error: Error | null | undefined; dataError?: string; onRetry: () => void; cfConfigured: boolean; isAdmin: boolean; busyRecord: string | null
  orphaned: DnsRecord[]; missing: { fqdn: string; route: string }[]; syncing: boolean; onSync: () => void; onAdd: () => void
  onEdit: (r: DnsRecord) => void; onDelete: (r: DnsRecord) => void; onToggleProxy: (r: DnsRecord) => void; searchQuery: string
}) {
  const { zoneName, zones, zoneId, setZoneId, records, filtered, typeCounts, typeFilter, setTypeFilter, loading, error, dataError, onRetry, cfConfigured, isAdmin, busyRecord,
    orphaned, missing, syncing, onSync, onAdd, onEdit, onDelete, onToggleProxy, searchQuery } = props
  const types = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', ...Object.keys(typeCounts).filter((t) => !['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS'].includes(t)).sort()]

  if (!cfConfigured) {
    return (
      <div className="glass border border-white/5 rounded-xl">
        <EmptyState icon={<CloudOff size={28} className="text-slate-500" />} title="DNS records appear here once Cloudflare is connected" hint="Store the API token as the secret CF_DNS_API_TOKEN" />
      </div>
    )
  }

  return (
    <div className="glass border border-white/5 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 md:px-5 py-3 border-b border-white/5 bg-slate-900/40 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Globe size={14} className="text-emerald-400 shrink-0" />
          {zones.length > 1 ? (
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="bg-slate-950/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none">
              <option value="">{zoneName} (DCS domain)</option>
              {zones.filter((z) => z.name !== zoneName).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          ) : (
            <span className="text-sm font-semibold text-slate-200 truncate">{zoneName}</span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500 border border-white/5 whitespace-nowrap">{records.length} record{records.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setTypeFilter('')} className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-all ${!typeFilter ? 'bg-white/[0.08] text-slate-100 border-white/10' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>All</button>
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)} className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-all ${typeFilter === t ? typeClass(t) : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
              {t}{typeCounts[t] ? <span className="ml-1 opacity-70">{typeCounts[t]}</span> : null}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          {orphaned.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/15" title="Records DCS created whose route no longer exists">{orphaned.length} orphaned</span>}
          {isAdmin && missing.length > 0 && (
            <button onClick={onSync} disabled={syncing} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-50" title={missing.map((m) => m.fqdn).join(', ')}>
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Create {missing.length} missing
            </button>
          )}
          {isAdmin && (
            <button onClick={onAdd} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/25 transition-all">
              <Plus size={12} /> Add
            </button>
          )}
        </div>
      </div>

      {loading && records.length === 0 && !dataError ? (
        <LoadingState label="Loading records from Cloudflare…" />
      ) : dataError ? (
        <ErrorState title="Cloudflare zone unavailable" error={dataError} onRetry={onRetry} />
      ) : error && records.length === 0 ? (
        <ErrorState title="Records could not be loaded" error={error} onRetry={onRetry} />
      ) : records.length === 0 ? (
        <EmptyState icon={<Globe size={28} className="text-slate-500" />} title="The zone has no records" hint="Add one, or deploy a template to create routes" action={isAdmin ? <button onClick={onAdd} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25"><Plus size={12} /> Add record</button> : undefined} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={20} className="text-slate-500" />} title={searchQuery ? `No records match "${searchQuery}"` : `No ${typeFilter} records`} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-2 text-[10px] text-slate-500 uppercase tracking-wider w-20">Type</th>
                <th className="text-left px-4 py-2 text-[10px] text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2 text-[10px] text-slate-500 uppercase tracking-wider">Content</th>
                <th className="text-left px-4 py-2 text-[10px] text-slate-500 uppercase tracking-wider w-20">TTL</th>
                <th className="text-left px-4 py-2 text-[10px] text-slate-500 uppercase tracking-wider w-28">Proxy</th>
                <th className="text-right px-4 py-2 text-[10px] text-slate-500 uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.map((rec) => {
                const { head, tail } = displayName(rec, zoneName)
                const busy = busyRecord === rec.id
                const canProxy = rec.editable && PROXIABLE_TYPES.has(rec.type) && rec.proxiable
                return (
                  <tr key={rec.id} className="hover:bg-white/[0.03] transition-colors group/rec">
                    <td className="px-4 py-2.5 whitespace-nowrap"><span className={`inline-block px-1.5 py-px rounded border text-[10px] font-semibold ${typeClass(rec.type)}`}>{rec.type}</span></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="text-xs font-mono text-cyan-300 break-all">{head}</span>
                        {tail && <span className="text-[10px] text-slate-600 font-mono">{tail}</span>}
                        {rec.subdomain === '@' && <span className="text-[9px] px-1 py-px rounded bg-white/5 text-slate-500">root</span>}
                        {rec.route && <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded bg-cyan-500/10 text-cyan-300" title={`Traefik route ${rec.route}`}><Route size={9} /> {rec.route.split('/')[1]}</span>}
                        {rec.managed && !rec.route && rec.points_to_dcs && <span className="text-[9px] px-1.5 py-px rounded bg-amber-500/15 text-amber-400" title="DCS created this record but no route uses it any more">orphaned</span>}
                        {rec.managed && rec.route && <span className="text-[9px] px-1.5 py-px rounded bg-emerald-500/10 text-emerald-400">DCS</span>}
                        {rec.locked && <Lock size={9} className="text-slate-500" />}
                      </div>
                      {rec.comment && !rec.managed && <p className="text-[10px] text-slate-600 truncate max-w-[280px]" title={rec.comment}>{rec.comment}</p>}
                    </td>
                    <td className="px-4 py-2.5 max-w-[320px]">
                      <span className="text-xs text-slate-300 font-mono truncate block" title={rec.content}>{rec.type === 'MX' && rec.priority != null ? <span className="text-slate-500">{rec.priority} </span> : null}{rec.content}</span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap"><span className="text-[11px] text-slate-400">{ttlLabel(rec.ttl)}</span></td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {PROXIABLE_TYPES.has(rec.type) ? (
                        <button
                          onClick={() => canProxy && isAdmin && onToggleProxy(rec)} disabled={!canProxy || !isAdmin || busy}
                          className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${rec.proxied ? 'text-orange-300' : 'text-slate-400'} ${canProxy && isAdmin ? 'hover:opacity-80' : 'cursor-default'} disabled:opacity-60`}
                          title={!isAdmin ? undefined : !canProxy ? 'This record cannot be proxied' : rec.proxied ? 'Switch to DNS only' : 'Proxy through Cloudflare'}
                        >
                          {busy ? <Loader2 size={11} className="animate-spin" /> : (
                            <span className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${rec.proxied ? 'bg-orange-500' : 'bg-slate-700'}`}>
                              <span className={`inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform ${rec.proxied ? 'translate-x-3' : 'translate-x-0.5'}`} />
                            </span>
                          )}
                          {rec.proxied ? 'Proxied' : 'DNS only'}
                        </button>
                      ) : <span className="text-[10px] text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {isAdmin && (
                        <div className="inline-flex items-center gap-1 opacity-60 group-hover/rec:opacity-100 transition-opacity">
                          <button onClick={() => onEdit(rec)} disabled={!rec.editable || busy} className="p-1.5 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-40 disabled:hover:text-slate-500 disabled:hover:bg-transparent" title={rec.editable ? 'Edit record' : rec.locked ? 'Locked by Cloudflare' : `${rec.type} records are read-only here`}><Pencil size={12} /></button>
                          <button onClick={() => onDelete(rec)} disabled={!rec.editable || busy} className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40 disabled:hover:text-slate-500 disabled:hover:bg-transparent" title={rec.editable ? 'Delete record' : 'Read-only here'}><Trash2 size={12} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
