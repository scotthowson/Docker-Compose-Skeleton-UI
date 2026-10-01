// =============================================================================
// Schedules — tasks DCS runs by itself on a timer: backups, pruning, health checks,
// updates. Create one, pause it, run it now, read its history.
// (The server's own crontab is the Cron Jobs page.)
// =============================================================================

import React, { useState, useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { Badge } from '@mantine/core'
import {
  CalendarClock, Plus, Trash2, Play, Pause, Clock, History, RefreshCw,
  Archive, Wrench, HeartPulse, RotateCcw, X, Loader2, ChevronDown,
  ChevronRight, CheckCircle, XCircle, Pencil, Activity, Zap, ArrowUpCircle, LifeBuoy,
  CirclePlay, CircleStop, ArrowDownToLine,
} from 'lucide-react'
import { useScheduleStore } from '../stores/scheduleStore'
import { useFleetScope } from '../hooks/useFleetScope'
import FleetScopeChips from '../components/fleet/FleetScopeChips'
import VmCapsule from '../components/fleet/VmCapsule'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/common/Toast'
import { useConfirm } from '../components/common/ConfirmDialog'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import ModalOverlay from '../components/common/ModalOverlay'
import PageHeader from '../components/common/PageHeader'
import Hint from '../components/common/Hint'
import { EmptyState, ErrorState } from '../components/common/PageState'
import { pageLabel } from '../constants/pageTitles'
import {
  BTN_TOOLBAR, BTN_TOOLBAR_QUIET, BTN_CARD, BTN_ICON_SM, BTN_SHEET_QUIET, BTN_SHEET_PRIMARY,
  TONE_OK, TONE_QUIET, TONE_GHOST, TONE_GHOST_OK, TONE_GHOST_DANGER,
} from '../lib/ui'

const actionIcons: Record<string, React.ElementType> = {
  backup: Archive, update: RefreshCw, prune: Wrench, 'health-check': HeartPulse,
  restart: RotateCcw, start: CirclePlay, stop: CircleStop, 'metrics-snapshot': Activity, custom: Play,
  'dcs-update': ArrowUpCircle, 'image-update': ArrowDownToLine, recovery: LifeBuoy,
}
const actionLabels: Record<string, string> = {
  backup: 'Backup', update: 'Update stack', prune: 'Docker prune',
  'health-check': 'Health check', restart: 'Restart stack', start: 'Start stack', stop: 'Stop stack',
  'metrics-snapshot': 'Metrics snapshot', custom: 'Custom script',
  'dcs-update': 'DCS self-update', 'image-update': 'Image updates', recovery: 'Recovery bundle',
}
/** What the target field means per action (empty: no target) */
const actionTargetHints: Record<string, string> = {
  'dcs-update': 'Leave empty, or "images" to pull image updates for every stack as well. Rolls back by itself when the health score drops.',
  'image-update': 'Leave empty to pull newer images and recreate their containers, or "pull" to only pull them (the containers keep the old image until they are recreated).',
  recovery: `No target. Needs the RECOVERY_PASSPHRASE secret (${pageLabel('backup')} page); copies to RECOVERY_REMOTE when set.`,
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

// every action the API's schedule runner knows (start, stop and image-update included)
const actionOptions = ['backup', 'update', 'image-update', 'prune', 'health-check', 'start', 'stop', 'restart', 'metrics-snapshot', 'dcs-update', 'recovery', 'custom']
/** the actions that run on one stack: the target is its name, and a run without one fails */
const STACK_ACTIONS = new Set(['update', 'restart', 'start', 'stop'])

/** the fields of the schedule dialog: one look, one focus ring */
const FIELD = 'w-full h-11 px-3 rounded-xl bg-white/5 text-sm text-slate-200 placeholder-slate-500 border border-white/10 transition-colors focus:outline-none focus-visible:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-emerald-500/40'

type ScheduleFormState = { name: string; schedule: string; action: string; target: string }

/** The dialog that creates a schedule or edits one: the same fields, the same words */
function ScheduleDialog({ mode, form, setForm, saving, onSubmit, onClose }: {
  mode: 'create' | 'edit'
  form: ScheduleFormState
  setForm: (f: ScheduleFormState) => void
  saving: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  const uid = useId()
  const needsTarget = STACK_ACTIONS.has(form.action)
  return createPortal(
    <ModalOverlay onClose={onClose} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md mx-4 max-h-[92vh] overflow-y-auto border border-white/10 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center" aria-hidden>
              {mode === 'create' ? <Plus size={16} className="text-slate-300" /> : <Pencil size={14} className="text-slate-300" />}
            </div>
            <h2 className="text-base font-semibold text-slate-100">{mode === 'create' ? 'New schedule' : 'Edit schedule'}</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className={`${BTN_ICON_SM} ${TONE_GHOST}`}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="space-y-4">
          <div>
            <label htmlFor={`${uid}-name`} className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
            <input id={`${uid}-name`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Daily backup" autoComplete="off" className={FIELD} autoFocus />
          </div>
          <div>
            <label htmlFor={`${uid}-schedule`} className="block text-xs font-medium text-slate-400 mb-1.5">Schedule</label>
            <select id={`${uid}-schedule`} value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} className={FIELD}>
              {scheduleOptions.map((o) => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-action`} className="block text-xs font-medium text-slate-400 mb-1.5">Action</label>
            <select id={`${uid}-action`} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className={FIELD}>
              {actionOptions.map((a) => <option key={a} value={a} className="bg-slate-900">{actionLabels[a] || a}</option>)}
            </select>
            {actionTargetHints[form.action] && (
              <p className="text-[10px] text-slate-500 mt-1.5">{actionTargetHints[form.action]}</p>
            )}
          </div>
          <div>
            <label htmlFor={`${uid}-target`} className="block text-xs font-medium text-slate-400 mb-1.5">
              Target {needsTarget ? <span className="text-rose-400" title="Required">*</span> : <span className="text-slate-500">(optional)</span>}
            </label>
            <input
              id={`${uid}-target`}
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              placeholder={form.action === 'custom' ? '/path/to/script.sh' : needsTarget ? 'Stack name, e.g. media-services' : 'Leave empty for all'}
              autoComplete="off"
              className={FIELD}
            />
            {form.action === 'custom' && <p className="text-[10px] text-slate-500 mt-1">Path to an executable script on the server</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className={`${BTN_SHEET_QUIET} flex-1`}>Cancel</button>
            <button type="submit" disabled={saving || !form.name} className={`${BTN_SHEET_PRIMARY} flex-1`}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : mode === 'create' ? <Plus size={14} /> : <CheckCircle size={14} />} {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>,
    document.body,
  )
}

export default function Schedules() {
  const { schedules, history, loading, saving, error, fetchSchedules, createSchedule, updateSchedule, deleteSchedule, toggleSchedule, runSchedule, fetchHistory } = useScheduleStore()
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ScheduleFormState>({ name: '', schedule: '', action: '', target: '' })
  const [runningId, setRunningId] = useState<string | null>(null)
  const [form, setForm] = useState<ScheduleFormState>({ name: '', schedule: '@daily', action: 'backup', target: '' })
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const { addToast } = useToast()
  const confirm = useConfirm()

  const { scope, setScope, member: scopeMember, memberName, members: scopeMembers, hasFleet } = useFleetScope()
  useEffect(() => { if (isConnected) fetchSchedules(scope) }, [fetchSchedules, isConnected, scope])

  const handleCreate = useCallback(async () => {
    if (!form.name) return
    if (scope === 'all') { addToast({ type: 'info', message: 'Everywhere is a view: pick the hub or one VM above, then change it there' }); return }
    const ok = await createSchedule(form, scopeMember)
    if (ok) { setShowCreate(false); setForm({ name: '', schedule: '@daily', action: 'backup', target: '' }); addToast({ type: 'success', message: 'Schedule created' }) }
  }, [form, createSchedule, addToast, scope, scopeMember])

  const handleEdit = useCallback(async () => {
    if (!editingId) return
    if (scope === 'all') { addToast({ type: 'info', message: 'Everywhere is a view: pick the hub or one VM above, then change it there' }); return }
    const ok = await updateSchedule(editingId, editForm, scopeMember)
    if (ok) { setEditingId(null); addToast({ type: 'success', message: 'Schedule updated' }) }
  }, [editingId, editForm, updateSchedule, addToast, scope, scopeMember])

  const handleRunNow = useCallback(async (id: string) => {
    setRunningId(id)
    const result = await runSchedule(id, schedules.find((x) => x.id === id)?.member ?? scopeMember)
    if (result) {
      addToast({ type: result.success ? 'success' : 'error', message: result.success ? `Ran successfully` : `The run failed: ${result.output}` })
    } else {
      addToast({ type: 'error', message: 'Could not run the schedule' })
    }
    setRunningId(null)
  }, [runSchedule, addToast, schedules, scopeMember])

  /** Delete: ask first (the shared confirmation, focus on Cancel) */
  const handleDelete = useCallback(async (id: string) => {
    const s = schedules.find((x) => x.id === id)
    const ok = await confirm({
      title: 'Delete this schedule?',
      message: `${s?.name ? `"${s.name}" is removed` : 'This scheduled task is removed'} together with its execution history. This cannot be undone.`,
      confirmLabel: 'Delete schedule',
      danger: true,
    })
    if (!ok) return
    const done = await deleteSchedule(id, s?.member ?? scopeMember)
    if (done) addToast({ type: 'success', message: 'Schedule deleted' })
  }, [schedules, confirm, deleteSchedule, scopeMember, addToast])

  /** the runs live where the schedule does: a VM's are asked on that VM, not the hub */
  const handleExpand = (s: { id: string; member?: string | null }) => {
    if (expandedId === s.id) { setExpandedId(null); return }
    setExpandedId(s.id)
    if (!history[s.id]) fetchHistory(s.id, s.member ?? scopeMember)
  }

  const startEdit = (s: { id: string; name: string; schedule?: string; cron?: string; action: string; target?: string }) => {
    setEditingId(s.id)
    setEditForm({ name: s.name, schedule: s.schedule || s.cron || '@daily', action: s.action, target: s.target || '' })
  }

  const activeCount = schedules.filter((s) => s.enabled).length

  return (
    <div className="space-y-5 animate-fade-in">
      <DisconnectedBanner />
      <PageHeader
        page="schedules"
        badge={scopeMember ? <VmCapsule member={scopeMember} name={memberName} vmid={scopeMembers.find((m) => m.id === scopeMember)?.vmid} /> : undefined}
        subtitle={schedules.length > 0 ? `${activeCount} active of ${schedules.length} schedule${schedules.length !== 1 ? 's' : ''}` : undefined}
        actions={<>
          <button type="button" aria-label="Refresh" onClick={() => fetchSchedules(scope)} disabled={loading} className={BTN_TOOLBAR_QUIET}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {isAdmin && (
            <button type="button" onClick={() => setShowCreate(true)} className={`${BTN_TOOLBAR} ${TONE_OK}`}>
              <Plus size={14} /> New schedule
            </button>
          )}
        </>}
      >
        {hasFleet && <FleetScopeChips scope={scope} members={scopeMembers} onChange={setScope} label="Show" busy={loading && schedules.length > 0} />}
      </PageHeader>

      {error && <ErrorState title="Something went wrong with the schedules" error={error} onRetry={() => fetchSchedules(scope)} />}

      {loading && schedules.length === 0 ? (
        <div className="space-y-3" role="status" aria-label="Reading the schedules">{[1, 2, 3].map((i) => <div key={i} className="glass rounded-xl p-4 h-16 skeleton" aria-hidden />)}</div>
      ) : schedules.length === 0 ? (
        <div className="glass rounded-xl border border-white/5">
          <EmptyState
            icon={<CalendarClock size={32} />}
            title="No scheduled tasks"
            hint="Create a schedule to automate backups, pruning and more"
            action={isAdmin ? (
              <button type="button" onClick={() => setShowCreate(true)} className={`${BTN_TOOLBAR} ${TONE_OK}`}>
                <Plus size={14} /> New schedule
              </button>
            ) : undefined}
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {schedules.map((s) => {
            const Icon = actionIcons[s.action] || Play
            const isExpanded = expandedId === s.id
            const isRunning = runningId === s.id
            const schedLabel = scheduleOptions.find((o) => o.value === (s.schedule || s.cron))?.label || s.schedule || s.cron || '—'

            return (
              <li key={s.id} className="glass rounded-xl overflow-hidden border border-white/5 hover:border-white/10 transition-colors animate-fade-in">
                <div className="p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                  {/* Icon: emerald while it runs on its timer */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-slate-500'}`} aria-hidden>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-[12rem]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-100 truncate">{s.name}</span>
                      {s.member !== undefined && <VmCapsule member={s.member} name={s.member_name} vmid={s.vmid} size="xs" onClick={() => setScope(s.member ?? 'hub')} />}
                      <Badge component="span" color={s.enabled ? 'emerald' : 'slate'}>{s.enabled ? 'Active' : 'Paused'}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden />{schedLabel}</span>
                      <span className="text-slate-400">{actionLabels[s.action] || s.action}{s.target ? ` → ${s.target}` : ''}</span>
                      {s.last_run && <span>Last: {new Date(s.last_run).toLocaleString()}</span>}
                      {(s.run_count ?? 0) > 0 && <span className="text-slate-500">{s.run_count} runs</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAdmin && (
                      <Hint label="Run now">
                        <button
                          type="button"
                          onClick={() => handleRunNow(s.id)}
                          disabled={isRunning}
                          aria-label={`Run ${s.name} now`}
                          className={`${BTN_CARD} ${TONE_QUIET}`}
                        >
                          {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                          <span className="hidden md:inline">Run</span>
                        </button>
                      </Hint>
                    )}
                    {/* (admin: the toggle is a write, the API answers 403 to a user) */}
                    {isAdmin && (
                      <Hint label={s.enabled ? 'Pause' : 'Resume'}>
                        <button
                          type="button"
                          onClick={() => toggleSchedule(s.id, s.member ?? scopeMember)}
                          aria-label={`${s.enabled ? 'Pause' : 'Resume'} ${s.name}`}
                          className={`${BTN_ICON_SM} ${s.enabled ? TONE_GHOST : TONE_GHOST_OK}`}
                        >
                          {s.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                      </Hint>
                    )}
                    {isAdmin && (
                      <Hint label="Edit">
                        <button type="button" onClick={() => startEdit(s)} aria-label={`Edit ${s.name}`} className={`${BTN_ICON_SM} ${TONE_GHOST}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </Hint>
                    )}
                    <Hint label={isExpanded ? 'Hide the runs' : 'Show the runs'}>
                      <button type="button" aria-label={isExpanded ? 'Hide the runs' : 'Show the runs'} aria-expanded={isExpanded} onClick={() => handleExpand(s)} className={`${BTN_ICON_SM} ${TONE_GHOST}`}>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </Hint>
                    {isAdmin && (
                      <Hint label="Delete">
                        <button type="button" onClick={() => handleDelete(s.id)} disabled={saving} aria-label={`Delete ${s.name}`} className={`${BTN_ICON_SM} ${TONE_GHOST_DANGER}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </Hint>
                    )}
                  </div>
                </div>

                {/* History */}
                {isExpanded && (
                  <div className="border-t border-white/5 p-4 bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-3">
                      <History className="w-4 h-4 text-slate-400" aria-hidden />
                      <h3 className="text-sm text-slate-300 font-medium">Run history</h3>
                    </div>
                    {!history[s.id] || history[s.id].length === 0 ? (
                      <p className="text-sm text-slate-500">No runs yet</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                        {history[s.id].map((h) => (
                          <div key={h.timestamp} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            {h.success ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-label="Succeeded" /> : <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-label="Failed" />}
                            <span className="text-slate-500">{new Date(h.timestamp).toLocaleString()}</span>
                            <span className="text-slate-400">{actionLabels[h.action] || h.action}</span>
                            {h.trigger === 'manual' && <Badge component="span" color="slate">manual</Badge>}
                            {h.duration_ms != null && <span className="text-slate-500 tabular-nums">{h.duration_ms} ms</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {showCreate && (
        <ScheduleDialog mode="create" form={form} setForm={setForm} saving={saving} onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
      )}
      {editingId && (
        <ScheduleDialog mode="edit" form={editForm} setForm={setEditForm} saving={saving} onSubmit={handleEdit} onClose={() => setEditingId(null)} />
      )}
    </div>
  )
}
