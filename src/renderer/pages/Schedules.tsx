import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, Plus, Trash2, Play, Pause, Clock, History, RefreshCw, Archive, Wrench, HeartPulse, RotateCcw, X, Loader2, ChevronDown, ChevronRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useScheduleStore } from '../stores/scheduleStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

const actionIcons: Record<string, React.ElementType> = { backup: Archive, update: RefreshCw, prune: Wrench, 'health-check': HeartPulse, restart: RotateCcw, custom: Play }
const scheduleOptions = [{ value: '@hourly', label: 'Every hour' }, { value: '@daily', label: 'Every day' }, { value: '@weekly', label: 'Every week' }, { value: '@monthly', label: 'Every month' }]
const actionOptions = ['backup', 'update', 'prune', 'health-check', 'restart', 'custom']

export default function Schedules() {
  const { schedules, history, loading, saving, error, fetchSchedules, createSchedule, deleteSchedule, toggleSchedule, fetchHistory } = useScheduleStore()
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', schedule: '@daily', action: 'backup', target: '' })
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'

  useEffect(() => { if (isConnected) fetchSchedules() }, [fetchSchedules, isConnected])

  // Close topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (deleteTarget) { setDeleteTarget(null); return }
      if (showCreate) { setShowCreate(false); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [deleteTarget, showCreate])

  const handleCreate = useCallback(async () => {
    if (!form.name) return
    const ok = await createSchedule(form)
    if (ok) { setShowCreate(false); setForm({ name: '', schedule: '@daily', action: 'backup', target: '' }) }
  }, [form, createSchedule])

  const handleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!history[id]) fetchHistory(id)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <DisconnectedBanner />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center"><CalendarClock className="w-5 h-5 text-violet-400" /></div>
          <div><h1 className="text-xl font-bold tracking-tight"><span className="text-gradient">Scheduled Operations</span></h1><p className="text-sm text-slate-400">Automated tasks on a schedule</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchSchedules()} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-50 transition-all"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span></button>
          {isAdmin && <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all press"><Plus size={14} /> Create Schedule</button>}
        </div>
      </div>

      {error && <div className="glass rounded-lg p-3 text-rose-400 text-sm">{error}</div>}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="glass rounded-xl p-4 h-16 skeleton" />)}</div>
      ) : schedules.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <CalendarClock className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No scheduled operations</p>
          <p className="text-sm text-slate-500 mt-1">Create a schedule to automate recurring tasks</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => {
            const Icon = actionIcons[s.action] || Play
            const isExpanded = expandedId === s.id
            return (
              <div key={s.id} className="glass rounded-xl overflow-hidden border border-transparent hover:border-violet-500/20 transition-all animate-fade-in">
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.enabled ? 'bg-violet-500/20' : 'bg-slate-700/50'}`}>
                    <Icon className={`w-4 h-4 ${s.enabled ? 'text-violet-400' : 'text-slate-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{s.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${s.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>{s.enabled ? 'Active' : 'Paused'}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.schedule}</span>
                      <span>{s.action}{s.target ? ` → ${s.target}` : ''}</span>
                      {s.last_run && <span>Last: {new Date(s.last_run).toLocaleDateString()}</span>}
                      <span>Runs: {s.run_count}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleSchedule(s.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title={s.enabled ? 'Pause schedule' : 'Resume schedule'} aria-label={s.enabled ? 'Pause schedule' : 'Resume schedule'}>
                      {s.enabled ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                    </button>
                    <button onClick={() => handleExpand(s.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {isAdmin && <button onClick={() => setDeleteTarget(s.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors" title="Delete schedule" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-white/5 p-4 bg-black/20">
                    <div className="flex items-center gap-2 mb-3"><History className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-300 font-medium">Execution History</span></div>
                    {!history[s.id] || history[s.id].length === 0 ? (
                      <p className="text-sm text-slate-500">No execution history yet</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {history[s.id].map((h, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            {h.success ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                            <span className="text-slate-500">{new Date(h.timestamp).toLocaleString()}</span>
                            <span className="text-slate-400">{h.action}</span>
                            <span className="text-slate-500">{h.duration_ms}ms</span>
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Create Schedule</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreate() }} className="space-y-4">
              <div><label className="block text-sm text-slate-400 mb-1">Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Daily backup" className="w-full px-3 py-2 rounded-lg glass text-sm text-white placeholder-slate-500 border border-white/5 focus:border-emerald-500/50 focus:outline-none" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Schedule</label><select value={form.schedule} onChange={e => setForm({...form, schedule: e.target.value})} className="w-full px-3 py-2 rounded-lg glass text-sm text-white border border-white/5 focus:border-emerald-500/50 focus:outline-none bg-transparent">{scheduleOptions.map(o => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}</select></div>
              <div><label className="block text-sm text-slate-400 mb-1">Action</label><select value={form.action} onChange={e => setForm({...form, action: e.target.value})} className="w-full px-3 py-2 rounded-lg glass text-sm text-white border border-white/5 focus:border-emerald-500/50 focus:outline-none bg-transparent">{actionOptions.map(a => <option key={a} value={a} className="bg-slate-900">{a}</option>)}</select></div>
              <div><label className="block text-sm text-slate-400 mb-1">Target (optional)</label><input value={form.target} onChange={e => setForm({...form, target: e.target.value})} placeholder="Stack name or script path" className="w-full px-3 py-2 rounded-lg glass text-sm text-white placeholder-slate-500 border border-white/5 focus:border-emerald-500/50 focus:outline-none" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-lg glass text-sm text-slate-300 hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={saving || !form.name} className="flex-1 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-all">{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create</button>
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
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Delete Schedule</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-4">This will permanently remove this scheduled operation.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 rounded-lg glass text-sm text-slate-300 hover:bg-white/5">Cancel</button>
              <button onClick={async () => { await deleteSchedule(deleteTarget); setDeleteTarget(null) }} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-sm font-medium disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
