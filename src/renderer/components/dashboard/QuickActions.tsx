// =============================================================================
// QuickActions — the dashboard's shortcut tiles, composed by the user
// =============================================================================
// Pages, links, stack and container controls, maintenance jobs, schedules and
// automations. The list lives in the dashboard layout (per user) and is edited
// in place; the defaults are the shortcuts the card always had.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import * as Icons from 'lucide-react'
import {
  Zap, Settings2, X, Plus, ArrowUp, ArrowDown, Trash2, Loader2, RotateCcw, ChevronDown,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { useAuthStore } from '../../stores/authStore'
import { useStackStore } from '../../stores/stackStore'
import { useContainerStore } from '../../stores/containerStore'
import { useHealthStore } from '../../stores/healthStore'
import { useToast } from '../common/Toast'
import {
  runImagePrune, triggerLogRotate, fetchHealthReport, triggerBackup,
  startStack, stopStack, restartStack, updateStack,
  startContainer, stopContainer, restartContainer, recreateContainer,
  fetchSchedules, runSchedule, fetchAutomations, runAutomation,
} from '../../api/endpoints'
import type { PageId } from '../../../shared/types'
import { ADMIN_ONLY_PAGES } from '../../../shared/types'
import { pageTitles } from '../../constants/pageTitles'
import { ACCENTS, ACCENT_NAMES, CardEmpty, type CardCommonProps } from './cardShared'

export type ActionKind = 'page' | 'url' | 'stack' | 'container' | 'maintenance' | 'schedule' | 'automation'
export interface ActionDef {
  id: string
  kind: ActionKind
  label: string
  icon: string
  color: string
  /** page id, URL, stack name, container name, maintenance job, schedule id or automation id */
  target: string
  /** stack: start|stop|restart|update — container: start|stop|restart|recreate */
  op?: string
}

const KIND_LABEL: Record<ActionKind, string> = {
  page: 'Open a page', url: 'Open a link', stack: 'Stack control', container: 'Container control',
  maintenance: 'Maintenance job', schedule: 'Run a schedule', automation: 'Run an automation',
}
const MAINTENANCE_JOBS: { id: string; label: string; icon: string; color: string }[] = [
  { id: 'prune-images', label: 'Prune Images', icon: 'Trash2', color: 'orange' },
  { id: 'rotate-logs', label: 'Rotate Logs', icon: 'Archive', color: 'pink' },
  { id: 'check-health', label: 'Check Health', icon: 'HeartPulse', color: 'emerald' },
  { id: 'run-backup', label: 'Run Backup', icon: 'Download', color: 'cyan' },
]
const ICON_CHOICES = ['Layers', 'HeartPulse', 'ScrollText', 'Monitor', 'Settings2', 'Box', 'TerminalSquare', 'Wrench', 'Archive', 'Trash2', 'Download', 'ListChecks', 'ArrowUpCircle', 'Zap', 'Play', 'Square', 'RotateCw', 'RefreshCw', 'Globe', 'Link', 'Rocket', 'Bell', 'Clock', 'Shield', 'Database', 'FolderOpen', 'Image', 'Network', 'HardDrive', 'Activity', 'Bookmark', 'Star', 'Cloud', 'Server', 'Cpu', 'Key']
const STACK_OPS = ['start', 'stop', 'restart', 'update']
const CONTAINER_OPS = ['start', 'stop', 'restart', 'recreate']

export const DEFAULT_ACTIONS: ActionDef[] = [
  { id: 'stacks', kind: 'page', label: 'Manage Stacks', icon: 'Layers', color: 'emerald', target: 'stacks' },
  { id: 'health', kind: 'page', label: 'Health Monitor', icon: 'HeartPulse', color: 'rose', target: 'health' },
  { id: 'logs', kind: 'page', label: 'View Logs', icon: 'ScrollText', color: 'amber', target: 'logs' },
  { id: 'system', kind: 'page', label: 'System Info', icon: 'Monitor', color: 'cyan', target: 'system' },
  { id: 'config', kind: 'page', label: 'Server Config', icon: 'Settings2', color: 'violet', target: 'config' },
  { id: 'containers', kind: 'page', label: 'Containers', icon: 'Box', color: 'blue', target: 'containers' },
  { id: 'terminal', kind: 'page', label: 'Terminal', icon: 'TerminalSquare', color: 'slate', target: 'terminal' },
  { id: 'maintenance', kind: 'page', label: 'Maintenance', icon: 'Wrench', color: 'amber', target: 'maintenance' },
  { id: 'backup', kind: 'page', label: 'Backup', icon: 'Archive', color: 'teal', target: 'backup' },
  { id: 'prune-images', kind: 'maintenance', label: 'Prune Images', icon: 'Trash2', color: 'orange', target: 'prune-images' },
  { id: 'rotate-logs', kind: 'maintenance', label: 'Rotate Logs', icon: 'Archive', color: 'pink', target: 'rotate-logs' },
  { id: 'check-health', kind: 'maintenance', label: 'Check Health', icon: 'HeartPulse', color: 'emerald', target: 'check-health' },
  { id: 'run-backup', kind: 'maintenance', label: 'Run Backup', icon: 'Download', color: 'cyan', target: 'run-backup' },
  { id: 'lint-stacks', kind: 'page', label: 'Lint All Stacks', icon: 'ListChecks', color: 'cyan', target: 'stacks' },
  { id: 'check-updates', kind: 'page', label: 'Check Updates', icon: 'ArrowUpCircle', color: 'emerald', target: 'updates' },
]

function iconFor(name: string): React.ElementType {
  return ((Icons as unknown as Record<string, React.ElementType>)[name] ?? Zap) as React.ElementType
}
function newId(): string { return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }
function sanitize(list: unknown): ActionDef[] | null {
  if (!Array.isArray(list)) return null
  const out: ActionDef[] = []
  for (const a of list) {
    if (!a || typeof a !== 'object') continue
    const d = a as Partial<ActionDef>
    if (!d.kind || !(d.kind in KIND_LABEL) || typeof d.label !== 'string' || typeof d.target !== 'string') continue
    out.push({ id: typeof d.id === 'string' ? d.id : newId(), kind: d.kind, label: d.label, icon: typeof d.icon === 'string' ? d.icon : 'Zap', color: ACCENT_NAMES.includes(d.color || '') ? (d.color as string) : 'cyan', target: d.target, op: typeof d.op === 'string' ? d.op : undefined })
  }
  return out
}

export default function QuickActions({ collapsible = false, cardConfig, onSaveConfig, dashboardEditMode }: { collapsible?: boolean } & CardCommonProps) {
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const isConnected = useConnectionStore((s) => s.status) === 'connected'
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const setHealthReport = useHealthStore((s) => s.setReport)
  const refreshContainers = useContainerStore((s) => s.refresh)
  const { addToast } = useToast()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false
    try { return localStorage.getItem('dash-quickactions-collapsed') === 'true' } catch { return false }
  })

  const actions = useMemo(() => {
    const cfg = cardConfig as { actions?: unknown } | undefined
    return sanitize(cfg?.actions) ?? DEFAULT_ACTIONS
  }, [cardConfig])
  const isCustom = !!sanitize((cardConfig as { actions?: unknown } | undefined)?.actions)

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('dash-quickactions-collapsed', String(next)) } catch { /* private mode */ }
  }

  const run = useCallback(async (a: ActionDef) => {
    if (a.kind === 'page') { setCurrentPage(a.target as PageId); return }
    if (a.kind === 'url') { if (/^https?:\/\//i.test(a.target)) window.open(a.target, '_blank', 'noopener'); return }
    if (!isConnected || loadingAction) return
    const needsConfirm = (a.kind === 'stack' && a.op !== 'start') || (a.kind === 'container' && a.op !== 'start') || (a.kind === 'maintenance' && a.target !== 'check-health')
    if (needsConfirm && !window.confirm(`${a.label}: run this now?`)) return
    setLoadingAction(a.id)
    try {
      if (a.kind === 'maintenance') {
        if (a.target === 'prune-images') { const r = await runImagePrune(); addToast({ type: r.success ? 'success' : 'error', message: r.success ? 'Stale images pruned' : 'Image prune failed' }) }
        else if (a.target === 'rotate-logs') { const r = await triggerLogRotate(); addToast({ type: r.success ? 'success' : 'error', message: r.success ? `Logs rotated${r.archived_as ? ` — archived as ${r.archived_as}` : ''}` : 'Log rotation failed' }) }
        else if (a.target === 'check-health') { const rep = await fetchHealthReport(); setHealthReport(rep); const n = rep.summary?.unhealthy ?? 0; addToast({ type: n > 0 ? 'warning' : 'success', message: n > 0 ? `${n} container${n === 1 ? '' : 's'} need attention` : 'Everything is healthy' }) }
        else if (a.target === 'run-backup') { const r = await triggerBackup(); addToast({ type: r.success ? 'success' : 'error', message: r.success ? 'Backup started' : (r.message || 'Backup failed') }) }
      } else if (a.kind === 'stack') {
        const fn = { start: startStack, stop: stopStack, restart: restartStack, update: updateStack }[a.op || 'start'] ?? startStack
        const r = await fn(a.target)
        addToast({ type: r.success ? 'success' : 'error', message: r.success ? `${a.target}: ${a.op || 'start'} done` : `${a.target}: ${a.op || 'start'} failed` })
        void refreshContainers()
      } else if (a.kind === 'container') {
        const fn = { start: startContainer, stop: stopContainer, restart: restartContainer, recreate: recreateContainer }[a.op || 'start'] ?? startContainer
        const r = await fn(a.target)
        addToast({ type: r.success ? 'success' : 'error', message: r.success ? `${a.target}: ${a.op || 'start'} done` : `${a.target}: ${r.output || 'failed'}`, duration: r.success ? 3500 : 8000 })
        void refreshContainers()
      } else if (a.kind === 'schedule') {
        const r = await runSchedule(a.target)
        addToast({ type: r.success ? 'success' : 'error', message: r.success ? `${a.label} ran` : `${a.label} failed: ${r.output || ''}` })
      } else if (a.kind === 'automation') {
        const r = await runAutomation(a.target)
        addToast({ type: r.success ? 'success' : 'error', message: r.message || (r.success ? `${a.label} ran` : `${a.label} failed`) })
      }
    } catch (err) {
      addToast({ type: 'error', message: `${a.label}: ${err instanceof Error ? err.message : 'request failed'}` })
    } finally {
      setLoadingAction(null)
    }
  }, [setCurrentPage, isConnected, loadingAction, addToast, setHealthReport, refreshContainers])

  const visible = actions.filter((a) => {
    if (a.kind === 'page' && ADMIN_ONLY_PAGES.has(a.target as PageId) && !isAdmin) return false
    if ((a.kind === 'stack' || a.kind === 'container' || a.kind === 'maintenance' || a.kind === 'schedule' || a.kind === 'automation') && !isAdmin) return false
    return true
  })
  const canEdit = !!onSaveConfig && !dashboardEditMode

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={15} className="text-amber-400" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Quick Actions</h3>
        {isCustom && <span className="text-[9px] uppercase tracking-wider text-slate-600">custom</span>}
        <div className="ml-auto flex items-center gap-1">
          {canEdit && (
            <button onClick={() => setEditing(true)} className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors" title="Customize the actions">
              <Settings2 size={13} />
            </button>
          )}
          {collapsible && (
            <button onClick={toggleCollapsed} className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors" title={collapsed ? 'Expand' : 'Collapse'}>
              <ChevronDown size={13} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            </button>
          )}
        </div>
      </div>
      {!collapsed && (visible.length === 0 ? (
        <CardEmpty icon={<Zap size={22} />} title="No actions" hint="Add the shortcuts you use most." action={canEdit ? <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">Add actions</button> : undefined} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 grid gap-1.5 content-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }}>
          {visible.map((a) => {
            const acc = ACCENTS[a.color] ?? ACCENTS.cyan
            const Icon = iconFor(a.icon)
            const busy = loadingAction === a.id
            const disabled = (a.kind !== 'page' && a.kind !== 'url') && (!isConnected || !!loadingAction)
            return (
              <button
                key={a.id}
                onClick={() => run(a)}
                disabled={disabled}
                className="group flex items-center gap-2 rounded-lg px-2.5 py-2 border border-white/[0.03] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 text-left transition-all disabled:opacity-40 press"
                title={a.kind === 'url' ? a.target : a.kind === 'stack' || a.kind === 'container' ? `${a.op || 'start'} ${a.target}` : a.label}
              >
                <span className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${acc.bg} ${acc.text}`}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-slate-200 truncate">{a.label}</span>
                  {(a.kind === 'stack' || a.kind === 'container') && <span className="block text-[10px] text-slate-500 truncate">{a.op || 'start'} · {a.target}</span>}
                </span>
              </button>
            )
          })}
        </div>
      ))}
      {editing && <ActionsEditor initial={actions} isAdmin={isAdmin} onClose={() => setEditing(false)} onSave={async (list) => { await onSaveConfig?.({ actions: list }); setEditing(false); addToast({ type: 'success', message: 'Quick actions saved' }) }} onReset={async () => { await onSaveConfig?.({}); setEditing(false); addToast({ type: 'success', message: 'Quick actions reset to the defaults' }) }} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function ActionsEditor({ initial, isAdmin, onClose, onSave, onReset }: {
  initial: ActionDef[]
  isAdmin: boolean
  onClose: () => void
  onSave: (list: ActionDef[]) => Promise<void> | void
  onReset: () => Promise<void> | void
}) {
  const [list, setList] = useState<ActionDef[]>(initial.map((a) => ({ ...a })))
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const stacks = useStackStore((s) => s.stacks)
  const containers = useContainerStore((s) => s.containers)
  const [schedules, setSchedules] = useState<{ id: string; name: string }[]>([])
  const [automations, setAutomations] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  useEffect(() => {
    if (!isAdmin) return
    fetchSchedules().then((r) => setSchedules((r.schedules ?? []).map((s) => ({ id: s.id, name: s.name })))).catch(() => {})
    fetchAutomations().then((r) => setAutomations((r.automations ?? []).map((a) => ({ id: a.id, name: a.name })))).catch(() => {})
  }, [isAdmin])

  const update = (id: string, patch: Partial<ActionDef>) => setList((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const move = (i: number, dir: -1 | 1) => setList((l) => { const n = [...l]; const j = i + dir; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n })
  const add = (kind: ActionKind) => {
    const base: ActionDef = { id: newId(), kind, label: KIND_LABEL[kind], icon: 'Zap', color: 'cyan', target: '' }
    if (kind === 'page') Object.assign(base, { label: 'Dashboard', target: 'dashboard', icon: 'LayoutDashboard' })
    if (kind === 'url') Object.assign(base, { label: 'My link', target: 'https://', icon: 'Link' })
    if (kind === 'stack') Object.assign(base, { label: stacks[0] ? `Restart ${stacks[0].name}` : 'Restart stack', target: stacks[0]?.name ?? '', op: 'restart', icon: 'RotateCw', color: 'amber' })
    if (kind === 'container') Object.assign(base, { label: containers[0] ? `Restart ${containers[0].name}` : 'Restart container', target: containers[0]?.name ?? '', op: 'restart', icon: 'RotateCw', color: 'amber' })
    if (kind === 'maintenance') Object.assign(base, { label: MAINTENANCE_JOBS[0].label, target: MAINTENANCE_JOBS[0].id, icon: MAINTENANCE_JOBS[0].icon, color: MAINTENANCE_JOBS[0].color })
    if (kind === 'schedule') Object.assign(base, { label: schedules[0]?.name ?? 'Schedule', target: schedules[0]?.id ?? '', icon: 'Clock', color: 'violet' })
    if (kind === 'automation') Object.assign(base, { label: automations[0]?.name ?? 'Automation', target: automations[0]?.id ?? '', icon: 'Zap', color: 'amber' })
    setList((l) => [...l, base])
    setAdding(false)
  }
  const valid = list.every((a) => a.label.trim() && a.target.trim())
  const kinds: ActionKind[] = isAdmin ? ['page', 'url', 'stack', 'container', 'maintenance', 'schedule', 'automation'] : ['page', 'url']
  const field = 'px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/40'

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl mx-4 max-h-[88vh] flex flex-col bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/10"><Zap size={16} className="text-amber-400" /></span>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Quick actions</h3>
              <p className="text-[11px] text-slate-500">Your shortcuts, in your order. Saved to your dashboard.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5"><X size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-6 py-4 space-y-2">
          {list.length === 0 && <p className="text-xs text-slate-500 text-center py-6">No actions yet — add one below.</p>}
          {list.map((a, i) => {
            const acc = ACCENTS[a.color] ?? ACCENTS.cyan
            const Icon = iconFor(a.icon)
            return (
              <div key={a.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${acc.bg} ${acc.text}`}><Icon size={14} /></span>
                  <input value={a.label} onChange={(e) => update(a.id, { label: e.target.value })} placeholder="Label" className={`${field} flex-1 min-w-0`} />
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0 hidden sm:inline">{KIND_LABEL[a.kind]}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-white/5 disabled:opacity-30" title="Move up"><ArrowUp size={12} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-white/5 disabled:opacity-30" title="Move down"><ArrowDown size={12} /></button>
                    <button onClick={() => setList((l) => l.filter((x) => x.id !== a.id))} className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10" title="Remove"><Trash2 size={12} /></button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.kind === 'page' && (
                    <select value={a.target} onChange={(e) => update(a.id, { target: e.target.value })} className={`${field} bg-slate-800`}>
                      {(Object.keys(pageTitles) as PageId[]).filter((p) => isAdmin || !ADMIN_ONLY_PAGES.has(p)).map((p) => <option key={p} value={p}>{pageTitles[p]}</option>)}
                    </select>
                  )}
                  {a.kind === 'url' && <input value={a.target} onChange={(e) => update(a.id, { target: e.target.value })} placeholder="https://…" spellCheck={false} className={`${field} flex-1 min-w-[12rem] font-mono`} />}
                  {a.kind === 'stack' && (
                    <>
                      <select value={a.op || 'start'} onChange={(e) => update(a.id, { op: e.target.value })} className={`${field} bg-slate-800`}>{STACK_OPS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                      <select value={a.target} onChange={(e) => update(a.id, { target: e.target.value })} className={`${field} bg-slate-800 font-mono`}>
                        {!stacks.some((s) => s.name === a.target) && <option value={a.target}>{a.target || 'choose a stack'}</option>}
                        {stacks.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                      </select>
                    </>
                  )}
                  {a.kind === 'container' && (
                    <>
                      <select value={a.op || 'start'} onChange={(e) => update(a.id, { op: e.target.value })} className={`${field} bg-slate-800`}>{CONTAINER_OPS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                      <select value={a.target} onChange={(e) => update(a.id, { target: e.target.value })} className={`${field} bg-slate-800 font-mono`}>
                        {!containers.some((c) => c.name === a.target) && <option value={a.target}>{a.target || 'choose a container'}</option>}
                        {containers.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </>
                  )}
                  {a.kind === 'maintenance' && (
                    <select value={a.target} onChange={(e) => { const job = MAINTENANCE_JOBS.find((j) => j.id === e.target.value); update(a.id, { target: e.target.value, ...(job ? { label: job.label, icon: job.icon, color: job.color } : {}) }) }} className={`${field} bg-slate-800`}>
                      {MAINTENANCE_JOBS.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
                    </select>
                  )}
                  {a.kind === 'schedule' && (
                    <select value={a.target} onChange={(e) => { const s = schedules.find((x) => x.id === e.target.value); update(a.id, { target: e.target.value, ...(s ? { label: s.name } : {}) }) }} className={`${field} bg-slate-800`}>
                      {schedules.length === 0 && <option value="">No schedules yet</option>}
                      {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                  {a.kind === 'automation' && (
                    <select value={a.target} onChange={(e) => { const s = automations.find((x) => x.id === e.target.value); update(a.id, { target: e.target.value, ...(s ? { label: s.name } : {}) }) }} className={`${field} bg-slate-800`}>
                      {automations.length === 0 && <option value="">No automations yet</option>}
                      {automations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                  <select value={a.icon} onChange={(e) => update(a.id, { icon: e.target.value })} className={`${field} bg-slate-800`} title="Icon">
                    {!ICON_CHOICES.includes(a.icon) && <option value={a.icon}>{a.icon}</option>}
                    {ICON_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <div className="flex items-center gap-1" title="Colour">
                    {ACCENT_NAMES.map((c) => (
                      <button key={c} onClick={() => update(a.id, { color: c })} className={`h-4 w-4 rounded-full ${ACCENTS[c].dot} ${a.color === c ? 'ring-2 ring-white/70 ring-offset-1 ring-offset-slate-900' : 'opacity-60 hover:opacity-100'} transition-all`} aria-label={c} />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
          <div className="relative">
            <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition-colors"><Plus size={13} /> Add action</button>
            {adding && (
              <div className="absolute z-10 mt-1 w-56 rounded-xl bg-slate-900 border border-white/10 shadow-2xl p-1 animate-scale-in">
                {kinds.map((k) => <button key={k} onClick={() => add(k)} className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/5">{KIND_LABEL[k]}</button>)}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-white/5">
          <button onClick={() => void onReset()} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"><RotateCcw size={12} /> Reset to defaults</button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
            <button onClick={async () => { setSaving(true); try { await onSave(list) } finally { setSaving(false) } }} disabled={!valid || saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors">
              {saving && <Loader2 size={12} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
