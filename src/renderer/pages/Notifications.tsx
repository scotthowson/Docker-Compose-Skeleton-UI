// =============================================================================
// Notifications — NTFY Notification Center: rules, history, test, status
// =============================================================================

import { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell, Plus, Trash2, Send, CheckCircle, XCircle,
  ToggleLeft, ToggleRight, Loader2, AlertTriangle,
  Clock, Shield, Cpu, HardDrive, Box, Layers, Package,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import {
  fetchNotificationRules,
  createNotificationRule,
  deleteNotificationRule,
  fetchNotificationHistory,
  sendTestNotification,
  fetchConfig,
} from '../api/endpoints'
import type { NotificationRule, NotificationHistoryEntry } from '../../shared/types'

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

type TriggerType =
  | 'container_unhealthy'
  | 'container_stopped'
  | 'container_high_cpu'
  | 'container_high_memory'
  | 'disk_warning'
  | 'stack_down'
  | 'image_stale'

type Priority = 'urgent' | 'high' | 'default' | 'low'

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'container_unhealthy', label: 'Container Unhealthy' },
  { value: 'container_stopped', label: 'Container Stopped' },
  { value: 'container_high_cpu', label: 'High CPU' },
  { value: 'container_high_memory', label: 'High Memory' },
  { value: 'disk_warning', label: 'Disk Warning' },
  { value: 'stack_down', label: 'Stack Down' },
  { value: 'image_stale', label: 'Image Stale' },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'default', label: 'Default' },
  { value: 'low', label: 'Low' },
]

function triggerIcon(trigger: string) {
  switch (trigger) {
    case 'container_unhealthy': return <Shield size={11} />
    case 'container_stopped': return <XCircle size={11} />
    case 'container_high_cpu': return <Cpu size={11} />
    case 'container_high_memory': return <HardDrive size={11} />
    case 'disk_warning': return <HardDrive size={11} />
    case 'stack_down': return <Layers size={11} />
    case 'image_stale': return <Package size={11} />
    default: return <Bell size={11} />
  }
}

function triggerColor(trigger: string): string {
  switch (trigger) {
    case 'container_unhealthy': return 'bg-rose-500/15 text-rose-400 border-rose-500/20'
    case 'container_stopped': return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    case 'container_high_cpu': return 'bg-orange-500/15 text-orange-400 border-orange-500/20'
    case 'container_high_memory': return 'bg-violet-500/15 text-violet-400 border-violet-500/20'
    case 'disk_warning': return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    case 'stack_down': return 'bg-rose-500/15 text-rose-400 border-rose-500/20'
    case 'image_stale': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/20'
  }
}

function triggerLabel(trigger: string): string {
  return TRIGGER_OPTIONS.find((t) => t.value === trigger)?.label ?? trigger
}

function priorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'bg-rose-500/15 text-rose-400 border-rose-500/20'
    case 'high': return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    case 'default': return 'bg-slate-500/15 text-slate-400 border-slate-500/20'
    case 'low': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/20'
  }
}

function historyPriorityAccent(priority: string): string {
  switch (priority) {
    case 'urgent': return 'border-l-rose-500'
    case 'high': return 'border-l-amber-500'
    case 'default': return 'border-l-slate-500'
    case 'low': return 'border-l-cyan-500'
    default: return 'border-l-slate-500'
  }
}

function statusCodeColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-emerald-400'
  if (code >= 400) return 'text-rose-400'
  return 'text-amber-400'
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ts
  }
}

// ---------------------------------------------------------------------------
// Notifications Page
// ---------------------------------------------------------------------------

export default function Notifications() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  // UI state
  const [showAddModal, setShowAddModal] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(true)
  const [sendingTest, setSendingTest] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Add-rule form state
  const [newName, setNewName] = useState('')
  const [newTrigger, setNewTrigger] = useState<TriggerType>('container_unhealthy')
  const [newTarget, setNewTarget] = useState('*')
  const [newPriority, setNewPriority] = useState<Priority>('default')
  const [newTags, setNewTags] = useState('')

  // Polling
  const { data: rulesData, loading: rulesLoading, refresh: refreshRules } = usePolling(
    fetchNotificationRules, 10000, { enabled: isConnected },
  )
  const { data: historyData, loading: historyLoading, refresh: refreshHistory } = usePolling(
    fetchNotificationHistory, 30000, { enabled: isConnected },
  )
  const { data: configData } = usePolling(
    fetchConfig, 30000, { enabled: isConnected },
  )

  const rules: NotificationRule[] = useMemo(() => rulesData?.rules ?? [], [rulesData])
  const history: NotificationHistoryEntry[] = useMemo(() => historyData?.history ?? [], [historyData])
  const ntfyConfigured = configData?.ntfy_configured ?? false
  const ntfyUrl = configData?.ntfy_url ?? ''

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSendTest = useCallback(async () => {
    setSendingTest(true)
    try {
      const res = await sendTestNotification({ title: 'DCS Test', message: 'Test notification from Docker Compose Skeleton UI', priority: 'default' })
      if (res.success) {
        addToast({ type: 'success', message: 'Test notification sent successfully' })
      } else {
        addToast({ type: 'error', message: res.message || 'Failed to send test notification' })
      }
      refreshHistory()
    } catch {
      addToast({ type: 'error', message: 'Failed to send test notification' })
    } finally {
      setSendingTest(false)
    }
  }, [addToast, refreshHistory])

  const handleToggleRule = useCallback(async (rule: NotificationRule) => {
    setTogglingId(rule.id)
    try {
      await createNotificationRule({ ...rule, enabled: !rule.enabled })
      addToast({ type: 'success', message: `Rule "${rule.name}" ${rule.enabled ? 'disabled' : 'enabled'}` })
      refreshRules()
    } catch {
      addToast({ type: 'error', message: 'Failed to toggle rule' })
    } finally {
      setTogglingId(null)
    }
  }, [addToast, refreshRules])

  const handleDeleteRule = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      await deleteNotificationRule(id)
      addToast({ type: 'success', message: 'Notification rule deleted' })
      setConfirmDeleteId(null)
      refreshRules()
    } catch {
      addToast({ type: 'error', message: 'Failed to delete rule' })
    } finally {
      setDeletingId(null)
    }
  }, [addToast, refreshRules])

  const handleCreateRule = useCallback(async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const tags = newTags.split(',').map((t) => t.trim()).filter(Boolean)
      await createNotificationRule({
        name: newName.trim(),
        trigger: newTrigger,
        target: newTarget.trim() || '*',
        priority: newPriority,
        tags,
        enabled: true,
      })
      addToast({ type: 'success', message: `Rule "${newName.trim()}" created` })
      setShowAddModal(false)
      setNewName('')
      setNewTrigger('container_unhealthy')
      setNewTarget('*')
      setNewPriority('default')
      setNewTags('')
      refreshRules()
    } catch {
      addToast({ type: 'error', message: 'Failed to create notification rule' })
    } finally {
      setCreating(false)
    }
  }, [newName, newTrigger, newTarget, newPriority, newTags, addToast, refreshRules])

  // ---------------------------------------------------------------------------
  // Disconnected
  // ---------------------------------------------------------------------------

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
          <Bell size={24} className="text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">Connect to a server to manage notifications</p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/10 flex items-center justify-center text-amber-400">
            <Bell size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Notification Center</h2>
            <p className="text-xs text-slate-500">
              {rules.length} {rules.length === 1 ? 'rule' : 'rules'} configured
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSendTest}
            disabled={sendingTest || !ntfyConfigured}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-all duration-200 disabled:opacity-50 press"
            title={ntfyConfigured ? 'Send a test notification via NTFY' : 'NTFY is not configured'}
          >
            {sendingTest ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Send Test
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 press"
          >
            <Plus size={13} />
            Add Rule
          </button>
        </div>
      </div>

      {/* ── NTFY Connection Status ──────────────────────────────────────── */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-3 h-3 rounded-full ${ntfyConfigured ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {ntfyConfigured && (
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-30" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">NTFY Status</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {ntfyConfigured
                  ? 'Connected and ready to send notifications'
                  : 'NTFY is not configured on this server'}
              </p>
            </div>
          </div>
          {ntfyConfigured && ntfyUrl && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] text-slate-600 uppercase tracking-wider">Endpoint</span>
              <code className="text-xs font-mono text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                {ntfyUrl}
              </code>
            </div>
          )}
        </div>
        {ntfyConfigured && ntfyUrl && (
          <div className="sm:hidden mt-3 pt-3 border-t border-white/[0.04]">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">Endpoint</span>
            <code className="text-xs font-mono text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06] break-all">
              {ntfyUrl}
            </code>
          </div>
        )}
        {!ntfyConfigured && (
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/15">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-400/90">
                Configure NTFY_URL and NTFY_TOPIC in your server .env file to enable push notifications.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Rule List ───────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Notification Rules</h3>

        {/* Loading */}
        {rulesLoading && !rulesData && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-600" />
          </div>
        )}

        {/* Empty state */}
        {rulesData && rules.length === 0 && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-8 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
              <Bell size={22} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">No notification rules yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 press"
            >
              <Plus size={13} />
              Create First Rule
            </button>
          </div>
        )}

        {/* Rule cards */}
        {rules.length > 0 && (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6 transition-all ${
                  !rule.enabled ? 'opacity-60' : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: name + badges */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
                    <span className="text-sm font-semibold text-slate-200 truncate">{rule.name}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Trigger badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${triggerColor(rule.trigger)}`}>
                        {triggerIcon(rule.trigger)}
                        {triggerLabel(rule.trigger)}
                      </span>
                      {/* Priority badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priorityColor(rule.priority)}`}>
                        {rule.priority}
                      </span>
                      {/* Target */}
                      {rule.target && rule.target !== '*' && (
                        <span className="text-[10px] text-slate-500 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06]">
                          {rule.target}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: toggle + delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggleRule(rule)}
                      disabled={togglingId === rule.id}
                      className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.04]"
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {togglingId === rule.id ? (
                        <Loader2 size={18} className="animate-spin text-slate-500" />
                      ) : rule.enabled ? (
                        <ToggleRight size={22} className="text-emerald-400" />
                      ) : (
                        <ToggleLeft size={22} className="text-slate-600" />
                      )}
                    </button>

                    {/* Delete */}
                    {confirmDeleteId === rule.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          disabled={deletingId === rule.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-colors disabled:opacity-50"
                        >
                          {deletingId === rule.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(rule.id)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        title="Delete rule"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tags row */}
                {rule.tags && rule.tags.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {rule.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] text-slate-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Notification History (Collapsible) ──────────────────────────── */}
      <div>
        <button
          onClick={() => setHistoryExpanded(!historyExpanded)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-400 transition-colors mb-3"
        >
          <Clock size={13} />
          Notification History
          <span className="text-[10px] font-normal normal-case text-slate-600">
            ({history.length} {history.length === 1 ? 'entry' : 'entries'})
          </span>
          <svg
            className={`w-3.5 h-3.5 ml-1 transition-transform ${historyExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {historyExpanded && (
          <div className="animate-fade-in">
            {/* Loading */}
            {historyLoading && !historyData && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-slate-600" />
              </div>
            )}

            {/* Empty state */}
            {historyData && history.length === 0 && (
              <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-8 flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
                  <Clock size={18} className="text-slate-600" />
                </div>
                <p className="text-sm text-slate-500">No notifications sent yet</p>
              </div>
            )}

            {/* Timeline */}
            {history.length > 0 && (
              <div className="space-y-2">
                {history.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-5 border-l-2 ${historyPriorityAccent(entry.priority)}`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Type badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${triggerColor(entry.type)}`}>
                            {triggerIcon(entry.type)}
                            {triggerLabel(entry.type)}
                          </span>
                          {/* Priority badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priorityColor(entry.priority)}`}>
                            {entry.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 truncate">{entry.title}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Status code */}
                        <span className={`text-xs font-mono font-semibold ${statusCodeColor(entry.status_code)}`}>
                          {entry.status_code === 200 ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle size={12} />
                              200
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <XCircle size={12} />
                              {entry.status_code}
                            </span>
                          )}
                        </span>
                        {/* Timestamp */}
                        <span className="text-[10px] text-slate-600 whitespace-nowrap">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add Rule Modal (inline overlay) ─────────────────────────────── */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <div className="w-full max-w-md mx-4 bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">New Notification Rule</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                <XCircle size={16} />
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Rule Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Critical container alerts"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] transition-colors"
                />
              </div>

              {/* Trigger type */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Trigger Type</label>
                <select
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value as TriggerType)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 focus:outline-none focus:border-emerald-500/30 transition-colors appearance-none cursor-pointer"
                >
                  {TRIGGER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Target
                  <span className="text-slate-600 ml-1 normal-case">(container, stack, or * for all)</span>
                </label>
                <input
                  type="text"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="*"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] transition-colors"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Priority</label>
                <div className="flex gap-2">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setNewPriority(opt.value)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        newPriority === opt.value
                          ? priorityColor(opt.value).replace('/15', '/25')
                          : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:bg-white/[0.06]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Tags
                  <span className="text-slate-600 ml-1 normal-case">(comma-separated, optional)</span>
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="warning, server, docker"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] transition-colors"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRule}
                disabled={creating || !newName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 disabled:opacity-50 press"
              >
                {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Create Rule
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
