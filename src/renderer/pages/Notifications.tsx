// =============================================================================
// Notifications — NTFY Notification Center: rules, history, test, status
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell, Plus, Trash2, Send, CheckCircle, XCircle,
  ToggleLeft, ToggleRight, Loader2, AlertTriangle,
  Clock, Shield, Cpu, HardDrive, Box, Layers, Package,
  Webhook, ExternalLink, Zap, ChevronDown, Play, Power,
  HeartPulse, Archive,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import {
  fetchNotificationRules,
  createNotificationRule,
  deleteNotificationRule,
  fetchNotificationHistory,
  sendTestNotification,
  fetchConfig,
  fetchWebhooks,
  createWebhook,
  deleteWebhook,
  testWebhook,
} from '../api/endpoints'
import type { NotificationRule, NotificationHistoryEntry, Webhook as WebhookType } from '../../shared/types'

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
  | 'deploy_complete'
  | 'update_available'

type Priority = 'urgent' | 'high' | 'default' | 'low'

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'container_unhealthy', label: 'Container Unhealthy' },
  { value: 'container_stopped', label: 'Container Stopped' },
  { value: 'container_high_cpu', label: 'High CPU' },
  { value: 'container_high_memory', label: 'High Memory' },
  { value: 'disk_warning', label: 'Disk Warning' },
  { value: 'stack_down', label: 'Stack Down' },
  { value: 'image_stale', label: 'Image Stale' },
  { value: 'deploy_complete', label: 'Deploy Complete' },
  { value: 'update_available', label: 'Update Available' },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'default', label: 'Default' },
  { value: 'low', label: 'Low' },
]

/** Available template variables for notification messages */
const TEMPLATE_VARIABLES = [
  { var: '{stack}', desc: 'Stack name (e.g. media-services)' },
  { var: '{container}', desc: 'Container name (e.g. Plex)' },
  { var: '{status}', desc: 'Current status (e.g. unhealthy, stopped)' },
  { var: '{event}', desc: 'Event type (e.g. container_unhealthy)' },
  { var: '{timestamp}', desc: 'Current date/time' },
  { var: '{hostname}', desc: 'Server hostname' },
]

/** Premade notification rule templates */
interface PresetTemplate {
  name: string
  description: string
  trigger: TriggerType
  priority: Priority
  tags: string[]
  title_template: string
  message_template: string
  icon: React.ElementType
  iconBg: string
  iconText: string
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    name: 'Container Health Alert',
    description: 'Alert when any container becomes unhealthy',
    trigger: 'container_unhealthy',
    priority: 'urgent',
    tags: ['warning', 'docker', 'health'],
    title_template: '⚠️ {container} is Unhealthy',
    message_template: 'Container {container} in {stack} has become unhealthy. Check logs and restart if needed.',
    icon: HeartPulse,
    iconBg: 'bg-rose-500/10 border-rose-500/15',
    iconText: 'text-rose-400',
  },
  {
    name: 'Stack Down Alert',
    description: 'Notify when a stack is stopped or goes down',
    trigger: 'stack_down',
    priority: 'high',
    tags: ['warning', 'stack', 'down'],
    title_template: '🔴 Stack Down — {stack}',
    message_template: 'Stack {stack} has been stopped on {hostname} at {timestamp}.',
    icon: Power,
    iconBg: 'bg-amber-500/10 border-amber-500/15',
    iconText: 'text-amber-400',
  },
  {
    name: 'Container Stopped',
    description: 'Alert when a container stops unexpectedly',
    trigger: 'container_stopped',
    priority: 'high',
    tags: ['container', 'stopped'],
    title_template: '⏹️ {container} Stopped',
    message_template: '{container} in {stack} has stopped. Status: {status}.',
    icon: Box,
    iconBg: 'bg-orange-500/10 border-orange-500/15',
    iconText: 'text-orange-400',
  },
  {
    name: 'Disk Space Warning',
    description: 'Alert when disk usage exceeds threshold',
    trigger: 'disk_warning',
    priority: 'urgent',
    tags: ['disk', 'storage', 'warning'],
    title_template: '💾 Disk Space Critical',
    message_template: 'Disk usage on {hostname} is critically high. Free up space immediately.',
    icon: HardDrive,
    iconBg: 'bg-red-500/10 border-red-500/15',
    iconText: 'text-red-400',
  },
  {
    name: 'Image Update Available',
    description: 'Notify when container images have updates',
    trigger: 'image_stale',
    priority: 'low',
    tags: ['update', 'image'],
    title_template: '📦 Image Updates Available',
    message_template: 'Container images have upstream updates available. Check the Updates page.',
    icon: Package,
    iconBg: 'bg-cyan-500/10 border-cyan-500/15',
    iconText: 'text-cyan-400',
  },
  {
    name: 'Deploy Complete',
    description: 'Confirm when a template deployment finishes',
    trigger: 'deploy_complete',
    priority: 'default',
    tags: ['deploy', 'success'],
    title_template: '✅ Deployed — {stack}',
    message_template: 'Template deployed to {stack} on {hostname} at {timestamp}.',
    icon: Play,
    iconBg: 'bg-emerald-500/10 border-emerald-500/15',
    iconText: 'text-emerald-400',
  },
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
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const { addToast } = useToast()

  // UI state
  const [showAddModal, setShowAddModal] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(true)
  const [sendingTest, setSendingTest] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Webhook state
  const [webhooksExpanded, setWebhooksExpanded] = useState(true)
  const [showAddWebhook, setShowAddWebhook] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookEvents, setWebhookEvents] = useState<Set<string>>(new Set(['deploy', 'health_change']))
  const [creatingWebhook, setCreatingWebhook] = useState(false)
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null)
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null)
  const [confirmDeleteWebhookId, setConfirmDeleteWebhookId] = useState<string | null>(null)

  // Close topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showAddModal) { setShowAddModal(false); return }
      if (confirmDeleteId) { setConfirmDeleteId(null); return }
      if (confirmDeleteWebhookId) { setConfirmDeleteWebhookId(null); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showAddModal, confirmDeleteId, confirmDeleteWebhookId])

  // Add-rule form state
  const [newName, setNewName] = useState('')
  const [newTrigger, setNewTrigger] = useState<TriggerType>('container_unhealthy')
  const [newTarget, setNewTarget] = useState('*')
  const [newPriority, setNewPriority] = useState<Priority>('default')
  const [newTags, setNewTags] = useState('')
  const [newTitleTemplate, setNewTitleTemplate] = useState('')
  const [newMessageTemplate, setNewMessageTemplate] = useState('')
  const [showGuide, setShowGuide] = useState(false)

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

  // Webhook polling
  const { data: webhooksData, refresh: refreshWebhooks } = usePolling(
    fetchWebhooks, 15000, { enabled: isConnected },
  )

  const rules: NotificationRule[] = useMemo(() => rulesData?.rules ?? [], [rulesData])
  const history: NotificationHistoryEntry[] = useMemo(() => historyData?.history ?? [], [historyData])
  const webhooks: WebhookType[] = useMemo(() => webhooksData?.webhooks ?? [], [webhooksData])
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

  const resetForm = useCallback(() => {
    setNewName('')
    setNewTrigger('container_unhealthy')
    setNewTarget('*')
    setNewPriority('default')
    setNewTags('')
    setNewTitleTemplate('')
    setNewMessageTemplate('')
  }, [])

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
        title_template: newTitleTemplate.trim(),
        message_template: newMessageTemplate.trim(),
      })
      addToast({ type: 'success', message: `Rule "${newName.trim()}" created` })
      setShowAddModal(false)
      resetForm()
      refreshRules()
    } catch {
      addToast({ type: 'error', message: 'Failed to create notification rule' })
    } finally {
      setCreating(false)
    }
  }, [newName, newTrigger, newTarget, newPriority, newTags, newTitleTemplate, newMessageTemplate, addToast, refreshRules, resetForm])

  /** Apply a preset template to the form */
  const applyPreset = useCallback((preset: PresetTemplate) => {
    setNewName(preset.name)
    setNewTrigger(preset.trigger)
    setNewPriority(preset.priority)
    setNewTags(preset.tags.join(', '))
    setNewTitleTemplate(preset.title_template)
    setNewMessageTemplate(preset.message_template)
    setNewTarget('*')
    setShowAddModal(true)
  }, [])

  // Webhook handlers
  const handleCreateWebhook = useCallback(async () => {
    if (!webhookUrl.trim() || creatingWebhook) return
    setCreatingWebhook(true)
    try {
      await createWebhook({
        url: webhookUrl.trim(),
        events: Array.from(webhookEvents),
        enabled: true,
      })
      addToast({ type: 'success', message: 'Webhook created' })
      setShowAddWebhook(false)
      setWebhookUrl('')
      setWebhookEvents(new Set(['deploy', 'health_change']))
      refreshWebhooks()
    } catch {
      addToast({ type: 'error', message: 'Failed to create webhook' })
    } finally {
      setCreatingWebhook(false)
    }
  }, [webhookUrl, webhookEvents, creatingWebhook, addToast, refreshWebhooks])

  const handleDeleteWebhook = useCallback(async (id: string) => {
    setDeletingWebhookId(id)
    try {
      await deleteWebhook(id)
      addToast({ type: 'success', message: 'Webhook deleted' })
      setConfirmDeleteWebhookId(null)
      refreshWebhooks()
    } catch {
      addToast({ type: 'error', message: 'Failed to delete webhook' })
    } finally {
      setDeletingWebhookId(null)
    }
  }, [addToast, refreshWebhooks])

  const handleTestWebhook = useCallback(async (id: string) => {
    setTestingWebhookId(id)
    try {
      const res = await testWebhook(id)
      if (res.success) {
        addToast({ type: 'success', message: `Webhook test sent (${res.status_code})` })
      } else {
        addToast({ type: 'error', message: `Webhook test failed (${res.status_code})` })
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to test webhook' })
    } finally {
      setTestingWebhookId(null)
    }
  }, [addToast])

  const toggleWebhookEvent = useCallback((event: string) => {
    setWebhookEvents((prev) => {
      const next = new Set(prev)
      if (next.has(event)) next.delete(event)
      else next.add(event)
      return next
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Disconnected
  // ---------------------------------------------------------------------------

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
          <Bell size={24} className="text-slate-500" />
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
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-white/5">
            <Bell size={24} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold"><span className="text-gradient">Notification Center</span></h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {rules.length} {rules.length === 1 ? 'rule' : 'rules'} configured
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 transition-all duration-200 press"
          >
            <Archive size={13} />
            Guide
          </button>
          <button
            onClick={handleSendTest}
            disabled={sendingTest || !ntfyConfigured}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-all duration-200 disabled:opacity-50 press"
            title={ntfyConfigured ? 'Send a test notification via NTFY' : 'NTFY is not configured'}
          >
            {sendingTest ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Send Test
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 press"
            >
              <Plus size={13} />
              Add Rule
            </button>
          )}
        </div>
      </div>

      {/* ── Guide Section ──────────────────────────────────────────────── */}
      {showGuide && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Notification Guide</h2>
            </div>
            <button onClick={() => setShowGuide(false)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
              <XCircle size={14} className="text-slate-400" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-400">
              Create notification rules that fire automatically when events occur. Customize the NTFY message title, body, priority, and tags. Use template variables to include dynamic context.
            </p>

            {/* How it works */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-[10px] font-bold">1</div>
                  <span className="text-xs font-medium text-slate-300">Create a Rule</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">Choose a trigger event, set priority, and write your notification message using template variables.</p>
              </div>
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center text-amber-400 text-[10px] font-bold">2</div>
                  <span className="text-xs font-medium text-slate-300">Event Fires</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">When the trigger event occurs (container down, stack stopped, etc.), DCS evaluates all matching rules.</p>
              </div>
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/15 flex items-center justify-center text-cyan-400 text-[10px] font-bold">3</div>
                  <span className="text-xs font-medium text-slate-300">NTFY Sends</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">Variables are substituted and the notification is pushed to your NTFY topic instantly.</p>
              </div>
            </div>

            {/* Template Variables */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 mb-2">Template Variables</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <div key={v.var} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.03]">
                    <code className="text-amber-400 text-[10px] font-mono font-medium bg-amber-500/10 px-1.5 py-0.5 rounded">{v.var}</code>
                    <span className="text-[10px] text-slate-500 truncate">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Example */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 mb-2">Example Notification</h3>
              <div className="rounded-lg bg-slate-950/60 border border-white/5 p-3 font-mono text-[11px] space-y-1">
                <p className="text-slate-500">Title:</p>
                <p className="text-amber-300 ml-2">⚠️ {'{'}<span className="text-amber-400">container</span>{'}'} is Unhealthy</p>
                <p className="text-slate-500 mt-2">Message:</p>
                <p className="text-slate-300 ml-2">Container {'{'}<span className="text-amber-400">container</span>{'}'} in {'{'}<span className="text-amber-400">stack</span>{'}'} has become unhealthy at {'{'}<span className="text-amber-400">timestamp</span>{'}'}.</p>
                <p className="text-slate-500 mt-2">Sends as:</p>
                <p className="text-emerald-300 ml-2">⚠️ Plex is Unhealthy</p>
                <p className="text-slate-300 ml-2">Container Plex in media-services has become unhealthy at 2026-03-30 21:15:00.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Add Presets ──────────────────────────────────────────── */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quick Add — Notification Presets</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRESET_TEMPLATES.map((preset) => {
            const PresetIcon = preset.icon
            const alreadyExists = rules.some((r) => r.trigger === preset.trigger && r.name === preset.name)
            return (
              <button
                key={preset.name}
                onClick={() => !alreadyExists && applyPreset(preset)}
                disabled={alreadyExists}
                className={`
                  group text-left rounded-xl border p-3.5 transition-all duration-200
                  ${alreadyExists
                    ? 'border-white/[0.03] bg-white/[0.01] opacity-50 cursor-default'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 cursor-pointer press'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${preset.iconBg} ${preset.iconText}`}>
                    <PresetIcon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">{preset.name}</span>
                      {alreadyExists && (
                        <span className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-full">Added</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">{preset.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${priorityColor(preset.priority)}`}>
                        {preset.priority}
                      </span>
                      <span className="text-[9px] text-slate-600">{preset.tags.join(', ')}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── NTFY Connection Status ──────────────────────────────────────── */}
      <div className="glass border border-white/5 rounded-xl p-4 md:p-6">
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
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Endpoint</span>
              <code className="text-xs font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                {ntfyUrl}
              </code>
            </div>
          )}
        </div>
        {ntfyConfigured && ntfyUrl && (
          <div className="sm:hidden mt-3 pt-3 border-t border-white/[0.03]">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Endpoint</span>
            <code className="text-xs font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5 break-all">
              {ntfyUrl}
            </code>
          </div>
        )}
        {!ntfyConfigured && (
          <div className="mt-3 pt-3 border-t border-white/[0.03]">
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
            <Loader2 size={24} className="animate-spin text-slate-500" />
          </div>
        )}

        {/* Empty state */}
        {rulesData && rules.length === 0 && (
          <div className="glass border border-white/5 rounded-xl p-8 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
              <Bell size={22} className="text-slate-500" />
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
                className={`glass border border-white/5 rounded-xl p-4 md:p-6 transition-all ${
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
                        <span className="text-[10px] text-slate-500 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/5">
                          {rule.target}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: toggle + delete (admin only) */}
                  {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggleRule(rule)}
                      disabled={togglingId === rule.id}
                      className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {togglingId === rule.id ? (
                        <Loader2 size={18} className="animate-spin text-slate-500" />
                      ) : rule.enabled ? (
                        <ToggleRight size={22} className="text-emerald-400" />
                      ) : (
                        <ToggleLeft size={22} className="text-slate-500" />
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
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        title="Delete rule"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  )}
                </div>

                {/* Tags row */}
                {rule.tags && rule.tags.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {rule.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] text-slate-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/5"
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
          <span className="text-[10px] font-normal normal-case text-slate-500">
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
                <Loader2 size={20} className="animate-spin text-slate-500" />
              </div>
            )}

            {/* Empty state */}
            {historyData && history.length === 0 && (
              <div className="glass border border-white/5 rounded-xl p-8 flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
                  <Clock size={18} className="text-slate-500" />
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
                    className={`glass border border-white/5 rounded-xl p-4 md:p-5 border-l-2 ${historyPriorityAccent(entry.priority)}`}
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
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
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

      {/* ── Webhooks Section ──────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => setWebhooksExpanded(!webhooksExpanded)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-400 transition-colors mb-3"
        >
          <Webhook size={13} />
          Webhooks
          <span className="text-[10px] font-normal normal-case text-slate-500">
            ({webhooks.length} {webhooks.length === 1 ? 'webhook' : 'webhooks'})
          </span>
          <ChevronDown
            size={14}
            className={`ml-1 transition-transform ${webhooksExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {webhooksExpanded && (
          <div className="space-y-3 animate-fade-in">
            {/* Add webhook button — admin only */}
            {isAdmin && (
              <div className="flex items-center justify-end">
                <button
                  onClick={() => setShowAddWebhook(!showAddWebhook)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-all duration-200 press"
                >
                  <Plus size={13} />
                  Add Webhook
                </button>
              </div>
            )}

            {/* Inline add webhook form */}
            {showAddWebhook && (
              <div className="bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 rounded-xl p-4 md:p-5 space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-1">
                  <Webhook size={14} className="text-cyan-400" />
                  <h4 className="text-xs font-semibold text-slate-300">New Webhook</h4>
                </div>

                {/* URL input */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Webhook URL</label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://example.com/webhook"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500/30 focus:bg-white/[0.05] transition-colors"
                  />
                </div>

                {/* Event checkboxes */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 block">Events</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {WEBHOOK_EVENT_TYPES.map((evt) => (
                      <button
                        key={evt.value}
                        onClick={() => toggleWebhookEvent(evt.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all ${
                          webhookEvents.has(evt.value)
                            ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
                            : 'bg-white/[0.03] text-slate-500 border-white/5 hover:bg-white/5'
                        }`}
                      >
                        {webhookEventIcon(evt.value)}
                        {evt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowAddWebhook(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateWebhook}
                    disabled={creatingWebhook || !webhookUrl.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-all disabled:opacity-50 press"
                  >
                    {creatingWebhook ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Create Webhook
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {webhooks.length === 0 && (
              <div className="glass border border-white/5 rounded-xl p-8 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
                  <Webhook size={18} className="text-slate-500" />
                </div>
                <p className="text-sm text-slate-500">No webhooks configured</p>
                <p className="text-xs text-slate-500">Add a webhook to receive event notifications via HTTP</p>
              </div>
            )}

            {/* Webhook list */}
            {webhooks.length > 0 && (
              <div className="space-y-2">
                {webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    className={`glass border border-white/5 rounded-xl p-4 md:p-5 transition-all ${
                      !wh.enabled ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left: URL + events */}
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <ExternalLink size={12} className="text-cyan-400 flex-shrink-0" />
                          <code className="text-xs font-mono text-slate-300 truncate">{wh.url}</code>
                          {wh.enabled ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-500/15 text-slate-500 border border-slate-500/20">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {wh.events.map((evt) => (
                            <span
                              key={evt}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-white/5 text-slate-500 border border-white/5"
                            >
                              {webhookEventIcon(evt)}
                              {evt}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Test */}
                        <button
                          onClick={() => handleTestWebhook(wh.id)}
                          disabled={testingWebhookId === wh.id}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-50"
                          title="Send test payload"
                        >
                          {testingWebhookId === wh.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                          Test
                        </button>

                        {/* Delete — admin only */}
                        {isAdmin && (
                          confirmDeleteWebhookId === wh.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDeleteWebhook(wh.id)}
                                disabled={deletingWebhookId === wh.id}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25 transition-colors disabled:opacity-50"
                              >
                                {deletingWebhookId === wh.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteWebhookId(null)}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-400 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteWebhookId(wh.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                              title="Delete webhook"
                            >
                              <Trash2 size={13} />
                            </button>
                          )
                        )}
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
          <div className="w-full max-w-lg mx-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/40 animate-scale-in overflow-hidden max-h-[90vh] overflow-y-auto scrollbar-thin">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">New Notification Rule</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
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
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] transition-colors"
                />
              </div>

              {/* Trigger type */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Trigger Type</label>
                <select
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value as TriggerType)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/30 transition-colors appearance-none cursor-pointer"
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
                  <span className="text-slate-500 ml-1 normal-case">(container, stack, or * for all)</span>
                </label>
                <input
                  type="text"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="*"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] transition-colors"
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
                          : 'bg-white/[0.03] text-slate-500 border-white/5 hover:bg-white/5'
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
                  <span className="text-slate-500 ml-1 normal-case">(comma-separated, optional)</span>
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="warning, server, docker"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.05] transition-colors"
                />
              </div>

              {/* Notification Message section */}
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Send size={12} className="text-amber-400" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">NTFY Message</span>
                </div>

                {/* Title Template */}
                <div className="mb-3">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Title
                    <span className="text-slate-600 ml-1 normal-case">— use {'{'}<span className="text-amber-400">variables</span>{'}'} for dynamic content</span>
                  </label>
                  <input
                    type="text"
                    value={newTitleTemplate}
                    onChange={(e) => setNewTitleTemplate(e.target.value)}
                    placeholder="e.g. ⚠️ {container} is {status}"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.05] transition-colors"
                  />
                </div>

                {/* Message Template */}
                <div className="mb-3">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Message Body</label>
                  <textarea
                    value={newMessageTemplate}
                    onChange={(e) => setNewMessageTemplate(e.target.value)}
                    rows={3}
                    placeholder="e.g. Container {container} in {stack} needs attention. Status: {status}"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.05] transition-colors resize-none"
                  />
                </div>

                {/* Quick variable buttons */}
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.var}
                      type="button"
                      onClick={() => {
                        // Insert at the end of message template
                        setNewMessageTemplate((prev) => prev ? `${prev} ${v.var}` : v.var)
                      }}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/15 hover:bg-amber-500/20 transition-colors"
                      title={v.desc}
                    >
                      {v.var}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/5">
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

// ---------------------------------------------------------------------------
// Webhook constants & helpers
// ---------------------------------------------------------------------------

const WEBHOOK_EVENT_TYPES = [
  { value: 'deploy', label: 'Deploy' },
  { value: 'undeploy', label: 'Undeploy' },
  { value: 'health_change', label: 'Health Change' },
  { value: 'backup_complete', label: 'Backup Complete' },
  { value: 'stack_start', label: 'Stack Start' },
  { value: 'stack_stop', label: 'Stack Stop' },
]

function webhookEventIcon(event: string) {
  switch (event) {
    case 'deploy': return <Zap size={9} />
    case 'undeploy': return <Trash2 size={9} />
    case 'health_change': return <HeartPulse size={9} />
    case 'backup_complete': return <Archive size={9} />
    case 'stack_start': return <Play size={9} />
    case 'stack_stop': return <Power size={9} />
    default: return <Bell size={9} />
  }
}
