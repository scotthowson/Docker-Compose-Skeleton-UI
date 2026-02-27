// =============================================================================
// Automations — Scheduled Actions & Automation Rules for Docker operations
// =============================================================================

import { useState, useMemo, useCallback } from 'react'
import {
  Zap, Plus, Trash2, Clock, Play, Pause, Loader2,
  CalendarClock, RefreshCw, ToggleLeft, ToggleRight,
  AlertTriangle, Box, Layers, HardDrive, Bell, Archive,
  X, History, CheckCircle, XCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useToast } from '../components/common/Toast'
import {
  fetchAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  fetchAutomationHistory,
} from '../api/endpoints'
import type { AutomationRule, AutomationHistoryEntry } from '../../shared/types'

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: 'Every minute (* * * * *)', cron: '* * * * *' },
  { label: 'Hourly (0 * * * *)', cron: '0 * * * *' },
  { label: 'Daily midnight (0 0 * * *)', cron: '0 0 * * *' },
  { label: 'Weekly Sunday (0 0 * * 0)', cron: '0 0 * * 0' },
  { label: 'Monthly (0 0 1 * *)', cron: '0 0 1 * *' },
]

const CONDITION_OPTIONS = [
  { value: 'container_unhealthy', label: 'Container Unhealthy' },
  { value: 'high_cpu', label: 'High CPU Usage' },
  { value: 'disk_full', label: 'Disk Full' },
]

const ACTION_TYPES = [
  { value: 'stack_start', label: 'Start Stack' },
  { value: 'stack_stop', label: 'Stop Stack' },
  { value: 'stack_restart', label: 'Restart Stack' },
  { value: 'container_restart', label: 'Restart Container' },
  { value: 'docker_prune', label: 'Docker Prune' },
  { value: 'backup_trigger', label: 'Trigger Backup' },
  { value: 'notification_send', label: 'Send Notification' },
]

function actionBadgeColor(actionType: string): string {
  switch (actionType) {
    case 'stack_start':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    case 'stack_stop':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/20'
    case 'stack_restart':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    case 'container_restart':
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
    case 'docker_prune':
      return 'bg-violet-500/15 text-violet-400 border-violet-500/20'
    case 'backup_trigger':
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
    case 'notification_send':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    default:
      return 'bg-slate-500/15 text-slate-400 border-slate-500/20'
  }
}

function actionIcon(actionType: string) {
  switch (actionType) {
    case 'stack_start':
      return <Play size={10} />
    case 'stack_stop':
      return <Pause size={10} />
    case 'stack_restart':
      return <RefreshCw size={10} />
    case 'container_restart':
      return <Box size={10} />
    case 'docker_prune':
      return <HardDrive size={10} />
    case 'backup_trigger':
      return <Archive size={10} />
    case 'notification_send':
      return <Bell size={10} />
    default:
      return <Zap size={10} />
  }
}

function actionLabel(actionType: string): string {
  const found = ACTION_TYPES.find((a) => a.value === actionType)
  return found ? found.label : actionType
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'Just now'
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ---------------------------------------------------------------------------
// Automations Page
// ---------------------------------------------------------------------------

export default function Automations() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  // Modal & form state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formName, setFormName] = useState('')
  const [formTriggerType, setFormTriggerType] = useState<'schedule' | 'condition'>('schedule')
  const [formCron, setFormCron] = useState('0 * * * *')
  const [formCondition, setFormCondition] = useState('container_unhealthy')
  const [formActionType, setFormActionType] = useState('stack_restart')
  const [formActionTarget, setFormActionTarget] = useState('')

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Toggle loading state
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // History panel state
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null)
  const [historyRuleName, setHistoryRuleName] = useState('')
  const [historyEntries, setHistoryEntries] = useState<AutomationHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState<number | null>(null)

  // Polling
  const { data, loading, refresh } = usePolling(
    fetchAutomations,
    10000,
    { enabled: isConnected },
  )

  const automations: AutomationRule[] = useMemo(() => data?.automations ?? [], [data])

  // Stats
  const stats = useMemo(() => {
    const total = automations.length
    const active = automations.filter((a) => a.enabled).length
    const scheduled = automations.filter((a) => a.trigger_type === 'schedule').length
    const conditionBased = automations.filter((a) => a.trigger_type === 'condition').length
    return { total, active, scheduled, conditionBased }
  }, [automations])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleToggle = useCallback(async (rule: AutomationRule) => {
    setTogglingId(rule.id)
    try {
      await updateAutomation(rule.id, { enabled: !rule.enabled })
      addToast({
        type: 'success',
        message: `${rule.name} ${rule.enabled ? 'disabled' : 'enabled'}`,
      })
      refresh()
    } catch {
      addToast({ type: 'error', message: `Failed to toggle ${rule.name}` })
    } finally {
      setTogglingId(null)
    }
  }, [addToast, refresh])

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true)
    try {
      await deleteAutomation(id)
      addToast({ type: 'success', message: 'Automation rule deleted' })
      setConfirmDeleteId(null)
      refresh()
    } catch {
      addToast({ type: 'error', message: 'Failed to delete automation rule' })
    } finally {
      setDeleting(false)
    }
  }, [addToast, refresh])

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) return
    setCreating(true)
    try {
      const triggerValue = formTriggerType === 'schedule' ? formCron : formCondition
      await createAutomation({
        name: formName.trim(),
        trigger_type: formTriggerType,
        trigger_value: triggerValue,
        action_type: formActionType,
        action_target: formActionTarget.trim() || '*',
        enabled: true,
      })
      addToast({ type: 'success', message: 'Automation rule created' })
      setShowCreateModal(false)
      resetForm()
      refresh()
    } catch {
      addToast({ type: 'error', message: 'Failed to create automation rule' })
    } finally {
      setCreating(false)
    }
  }, [formName, formTriggerType, formCron, formCondition, formActionType, formActionTarget, addToast, refresh])

  const resetForm = useCallback(() => {
    setFormName('')
    setFormTriggerType('schedule')
    setFormCron('0 * * * *')
    setFormCondition('container_unhealthy')
    setFormActionType('stack_restart')
    setFormActionTarget('')
  }, [])

  const openCreateModal = useCallback(() => {
    resetForm()
    setShowCreateModal(true)
  }, [resetForm])

  // Open history panel for a rule
  const openHistory = useCallback(async (rule: AutomationRule) => {
    setHistoryRuleId(rule.id)
    setHistoryRuleName(rule.name)
    setHistoryEntries([])
    setExpandedHistoryIdx(null)
    setHistoryLoading(true)
    try {
      const result = await fetchAutomationHistory(rule.id)
      setHistoryEntries(result.history ?? [])
    } catch {
      addToast({ type: 'error', message: `Failed to load history for ${rule.name}` })
    } finally {
      setHistoryLoading(false)
    }
  }, [addToast])

  const closeHistory = useCallback(() => {
    setHistoryRuleId(null)
    setHistoryEntries([])
    setExpandedHistoryIdx(null)
  }, [])

  // -------------------------------------------------------------------------
  // Disconnected state
  // -------------------------------------------------------------------------

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
          <Zap size={24} className="text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">Connect to a server to manage automations</p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/10 flex items-center justify-center text-amber-400">
            <Zap size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Automations</h2>
            <p className="text-xs text-slate-500">
              Scheduled actions &amp; condition-based rules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 press"
          >
            <Plus size={13} />
            Add Automation
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-all duration-200 disabled:opacity-50 press"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        {/* Total */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={14} className="text-slate-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Rules</span>
          </div>
          <p className="text-2xl font-bold text-slate-100">{stats.total}</p>
        </div>

        {/* Active */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-emerald-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Active</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
        </div>

        {/* Scheduled */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock size={14} className="text-cyan-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Scheduled</span>
          </div>
          <p className="text-2xl font-bold text-cyan-400">{stats.scheduled}</p>
        </div>

        {/* Condition-based */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Condition</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{stats.conditionBased}</p>
        </div>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-600" />
        </div>
      )}

      {/* Empty state */}
      {data && automations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
            <Zap size={22} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500 text-center max-w-sm">
            No automation rules configured. Create your first rule to automate Docker operations.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 press"
          >
            <Plus size={13} />
            Create Rule
          </button>
        </div>
      )}

      {/* Rule cards */}
      {automations.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {automations.map((rule) => (
            <div
              key={rule.id}
              className={`bg-slate-900/60 backdrop-blur-md border rounded-xl p-4 md:p-6 transition-colors ${
                rule.enabled
                  ? 'border-white/[0.06]'
                  : 'border-white/[0.04] opacity-60'
              }`}
            >
              {/* Top row: name + toggle */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-100 truncate">{rule.name}</h3>
                </div>
                <button
                  onClick={() => handleToggle(rule)}
                  disabled={togglingId === rule.id}
                  className="shrink-0 transition-colors"
                  title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                >
                  {togglingId === rule.id ? (
                    <Loader2 size={20} className="animate-spin text-slate-500" />
                  ) : rule.enabled ? (
                    <ToggleRight size={24} className="text-emerald-400" />
                  ) : (
                    <ToggleLeft size={24} className="text-slate-600" />
                  )}
                </button>
              </div>

              {/* Trigger + action badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* Trigger badge */}
                {rule.trigger_type === 'schedule' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-cyan-500/15 text-cyan-400 border-cyan-500/20">
                    <CalendarClock size={10} />
                    Schedule
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-500/15 text-amber-400 border-amber-500/20">
                    <AlertTriangle size={10} />
                    Condition
                  </span>
                )}

                {/* Action badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actionBadgeColor(rule.action_type)}`}>
                  {actionIcon(rule.action_type)}
                  {actionLabel(rule.action_type)}
                </span>
              </div>

              {/* Detail rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs mb-3">
                {/* Trigger value */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 shrink-0 w-16">Trigger:</span>
                  {rule.trigger_type === 'schedule' ? (
                    <code className="font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/15 text-[11px]">
                      {rule.trigger_value}
                    </code>
                  ) : (
                    <span className="text-amber-400">{rule.trigger_value}</span>
                  )}
                </div>

                {/* Action target */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 shrink-0 w-16">Target:</span>
                  <span className="text-slate-300 font-mono text-[11px]">{rule.action_target || '*'}</span>
                </div>

                {/* Last run */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 shrink-0 w-16">Last run:</span>
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock size={11} className="text-slate-600" />
                    {relativeTime(rule.last_run)}
                  </span>
                </div>

                {/* Run count */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 shrink-0 w-16">Runs:</span>
                  <span className="text-slate-400">{rule.run_count}</span>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.04]">
                {/* History button */}
                <button
                  onClick={() => openHistory(rule)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors mr-auto"
                >
                  <History size={11} />
                  History
                </button>
                {confirmDeleteId === rule.id ? (
                  <>
                    <span className="text-[11px] text-rose-400 mr-1">Delete this rule?</span>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      disabled={deleting}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-colors disabled:opacity-50"
                    >
                      {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(rule.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 size={11} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Create Automation Modal                                              */}
      {/* ------------------------------------------------------------------- */}
      {/* ------------------------------------------------------------------- */}
      {/* Automation History Panel                                             */}
      {/* ------------------------------------------------------------------- */}
      {historyRuleId && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <History size={16} className="text-cyan-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Run History</h3>
                  <p className="text-[10px] text-slate-500">{historyRuleName}</p>
                </div>
              </div>
              <button
                onClick={closeHistory}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {historyLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-slate-600" />
                </div>
              )}

              {!historyLoading && historyEntries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <History size={24} className="text-slate-700" />
                  <p className="text-xs text-slate-500">No run history yet</p>
                  <p className="text-[10px] text-slate-600 text-center max-w-xs">
                    History entries will appear here once this automation rule has been triggered.
                  </p>
                </div>
              )}

              {!historyLoading && historyEntries.length > 0 && (
                <div className="space-y-1.5">
                  {historyEntries.map((entry, idx) => {
                    const isExpanded = expandedHistoryIdx === idx
                    const date = new Date(entry.timestamp)
                    const timeStr = date.toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })

                    return (
                      <div key={idx} className="rounded-lg border border-white/[0.04] overflow-hidden">
                        <button
                          onClick={() => setExpandedHistoryIdx(isExpanded ? null : idx)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                        >
                          {/* Status dot */}
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            entry.success ? 'bg-emerald-400' : 'bg-rose-400'
                          }`} />

                          {/* Status icon */}
                          {entry.success ? (
                            <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle size={13} className="text-rose-400 shrink-0" />
                          )}

                          {/* Timestamp */}
                          <span className="text-xs text-slate-400 font-mono tabular-nums flex-1">
                            {timeStr}
                          </span>

                          {/* Status badge */}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            entry.success
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}>
                            {entry.success ? 'Success' : 'Failed'}
                          </span>

                          {/* Expand chevron */}
                          {isExpanded ? (
                            <ChevronUp size={12} className="text-slate-600 shrink-0" />
                          ) : (
                            <ChevronDown size={12} className="text-slate-600 shrink-0" />
                          )}
                        </button>

                        {/* Expanded output log */}
                        {isExpanded && entry.message && (
                          <div className="px-3 pb-3 pt-0">
                            <pre className="text-[11px] text-slate-400 font-mono bg-slate-950/60 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap border border-white/[0.04] max-h-48 overflow-y-auto scrollbar-thin">
                              {entry.message}
                            </pre>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] shrink-0">
              <span className="text-[10px] text-slate-600">
                {historyEntries.length} run{historyEntries.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={closeHistory}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-200">New Automation Rule</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block font-semibold">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Nightly backup"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.05] transition-colors"
                />
              </div>

              {/* Trigger type */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block font-semibold">
                  Trigger Type
                </label>
                <div className="flex rounded-lg bg-white/[0.03] border border-white/[0.06] p-0.5">
                  <button
                    onClick={() => setFormTriggerType('schedule')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                      formTriggerType === 'schedule'
                        ? 'bg-cyan-500/15 text-cyan-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    <CalendarClock size={13} />
                    Schedule
                  </button>
                  <button
                    onClick={() => setFormTriggerType('condition')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                      formTriggerType === 'condition'
                        ? 'bg-amber-500/15 text-amber-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    <AlertTriangle size={13} />
                    Condition
                  </button>
                </div>
              </div>

              {/* Schedule: cron input + presets */}
              {formTriggerType === 'schedule' && (
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block font-semibold">
                    Cron Expression
                  </label>
                  <input
                    type="text"
                    value={formCron}
                    onChange={(e) => setFormCron(e.target.value)}
                    placeholder="* * * * *"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500/30 focus:bg-white/[0.05] transition-colors mb-2"
                  />
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block font-semibold">
                    Quick Presets
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CRON_PRESETS.map((p) => (
                      <button
                        key={p.cron}
                        onClick={() => setFormCron(p.cron)}
                        className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                          formCron === p.cron
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                            : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-400'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Condition: dropdown */}
              {formTriggerType === 'condition' && (
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block font-semibold">
                    Condition
                  </label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.05] transition-colors appearance-none cursor-pointer"
                  >
                    {CONDITION_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value} className="bg-slate-900 text-slate-200">
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action type */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block font-semibold">
                  Action Type
                </label>
                <select
                  value={formActionType}
                  onChange={(e) => setFormActionType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.05] transition-colors appearance-none cursor-pointer"
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a.value} value={a.value} className="bg-slate-900 text-slate-200">
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action target */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block font-semibold">
                  Action Target
                </label>
                <input
                  type="text"
                  value={formActionTarget}
                  onChange={(e) => setFormActionTarget(e.target.value)}
                  placeholder='Stack name, container name, or "*" for all'
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.05] transition-colors"
                />
                <p className="text-[10px] text-slate-600 mt-1">
                  Leave empty or use "*" to target all stacks/containers.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06] shrink-0">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 disabled:opacity-50 press"
              >
                {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Create
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
