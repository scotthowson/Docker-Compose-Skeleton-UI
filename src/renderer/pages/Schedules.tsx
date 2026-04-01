import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarClock, Plus, Trash2, Play, Pause, Clock, History, RefreshCw,
  Archive, Wrench, HeartPulse, RotateCcw, X, Loader2, ChevronDown,
  ChevronRight, CheckCircle, XCircle, AlertTriangle, Pencil, Activity, Zap,
} from 'lucide-react'
import { useScheduleStore } from '../stores/scheduleStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

const actionIcons: Record<string, React.ElementType> = {
  backup: Archive, update: RefreshCw, prune: Wrench, 'health-check': HeartPulse,
  restart: RotateCcw, 'metrics-snapshot': Activity, custom: Play,
}
const actionLabels: Record<string, string> = {
  backup: 'Backup', update: 'Update Stack', prune: 'Docker Prune',
  'health-check': 'Health Check', restart: 'Restart Stack',
  'metrics-snapshot': 'Metrics Snapshot', custom: 'Custom Script',
}

const scheduleOptions = [
  { value: '@minutely', label: 'Every minute' },
  { value: '@5min', label: 'Every 5 minutes' },
  { value: '@15min', label: 'Every 15 minutes' },
  { value: '@30min', label: 'Every 30 minutes' },
  { value: '@hourly', label: 'Every hour' },
  { value: '@daily', label: 'Every day' },
  { value: '@weekly', label: 'Every week' },
  { value: '@monthly', label: 'Every month' },
]

const actionOptions = ['backup', 'update', 'prune', 'health-check', 'restart', 'metrics-snapshot', 'custom']

export default function Schedules() {
  const { schedules, history, loading, saving, error, fetchSchedules, createSchedule, updateSchedule, deleteSchedule, toggleSchedule, runSchedule, fetchHistory } = useScheduleStore()
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', schedule: '', action: '', target: '' })
  const [runningId, setRunningId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', schedule: '@daily', action: 'backup', target: '' })
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const { addToast } = useToast()

  useEffect(() => { if (isConnected) fetchSchedules() }, [fetchSchedules, isConnected])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (deleteTarget) { setDeleteTarget(null); return }
      if (showCreate) { setShowCreate(false); return }
      if (editingId) { setEditingId(null); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [deleteTarget, showCreate, editingId])

  const handleCreate = useCallback(async () => {
    if (!form.name) return
    const ok = await createSchedule(form)
    if (ok) { setShowCreate(false); setForm({ name: '', schedule: '@daily', action: 'backup', target: '' }); addToast({ type: 'success', message: 'Schedule created' }) }
  }, [form, createSchedule, addToast])

  const handleEdit = useCallback(async () => {
    if (!editingId) return
    const ok = await updateSchedule(editingId, editForm)
    if (ok) { setEditingId(null); addToast({ type: 'success', message: 'Schedule updated' }) }
  }, [editingId, editForm, updateSchedule, addToast])

  const handleRunNow = useCallback(async (id: string) => {
    setRunningId(id)
    const result = await runSchedule(id)
    if (result) {
      addToast({ type: result.success ? 'success' : 'error', message: result.success ? `Ran successfully` : `Failed: ${result.output}` })
    } else {
      addToast({ type: 'error', message: 'Failed to run schedule' })
    }
    setRunningId(null)
  }, [runSchedule, addToast])

  const handleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!history[id]) fetchHistory(id)
  }

  const startEdit = (s: { id: string; name: string; schedule?: string; cron?: string; action: string; target?: string }) => {
    setEditingId(s.id)
    setEditForm({ name: s.name, schedule: s.schedule || s.cron || '@daily', action: s.action, target: s.target || '' })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <DisconnectedBanner />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/10 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight"><span className="text-gradient">Scheduled Tasks</span></h1>
            <p className="text-sm text-slate-400">
              {schedules.length > 0 ? `${schedules.filter(s => s.enabled).length} active of ${schedules.length} schedule${schedules.length !== 1 ? 's' : ''}` : 'Automated tasks on a schedule'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchSchedules()} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-50 transition-all press">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {isAdmin && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all press">
              <Plus size={14} /> New Schedule
            </button>
          )}
        </div>
      </div>

      {error && <div className="glass rounded-lg p-3 text-rose-400 text-sm">{error}</div>}

      {loading && schedules.length === 0 ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="glass rounded-xl p-4 h-16 skeleton" />)}</div>
      ) : schedules.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <CalendarClock className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No scheduled tasks</p>
          <p className="text-sm text-slate-500 mt-1">Create a schedule to automate backups, pruning, and more</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => {
            const Icon = actionIcons[s.action] || Play
            const isExpanded = expandedId === s.id
            const isRunning = runningId === s.id
            const schedLabel = scheduleOptions.find(o => o.value === (s.schedule || s.cron))?.label || s.schedule || s.cron || '—'

            return (
              <div key={s.id} className="glass rounded-xl overflow-hidden border border-transparent hover:border-violet-500/20 transition-all animate-fade-in">
                <div className="p-4 flex items-center gap-4">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.enabled ? 'bg-violet-500/20' : 'bg-slate-700/50'}`}>
                    <Icon className={`w-4 h-4 ${s.enabled ? 'text-violet-400' : 'text-slate-500'}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{s.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${s.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>
                        {s.enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{schedLabel}</span>
                      <span className="text-slate-400">{actionLabels[s.action] || s.action}{s.target ? ` → ${s.target}` : ''}</span>
                      {s.last_run && <span>Last: {new Date(s.last_run).toLocaleString()}</span>}
                      {(s.run_count ?? 0) > 0 && <span className="text-slate-600">{s.run_count} runs</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Run Now */}
                    {isAdmin && (
                      <button
                        onClick={() => handleRunNow(s.id)}
                        disabled={isRunning}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/15 hover:bg-cyan-500/20 disabled:opacity-50 transition-all press"
                        title="Run now"
                      >
                        {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                        <span className="hidden md:inline">Run</span>
                      </button>
                    )}
                    {/* Toggle */}
                    <button
                      onClick={() => toggleSchedule(s.id)}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      title={s.enabled ? 'Pause' : 'Resume'}
                    >
                      {s.enabled ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                    </button>
                    {/* Edit */}
                    {isAdmin && (
                      <button
                        onClick={() => startEdit(s)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-violet-400 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* Expand */}
                    <button onClick={() => handleExpand(s.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {/* Delete */}
                    {isAdmin && (
                      <button
                        onClick={() => setDeleteTarget(s.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* History */}
                {isExpanded && (
                  <div className="border-t border-white/5 p-4 bg-black/20">
                    <div className="flex items-center gap-2 mb-3">
                      <History className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-300 font-medium">Execution History</span>
                    </div>
                    {!history[s.id] || history[s.id].length === 0 ? (
                      <p className="text-sm text-slate-500">No execution history yet</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                        {history[s.id].map((h, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            {h.success ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                            <span className="text-slate-500">{new Date(h.timestamp).toLocaleString()}</span>
                            <span className="text-slate-400">{actionLabels[h.action] || h.action}</span>
                            {h.trigger === 'manual' && <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[9px]">manual</span>}
                            {h.duration_ms != null && <span className="text-slate-600">{h.duration_ms}ms</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowCreate(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md mx-4 border border-white/10 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Plus size={16} className="text-emerald-400" /></div>
                <h2 className="text-base font-semibold text-white">New Schedule</h2>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreate() }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Daily backup" className="w-full px-3 py-2.5 rounded-lg bg-white/5 text-sm text-white placeholder-slate-500 border border-white/10 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Schedule</label>
                <select value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-white/5 text-sm text-white border border-white/10 focus:border-emerald-500/50 focus:outline-none bg-transparent">
                  {scheduleOptions.map(o => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Action</label>
                <select value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-white/5 text-sm text-white border border-white/10 focus:border-emerald-500/50 focus:outline-none bg-transparent">
                  {actionOptions.map(a => <option key={a} value={a} className="bg-slate-900">{actionLabels[a] || a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Target {(form.action === 'update' || form.action === 'restart') ? <span className="text-rose-400">*</span> : <span className="text-slate-600">(optional)</span>}
                </label>
                <input value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} placeholder={form.action === 'custom' ? '/path/to/script.sh' : form.action === 'update' || form.action === 'restart' ? 'Stack name (e.g. media-services)' : 'Leave empty for all'} className="w-full px-3 py-2.5 rounded-lg bg-white/5 text-sm text-white placeholder-slate-500 border border-white/10 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all" />
                {form.action === 'custom' && <p className="text-[10px] text-slate-500 mt-1">Path to an executable script on the server</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">Cancel</button>
                <button type="submit" disabled={saving || !form.name} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-400 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* Edit Modal */}
      {editingId && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setEditingId(null)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md mx-4 border border-white/10 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center"><Pencil size={14} className="text-violet-400" /></div>
                <h2 className="text-base font-semibold text-white">Edit Schedule</h2>
              </div>
              <button onClick={() => setEditingId(null)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleEdit() }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-white/5 text-sm text-white border border-white/10 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Schedule</label>
                <select value={editForm.schedule} onChange={e => setEditForm({ ...editForm, schedule: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-white/5 text-sm text-white border border-white/10 focus:border-violet-500/50 focus:outline-none bg-transparent">
                  {scheduleOptions.map(o => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Action</label>
                <select value={editForm.action} onChange={e => setEditForm({ ...editForm, action: e.target.value })} className="w-full px-3 py-2.5 rounded-lg bg-white/5 text-sm text-white border border-white/10 focus:border-violet-500/50 focus:outline-none bg-transparent">
                  {actionOptions.map(a => <option key={a} value={a} className="bg-slate-900">{actionLabels[a] || a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Target {(editForm.action === 'update' || editForm.action === 'restart') ? <span className="text-rose-400">*</span> : <span className="text-slate-600">(optional)</span>}
                </label>
                <input value={editForm.target} onChange={e => setEditForm({ ...editForm, target: e.target.value })} placeholder={editForm.action === 'custom' ? '/path/to/script.sh' : editForm.action === 'update' || editForm.action === 'restart' ? 'Stack name (e.g. media-services)' : 'Leave empty for all'} className="w-full px-3 py-2.5 rounded-lg bg-white/5 text-sm text-white placeholder-slate-500 border border-white/10 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all" />
                {editForm.action === 'custom' && <p className="text-[10px] text-slate-500 mt-1">Path to an executable script on the server</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingId(null)} className="flex-1 px-4 py-2.5 rounded-lg text-sm text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-violet-500 text-white hover:bg-violet-400 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Save
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* Delete Confirmation */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="glass rounded-2xl p-6 w-full max-w-sm mx-4 border border-rose-500/20 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-rose-400" /></div>
              <div>
                <h3 className="text-white font-semibold">Delete Schedule</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-4">This will permanently remove this scheduled task and its execution history.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg text-sm text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">Cancel</button>
              <button onClick={async () => { await deleteSchedule(deleteTarget); setDeleteTarget(null); addToast({ type: 'success', message: 'Schedule deleted' }) }} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-rose-500 text-white hover:bg-rose-400 text-sm font-medium disabled:opacity-50 shadow-lg shadow-rose-500/20 transition-all">Delete</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
