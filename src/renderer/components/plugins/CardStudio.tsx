// =============================================================================
// CardStudio — make a dashboard card without leaving the app
// =============================================================================
// Two ways in: a data card (pick an endpoint, a field and a widget; no code)
// or the code editor (any HTML/CSS/JS, with the API bridge). Both preview
// live and save as a card of a plugin through the API.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import * as Icons from 'lucide-react'
import { X, LayoutTemplate, Code, Database, Loader2, Play, Save, Trash2, FolderOpen, RefreshCw, Sparkles } from 'lucide-react'
import { apiClient } from '../../api/client'
import { fetchApiCatalogue, fetchPluginCards, fetchCardSource, saveCard, deleteCard } from '../../api/endpoints'
import { useToast } from '../common/Toast'
import { HtmlCardFrame } from '../dashboard/PluginFrame'

type Widget = 'number' | 'gauge' | 'list' | 'badge' | 'text'
interface DataSpec {
  path: string
  query: string
  field: string
  widget: Widget
  label: string
  unit: string
  max: number
  refresh: number
  itemLabel: string
  itemValue: string
}
const DEFAULT_SPEC: DataSpec = { path: '/status', query: '', field: 'docker.containers.running', widget: 'number', label: 'running containers', unit: '', max: 100, refresh: 30, itemLabel: 'name', itemValue: 'state' }
const ICON_CHOICES = ['Activity', 'Box', 'Boxes', 'Cpu', 'Database', 'Gauge', 'Globe', 'HardDrive', 'HeartPulse', 'Layers', 'Network', 'Server', 'Shield', 'Zap', 'Clock', 'Bell', 'Star', 'Sparkles', 'TrendingUp', 'BarChart3']

/** a.b[0].c on any JSON value */
export function getPath(obj: unknown, path: string): unknown {
  if (!path.trim()) return obj
  let cur: unknown = obj
  for (const part of path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) {
    if (cur === null || cur === undefined) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'card'
}

/** The generated data card: bridge fetch, one widget, refresh loop. No external assets. */
export function buildDataCardHtml(spec: DataSpec, title: string, icon: string): string {
  const cfg = JSON.stringify(spec)
  const iconSvg = '' // the header keeps to text: icons come from the dashboard card frame
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:transparent;color:#e2e8f0;height:100vh;overflow:hidden;padding:16px;display:flex;flex-direction:column}
.h{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:10px}
.h i{width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 8px rgba(52,211,153,.6)}
.big{font-size:clamp(1.6rem,7vw,2.8rem);font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;background:linear-gradient(135deg,#34d399,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1.1}
.unit{font-size:14px;color:#94a3b8;-webkit-text-fill-color:#94a3b8;margin-left:4px}
.sub{font-size:11px;color:#64748b;margin-top:6px}.err{color:#f87171;font-size:12px}
.ring{position:relative;width:104px;height:104px;margin:4px 0}.ring svg{transform:rotate(-90deg);width:100%;height:100%}.ring .v{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;font-variant-numeric:tabular-nums}
.list{overflow:auto;flex:1;min-height:0}.row{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.04);font-size:12px;margin-bottom:4px}.row b{font-weight:500;font-family:ui-monospace,SFMono-Regular,monospace;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row span{color:#94a3b8;font-size:11px;white-space:nowrap}
.pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600;background:rgba(52,211,153,.12);color:#34d399;border:1px solid rgba(52,211,153,.25);font-family:ui-monospace,monospace}
.txt{font-size:13px;color:#cbd5e1;line-height:1.5;white-space:pre-wrap;overflow:auto;flex:1;min-height:0}
.stamp{margin-top:auto;padding-top:8px;font-size:9px;color:#475569;letter-spacing:.06em;text-transform:uppercase}
</style></head><body>
<div class="h"><i></i>${title.replace(/</g, '&lt;')}</div>
<div id="out" class="sub">Loading…</div>
<div class="stamp" id="stamp"></div>
<script>
const CFG=${cfg};
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function get(o,p){if(!p)return o;var cur=o;p.replace(/\\[(\\d+)\\]/g,'.$1').split('.').filter(Boolean).forEach(function(k){cur=(cur==null)?undefined:cur[k]});return cur}
function fmt(v){if(typeof v==='number')return Number.isInteger(v)?v.toLocaleString():v.toFixed(1);if(v==null)return '—';if(typeof v==='object')return JSON.stringify(v);return String(v)}
function render(v){var out=document.getElementById('out');
  if(CFG.widget==='number'){out.className='';out.innerHTML='<div class="big">'+esc(fmt(v))+(CFG.unit?'<span class="unit">'+esc(CFG.unit)+'</span>':'')+'</div>'+(CFG.label?'<div class="sub">'+esc(CFG.label)+'</div>':'')}
  else if(CFG.widget==='gauge'){var n=parseFloat(v)||0,max=CFG.max||100,pct=Math.max(0,Math.min(100,n/max*100)),r=44,c=2*Math.PI*r,col=pct>85?'#f43f5e':pct>60?'#f59e0b':'#34d399';out.className='';out.innerHTML='<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="'+r+'" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="8"/><circle cx="50" cy="50" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+(c-c*pct/100)+'" style="transition:stroke-dashoffset .8s ease"/></svg><div class="v">'+esc(fmt(n))+esc(CFG.unit||'')+'</div></div>'+(CFG.label?'<div class="sub">'+esc(CFG.label)+'</div>':'')}
  else if(CFG.widget==='list'){var arr=Array.isArray(v)?v:(v&&typeof v==='object'?Object.keys(v).map(function(k){var o={};o[CFG.itemLabel||'name']=k;o[CFG.itemValue||'value']=v[k];return o}):[]);out.className='list';out.innerHTML=arr.length?arr.slice(0,40).map(function(it){var l=typeof it==='object'?get(it,CFG.itemLabel):it,val=typeof it==='object'?get(it,CFG.itemValue):'';return '<div class="row"><b>'+esc(fmt(l))+'</b><span>'+esc(fmt(val))+'</span></div>'}).join(''):'<div class="sub">Nothing to show</div>'}
  else if(CFG.widget==='badge'){out.className='';out.innerHTML='<span class="pill">'+esc(fmt(v))+'</span>'+(CFG.label?'<div class="sub">'+esc(CFG.label)+'</div>':'')}
  else{out.className='txt';out.textContent=typeof v==='object'?JSON.stringify(v,null,2):fmt(v)}
  document.getElementById('stamp').textContent='updated '+new Date().toLocaleTimeString()}
async function load(){try{var r=await window.dcs.fetch(CFG.path+(CFG.query?'?'+CFG.query:''));if(!r.ok)throw new Error('HTTP '+r.status);var d=await r.json();render(get(d,CFG.field))}catch(e){document.getElementById('out').innerHTML='<span class="err">'+esc(e.message||e)+'</span>'}}
load();if(CFG.refresh>0)setInterval(load,Math.max(5,CFG.refresh)*1000);
</script></body></html>`
}

const CODE_TEMPLATE = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:transparent;color:#e2e8f0;height:100vh;overflow:hidden;padding:16px;display:flex;flex-direction:column}
.h{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:10px}
.big{font-size:2.4rem;font-weight:700;background:linear-gradient(135deg,#34d399,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
</style></head><body>
<div class="h">My card</div>
<div class="big" id="value">…</div>
<script>
// window.dcs.fetch('/status') — any GET endpoint, answered with your session.
// fetch('/status') works the same way.
(async () => {
  const r = await window.dcs.fetch('/status');
  const s = await r.json();
  document.getElementById('value').textContent = s.docker.containers.running + ' running';
})();
</script></body></html>`

export default function CardStudio({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const { addToast } = useToast()
  const [mode, setMode] = useState<'data' | 'code'>('data')
  const [title, setTitle] = useState('My card')
  const [plugin, setPlugin] = useState('my-cards')
  const [cardId, setCardId] = useState('')
  const [icon, setIcon] = useState('Activity')
  const [w, setW] = useState(6)
  const [h, setH] = useState(4)
  const [spec, setSpec] = useState<DataSpec>(DEFAULT_SPEC)
  const [html, setHtml] = useState(CODE_TEMPLATE)
  const [catalogue, setCatalogue] = useState<{ path: string; description: string }[]>([])
  const [sample, setSample] = useState<unknown>(undefined)
  const [sampleError, setSampleError] = useState('')
  const [sampling, setSampling] = useState(false)
  const [existing, setExisting] = useState<{ id: string; title: string; plugin: string; card: string }[]>([])
  const [loadedFrom, setLoadedFrom] = useState<{ plugin: string; card: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  useEffect(() => {
    fetchApiCatalogue().then((c) => setCatalogue((c.endpoints || []).filter((e) => e.method === 'GET' && !e.path.includes('{') && !e.path.includes('*') && !['/', '/stream', '/logs/live'].includes(e.path)).map((e) => ({ path: e.path, description: e.description })))).catch(() => {})
    fetchPluginCards().then((r) => setExisting((r.cards || []).map((c) => { const [, p, ...rest] = c.id.split(':'); return { id: c.id, title: c.title, plugin: p, card: rest.join(':') } }))).catch(() => {})
  }, [])

  const effectiveId = cardId || slug(title)
  const fieldValue = useMemo(() => (sample === undefined ? undefined : getPath(sample, spec.field)), [sample, spec.field])
  const generated = useMemo(() => (mode === 'data' ? buildDataCardHtml(spec, title, icon) : html), [mode, spec, title, icon, html])

  const fetchSample = useCallback(async () => {
    setSampling(true); setSampleError('')
    try {
      const data = await apiClient.get<unknown>(spec.path + (spec.query ? `?${spec.query}` : ''))
      setSample(data)
    } catch (err) {
      setSample(undefined); setSampleError(err instanceof Error ? err.message : 'request failed')
    } finally { setSampling(false) }
  }, [spec.path, spec.query])
  useEffect(() => { if (mode === 'data') void fetchSample() }, [mode, fetchSample])

  const loadExisting = async (id: string) => {
    const e = existing.find((x) => x.id === id)
    if (!e) return
    try {
      const src = await fetchCardSource(e.plugin, e.card)
      setMode('code'); setHtml(src.html); setTitle(String(src.meta.title || e.title)); setPlugin(e.plugin); setCardId(e.card)
      setIcon(String(src.meta.icon || 'Activity')); setW(Number(src.meta.defaultW) || 6); setH(Number(src.meta.defaultH) || 4)
      setLoadedFrom({ plugin: e.plugin, card: e.card }); setPreviewKey((k) => k + 1)
    } catch (err) { addToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not load the card' }) }
  }

  const handleSave = async () => {
    if (!title.trim() || !plugin.trim()) return
    setSaving(true)
    try {
      const meta = { title: title.trim(), icon, description: mode === 'data' ? `${spec.widget} of ${spec.field || 'response'} from ${spec.path}` : 'Custom card', defaultW: w, defaultH: h, minW: 3, minH: 2, maxW: 24, maxH: 16, refreshInterval: 0, author: 'You', version: '1.0.0', ...(mode === 'data' ? { studio: spec } : {}) }
      const res = await saveCard(slug(plugin), effectiveId, { meta, html: generated })
      addToast({ type: 'success', message: `Saved ${title}. Add it to the dashboard from Edit → Card.`, duration: 7000 })
      setLoadedFrom({ plugin: slug(plugin), card: effectiveId })
      setExisting((l) => (l.some((x) => x.id === res.id) ? l : [...l, { id: res.id, title: title.trim(), plugin: slug(plugin), card: effectiveId }]))
      onSaved?.()
    } catch (err) { addToast({ type: 'error', message: err instanceof Error ? err.message : 'Save failed', duration: 8000 }) }
    finally { setSaving(false) }
  }
  const handleDelete = async () => {
    if (!loadedFrom || !window.confirm(`Delete the card ${loadedFrom.plugin}/${loadedFrom.card}?`)) return
    try {
      await deleteCard(loadedFrom.plugin, loadedFrom.card)
      setExisting((l) => l.filter((x) => !(x.plugin === loadedFrom.plugin && x.card === loadedFrom.card)))
      setLoadedFrom(null); addToast({ type: 'success', message: 'Card deleted' }); onSaved?.()
    } catch (err) { addToast({ type: 'error', message: err instanceof Error ? err.message : 'Delete failed' }) }
  }

  const field = 'w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 transition-colors'
  const label = 'block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1'
  const IconPreview = ((Icons as unknown as Record<string, React.ElementType>)[icon] ?? Icons.Activity) as React.ElementType

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-6xl mx-4 h-[92vh] flex flex-col bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/10"><LayoutTemplate size={16} className="text-violet-400" /></span>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Card Studio</h3>
              <p className="text-[11px] text-slate-500">Build a dashboard card from an endpoint, or write one. It saves as a plugin card.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {existing.length > 0 && (
              <select value={loadedFrom ? `plugin:${loadedFrom.plugin}:${loadedFrom.card}` : ''} onChange={(e) => void loadExisting(e.target.value)} className="px-2 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-xs text-slate-200 focus:outline-none" title="Open an existing card">
                <option value="">Open existing…</option>
                {existing.map((c) => <option key={c.id} value={c.id}>{c.title} · {c.plugin}</option>)}
              </select>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left: definition */}
          <div className="min-h-0 overflow-y-auto scrollbar-thin px-6 py-4 space-y-4 border-b lg:border-b-0 lg:border-r border-white/5">
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              <button onClick={() => setMode('data')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${mode === 'data' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'}`}><Database size={13} /> Data card</button>
              <button onClick={() => setMode('code')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-white/10 ${mode === 'code' ? 'bg-violet-500/15 text-violet-300' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'}`}><Code size={13} /> Code</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={label}>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="My card" /></div>
              <div><label className={label}>Plugin</label><input value={plugin} onChange={(e) => setPlugin(e.target.value)} className={`${field} font-mono`} placeholder="my-cards" title="Cards are grouped in a plugin; a new name creates one" /></div>
              <div><label className={label}>Card id</label><input value={cardId} onChange={(e) => setCardId(slug(e.target.value))} className={`${field} font-mono`} placeholder={slug(title)} /></div>
              <div><label className={label}>Icon</label><div className="flex items-center gap-2"><span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-300 shrink-0"><IconPreview size={14} /></span><select value={icon} onChange={(e) => setIcon(e.target.value)} className={`${field} bg-slate-800`}>{ICON_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}</select></div></div>
              <div><label className={label}>Default size</label><div className="flex items-center gap-2"><input type="number" min={3} max={24} value={w} onChange={(e) => setW(Math.max(3, Math.min(24, Number(e.target.value) || 6)))} className={field} /><span className="text-slate-600 text-xs">×</span><input type="number" min={2} max={16} value={h} onChange={(e) => setH(Math.max(2, Math.min(16, Number(e.target.value) || 4)))} className={field} /></div></div>
            </div>

            {mode === 'data' ? (
              <div className="space-y-3">
                <div>
                  <label className={label}>Endpoint</label>
                  <div className="flex gap-2">
                    <select value={spec.path} onChange={(e) => setSpec({ ...spec, path: e.target.value })} className={`${field} bg-slate-800 font-mono`}>
                      {!catalogue.some((c) => c.path === spec.path) && <option value={spec.path}>{spec.path}</option>}
                      {catalogue.map((c) => <option key={c.path} value={c.path} title={c.description}>{c.path}</option>)}
                    </select>
                    <button onClick={() => void fetchSample()} disabled={sampling} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 disabled:opacity-50 shrink-0">{sampling ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Fetch</button>
                  </div>
                  {catalogue.find((c) => c.path === spec.path)?.description && <p className="text-[10px] text-slate-500 mt-1">{catalogue.find((c) => c.path === spec.path)?.description}</p>}
                </div>
                <div><label className={label}>Query string <span className="normal-case tracking-normal text-slate-600">(optional)</span></label><input value={spec.query} onChange={(e) => setSpec({ ...spec, query: e.target.value.replace(/^\?/, '') })} className={`${field} font-mono`} placeholder="range=24h" /></div>
                <div>
                  <label className={label}>Field <span className="normal-case tracking-normal text-slate-600">(a.b[0].c — empty for the whole response)</span></label>
                  <input value={spec.field} onChange={(e) => setSpec({ ...spec, field: e.target.value.trim() })} className={`${field} font-mono`} placeholder="docker.containers.running" />
                  <div className="mt-1.5 rounded-lg bg-slate-950/60 border border-white/5 px-3 py-2 text-[11px] font-mono text-slate-300 max-h-32 overflow-auto scrollbar-thin whitespace-pre-wrap break-all">
                    {sampleError ? <span className="text-rose-400">{sampleError}</span> : sample === undefined ? <span className="text-slate-600">Fetch the endpoint to see its data</span> : fieldValue === undefined ? <span className="text-amber-300">Nothing at that field. Top-level keys: {Object.keys((sample as object) || {}).join(', ')}</span> : JSON.stringify(fieldValue, null, 1).slice(0, 1200)}
                  </div>
                </div>
                <div>
                  <label className={label}>Widget</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(['number', 'gauge', 'list', 'badge', 'text'] as Widget[]).map((wg) => (
                      <button key={wg} onClick={() => setSpec({ ...spec, widget: wg })} className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${spec.widget === wg ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'border-white/10 text-slate-400 hover:text-slate-200'}`}>{wg}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(spec.widget === 'number' || spec.widget === 'gauge' || spec.widget === 'badge') && <div><label className={label}>Label under the value</label><input value={spec.label} onChange={(e) => setSpec({ ...spec, label: e.target.value })} className={field} placeholder="running containers" /></div>}
                  {(spec.widget === 'number' || spec.widget === 'gauge') && <div><label className={label}>Unit</label><input value={spec.unit} onChange={(e) => setSpec({ ...spec, unit: e.target.value })} className={field} placeholder="%, GB, ms…" /></div>}
                  {spec.widget === 'gauge' && <div><label className={label}>Full scale</label><input type="number" value={spec.max} onChange={(e) => setSpec({ ...spec, max: Number(e.target.value) || 100 })} className={field} /></div>}
                  {spec.widget === 'list' && <><div><label className={label}>Item label field</label><input value={spec.itemLabel} onChange={(e) => setSpec({ ...spec, itemLabel: e.target.value.trim() })} className={`${field} font-mono`} placeholder="name" /></div><div><label className={label}>Item value field</label><input value={spec.itemValue} onChange={(e) => setSpec({ ...spec, itemValue: e.target.value.trim() })} className={`${field} font-mono`} placeholder="state" /></div></>}
                  <div><label className={label}>Refresh every (s)</label><input type="number" min={0} value={spec.refresh} onChange={(e) => setSpec({ ...spec, refresh: Math.max(0, Number(e.target.value) || 0) })} className={field} /></div>
                </div>
                <button onClick={() => { setHtml(generated); setMode('code') }} className="flex items-center gap-1.5 text-[11px] text-violet-300 hover:text-violet-200 transition-colors"><Sparkles size={12} /> Open the generated code to customise it</button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className={label}>HTML, CSS and JS <span className="normal-case tracking-normal text-slate-600">(one file · use window.dcs.fetch('/path') or fetch('/path') for data)</span></label>
                <textarea value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false} className="w-full h-[46vh] resize-y rounded-lg bg-slate-950/70 border border-white/10 p-3 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-violet-500/40 leading-relaxed" />
              </div>
            )}
          </div>

          {/* Right: preview */}
          <div className="min-h-0 flex flex-col px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className={label + ' mb-0'}>Live preview</span>
              <button onClick={() => setPreviewKey((k) => k + 1)} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"><Play size={11} /> Re-run</button>
            </div>
            <div className="flex-1 min-h-0 rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden" style={{ minHeight: '16rem' }}>
              <HtmlCardFrame key={previewKey} html={generated} title="Preview" />
            </div>
            <p className="text-[10px] text-slate-500 mt-2">The preview runs exactly like a dashboard card: sandboxed, with API requests answered by your session.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-white/5">
          {loadedFrom && <button onClick={() => void handleDelete()} className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors"><Trash2 size={12} /> Delete card</button>}
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5"><FolderOpen size={12} /> Saves to .plugins/{slug(plugin)}/cards/{effectiveId}</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors">Close</button>
            <button onClick={() => void handleSave()} disabled={saving || !title.trim() || !plugin.trim()} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {loadedFrom ? 'Save changes' : 'Save card'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
