// =============================================================================
// Automations — rules that run an action by themselves: on a schedule (a cron
// expression) or when a condition on the system is met (a container unhealthy,
// a disk full). Create one, switch it on or off, run it now, read its history.
// On a hub: Everywhere lists every server's rules, a rule lives on one server.
// =============================================================================

import { useState, useMemo, useCallback, useEffect, useRef, useId } from 'react'
import { Badge, SegmentedControl, Switch } from '@mantine/core'
import {
  Zap, Plus, Trash2, Clock, Play, Pause, Loader2,
  CalendarClock, RefreshCw,
  AlertTriangle, Box, Layers, HardDrive, Bell, Archive,
  X, History, CheckCircle, XCircle, ChevronDown, ChevronUp,
  BookOpen, ChevronRight, Terminal, Pencil, PlayCircle,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { EmptyState, ErrorState } from '../components/common/PageState'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useToast } from '../components/common/Toast'
import { useConfirm } from '../components/common/ConfirmDialog'
import PageHeader from '../components/common/PageHeader'
import Hint from '../components/common/Hint'
import { pageLabel } from '../constants/pageTitles'
import {
  BTN_TOOLBAR, BTN_TOOLBAR_QUIET, BTN_CARD, BTN_ICON_SM, BTN_SHEET_QUIET, BTN_SHEET_PRIMARY,
  TONE_OK, TONE_QUIET, TONE_DANGER, TONE_GHOST,
} from '../lib/ui'
import {
  fetchAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  fetchAutomationHistory,
  runAutomation,
} from '../api/endpoints'
import { useFleetScope } from '../hooks/useFleetScope'
import FleetScopeChips from '../components/fleet/FleetScopeChips'
import VmCapsule from '../components/fleet/VmCapsule'
import type { AutomationRule, AutomationHistoryEntry } from '../../shared/types'
import ModalOverlay from '../components/common/ModalOverlay'

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: 'Every minute (* * * * *)', cron: '* * * * *' },
  { label: 'Hourly (0 * * * *)', cron: '0 * * * *' },
  { label: 'Daily at midnight (0 0 * * *)', cron: '0 0 * * *' },
  { label: 'Weekly on Sunday (0 0 * * 0)', cron: '0 0 * * 0' },
  { label: 'Monthly (0 0 1 * *)', cron: '0 0 1 * *' },
]

const CONDITION_OPTIONS = [
  { value: 'container_unhealthy', label: 'Container unhealthy' },
  { value: 'container_stopped', label: 'Container exited with an error' },
  { value: 'high_cpu', label: 'High CPU usage (≥90%)' },
  { value: 'high_memory', label: 'High memory usage (≥90%)' },
  { value: 'disk_full', label: 'Disk full (≥90%)' },
]

const ACTION_TYPES = [
  { value: 'stack_restart', label: 'Restart stack' },
  { value: 'container_restart', label: 'Restart container' },
  { value: 'stack_start', label: 'Start stack' },
  { value: 'stack_stop', label: 'Stop stack' },
  { value: 'docker_prune', label: 'Docker prune' },
  { value: 'backup_trigger', label: 'Start a backup' },
  { value: 'notification_send', label: 'Send notification' },
]

/** what an action does to the system decides its colour: start emerald, stop and prune rose, restart amber, the rest information */
function actionTone(actionType: string): 'emerald' | 'rose' | 'amber' | 'cyan' | 'slate' {
  switch (actionType) {
    case 'stack_start': return 'emerald'
    case 'stack_stop':
    case 'docker_prune': return 'rose'
    case 'stack_restart':
    case 'container_restart': return 'amber'
    case 'backup_trigger':
    case 'notification_send': return 'cyan'
    default: return 'slate'
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

/** the fields of the rule dialog: one look, one focus ring */
const FIELD = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 placeholder-slate-600 transition-colors focus:outline-none focus-visible:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-emerald-500/40'
const LABEL = 'text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block font-semibold'

const AUTOMATION_GUIDE_SECTIONS = [
  {
    title: 'Schedule-based rules',
    icon: CalendarClock,
    content: `Schedule rules use cron expressions to run actions
at specific intervals. Common patterns:

* * * * *      Every minute
0 * * * *      Every hour
0 0 * * *      Daily at midnight
0 0 * * 0      Weekly on Sunday
0 */6 * * *    Every 6 hours
0 3 * * *      Daily at 3 AM

Fields: minute hour day-of-month month day-of-week

The DCS server evaluates every enabled rule once a
minute in the server's time zone (TZ) — no crontab.`,
  },
  {
    title: 'Condition-based rules',
    icon: AlertTriangle,
    content: `Condition rules trigger when a monitored state
changes. Available conditions:

container_unhealthy   A container's health check fails
container_stopped     A container exited with an error
high_cpu              Load per core is at or above 90%
high_memory           Memory usage is at or above 90%
disk_full             The installation's disk is 90% full

Conditions are checked every minute. After firing, a
rule waits 15 minutes before it can fire again, so a
flapping container does not trigger a restart storm.
With target "*", container actions apply to the
containers that matched the condition.`,
  },
  {
    title: 'Available actions',
    icon: Zap,
    content: `stack_start          Start a specific stack
stack_stop           Stop a specific stack
stack_restart        Restart a specific stack
container_restart    Restart a specific container
docker_prune         Run Docker system prune
backup_trigger       Start a configuration backup
notification_send    Send a notification alert

Set target to * to apply to all, or specify
a stack/container name. For "Send notification"
the target is the message text.

"Run now" on a card executes the action immediately
and records the outcome in its history.`,
  },
  {
    title: 'Example: nightly cleanup',
    icon: Terminal,
    content: `Name:        "Nightly Docker prune"
Trigger:     Schedule → 0 3 * * *
Action:      Docker prune
Target:      *

This runs docker system prune at 3 AM every night,
removing unused containers, images, and networks.`,
  },
]

// ---------------------------------------------------------------------------
// Automations Page
// ---------------------------------------------------------------------------

export default function Automations() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()
  const confirm = useConfirm()
  const uid = useId()

  // Modal & form state
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formTriggerType, setFormTriggerType] = useState<'schedule' | 'condition'>('schedule')
  const [formCron, setFormCron] = useState('0 * * * *')
  const [formCondition, setFormCondition] = useState('container_unhealthy')
  const [formActionType, setFormActionType] = useState('stack_restart')
  const [formActionTarget, setFormActionTarget] = useState('')

  // Delete in progress (the question itself is the shared confirmation)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Toggle loading state
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Guide panel state
  const [showGuide, setShowGuide] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null)

  // History panel state
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null)
  const [historyRuleName, setHistoryRuleName] = useState('')
  const [historyEntries, setHistoryEntries] = useState<AutomationHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState<number | null>(null)

  // Polling
  const { scope, setScope, member: scopeMember, memberName, members: scopeMembers, hasFleet } = useFleetScope()
  const fetchScopedAutomations = useCallback(() => fetchAutomations(scope), [scope])
  const { data, loading, error, refresh } = usePolling(
    fetchScopedAutomations,
    10000,
    { enabled: isConnected },
  )
  const scopeRef = useRef(scope)
  useEffect(() => { if (scopeRef.current !== scope) { scopeRef.current = scope; refresh() } }, [scope, refresh])

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
      await updateAutomation(rule.id, { enabled: !rule.enabled }, rule.member ?? scopeMember)
      addToast({
        type: 'success',
        message: `${rule.name} ${rule.enabled ? 'disabled' : 'enabled'}`,
      })
      refresh()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : `Could not switch ${rule.name}` })
    } finally {
      setTogglingId(null)
    }
  }, [addToast, refresh, scopeMember])

  const handleRun = useCallback(async (rule: AutomationRule) => {
    setRunningId(rule.id)
    try {
      const res = await runAutomation(rule.id, rule.member ?? scopeMember)
      addToast({ type: res.success ? 'success' : 'error', message: `${rule.name}: ${res.message || (res.success ? 'done' : 'failed')}` })
      refresh()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : `Could not run ${rule.name}` })
    } finally {
      setRunningId(null)
    }
  }, [addToast, refresh, scopeMember])

  const handleDelete = useCallback(async (rule: AutomationRule) => {
    if (scope === 'all') { addToast({ type: 'info', message: 'Everywhere is a view: pick the hub or one VM above, then change it there' }); return }
    const ok = await confirm({
      title: 'Delete this automation?',
      message: `"${rule.name}" is removed together with its run history. This cannot be undone.`,
      confirmLabel: 'Delete automation',
      danger: true,
    })
    if (!ok) return
    setDeletingId(rule.id)
    try {
      await deleteAutomation(rule.id, scopeMember)
      addToast({ type: 'success', message: 'Automation rule deleted' })
      refresh()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not delete the automation rule' })
    } finally {
      setDeletingId(null)
    }
  }, [addToast, refresh, scope, scopeMember, confirm])

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) return
    if (scope === 'all') { addToast({ type: 'info', message: 'Everywhere is a view: pick the hub or one VM above, then change it there' }); return }
    setCreating(true)
    try {
      const triggerValue = formTriggerType === 'schedule' ? formCron : formCondition
      const payload = {
        name: formName.trim(),
        trigger_type: formTriggerType,
        trigger_value: triggerValue,
        action_type: formActionType,
        action_target: formActionTarget.trim() || '*',
      }
      if (editingId) {
        await updateAutomation(editingId, payload, scopeMember)
        addToast({ type: 'success', message: 'Automation rule updated' })
      } else {
        await createAutomation({ ...payload, enabled: true }, scopeMember)
        addToast({ type: 'success', message: 'Automation rule created' })
      }
      setShowCreateModal(false)
      resetForm()
      refresh()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not save the automation rule' })
    } finally {
      setCreating(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formName, formTriggerType, formCron, formCondition, formActionType, formActionTarget, editingId, addToast, refresh, scope, scopeMember])

  const resetForm = useCallback(() => {
    setEditingId(null)
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

  const openEditModal = useCallback((rule: AutomationRule) => {
    setEditingId(rule.id)
    setFormName(rule.name)
    setFormTriggerType(rule.trigger_type)
    if (rule.trigger_type === 'schedule') setFormCron(rule.trigger_value || '0 * * * *')
    else setFormCondition(rule.trigger_value || 'container_unhealthy')
    setFormActionType(rule.action_type)
    setFormActionTarget(rule.action_target === '*' ? '' : rule.action_target)
    setShowCreateModal(true)
  }, [])

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
      addToast({ type: 'error', message: `Could not load the history of ${rule.name}` })
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
    return <EmptyState icon={<Zap size={32} />} title="Connect to a server to manage automations" />
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5 animate-fade-in">
      <DisconnectedBanner />
      <PageHeader
        page="automations"
        badge={scopeMember ? <VmCapsule member={scopeMember} name={memberName} vmid={scopeMembers.find((m) => m.id === scopeMember)?.vmid} /> : undefined}
        subtitle={stats.total > 0 ? `${stats.active} active of ${stats.total} rule${stats.total === 1 ? '' : 's'} · they run on a schedule or when a condition is met` : 'Rules that run an action on a schedule or when a condition on the system is met'}
        actions={<>
          {isAdmin && (
            <button type="button" onClick={openCreateModal} className={`${BTN_TOOLBAR} ${TONE_OK}`}>
              <Plus size={14} />
              Add automation
            </button>
          )}
          <Hint label={showGuide ? 'Hide the guide' : 'Show the guide'}>
            <button
              type="button"
              aria-label="Guide"
              aria-expanded={showGuide}
              onClick={() => setShowGuide(!showGuide)}
              className={`${BTN_TOOLBAR} ${showGuide ? 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/25' : TONE_QUIET}`}
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">Guide</span>
            </button>
          </Hint>
          <button type="button" aria-label="Refresh" onClick={refresh} disabled={loading} className={BTN_TOOLBAR_QUIET}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </>}
      >
        {hasFleet && <FleetScopeChips scope={scope} members={scopeMembers} onChange={setScope} label="Show" busy={loading && !!data} />}
      </PageHeader>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        <div className="glass border border-white/5 rounded-xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={14} className="text-slate-400" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total rules</span>
          </div>
          <p className="text-2xl font-bold text-slate-100 tabular-nums">{stats.total}</p>
        </div>

        <div className="glass border border-white/5 rounded-xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-emerald-400" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Active</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{stats.active}</p>
        </div>

        <div className="glass border border-white/5 rounded-xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock size={14} className="text-slate-400" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Scheduled</span>
          </div>
          <p className="text-2xl font-bold text-slate-100 tabular-nums">{stats.scheduled}</p>
        </div>

        <div className="glass border border-white/5 rounded-xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-slate-400" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Condition</span>
          </div>
          <p className="text-2xl font-bold text-slate-100 tabular-nums">{stats.conditionBased}</p>
        </div>
      </div>

      {/* Automation guide (collapsible) */}
      {showGuide && (
        <section aria-label={`${pageLabel('automations')} guide`} className="glass rounded-xl border border-white/5 overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-slate-400" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-200">{pageLabel('automations')} guide</h2>
            </div>
            <Hint label="Close the guide">
              <button type="button" aria-label="Close the guide" onClick={() => setShowGuide(false)} className={`${BTN_ICON_SM} ${TONE_GHOST}`}>
                <X size={14} />
              </button>
            </Hint>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-400 mb-4">
              Automations let you schedule recurring Docker operations or react to system conditions automatically.
              Create rules with cron schedules or condition triggers to run actions on your stacks and containers.
            </p>
            {AUTOMATION_GUIDE_SECTIONS.map((section, i) => {
              const isExpanded = expandedGuide === i
              const Icon = section.icon
              return (
                <div key={section.title} className="border border-white/[0.03] rounded-lg overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedGuide(isExpanded ? null : i)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40"
                  >
                    <Icon size={14} className="text-slate-400 shrink-0" aria-hidden />
                    <span className="text-sm font-medium text-slate-200 flex-1">{section.title}</span>
                    {isExpanded
                      ? <ChevronDown size={14} className="text-slate-500" aria-hidden />
                      : <ChevronRight size={14} className="text-slate-500" aria-hidden />
                    }
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 animate-fade-in">
                      <pre className="bg-slate-950/60 border border-white/[0.03] rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto scrollbar-thin whitespace-pre leading-relaxed">
                        {section.content}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Loading: the shape of a rule card */}
      {loading && !data && (
        <div className="space-y-3" role="status" aria-label="Reading the automations">
          {[0, 1].map((i) => <div key={i} className="glass border border-white/5 rounded-xl h-40 skeleton" aria-hidden />)}
        </div>
      )}
      {error && !data && (
        <ErrorState title="Could not load the automations" error={error} onRetry={refresh} />
      )}

      {/* Empty state */}
      {data && automations.length === 0 && (
        <div className="glass border border-white/5 rounded-xl">
          <EmptyState
            icon={<Zap size={32} />}
            title="No automation rules yet"
            hint="Create your first rule to automate Docker operations."
            action={isAdmin ? (
              <button type="button" onClick={openCreateModal} className={`${BTN_TOOLBAR} ${TONE_OK}`}>
                <Plus size={14} />
                Add automation
              </button>
            ) : undefined}
          />
        </div>
      )}

      {/* Rule cards */}
      {automations.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 stagger-children">
          {automations.map((rule) => (
            <li
              key={rule.id}
              className={`glass border rounded-xl p-4 md:p-5 transition-colors ${
                rule.enabled
                  ? 'border-white/5'
                  : 'border-white/[0.03] opacity-70'
              }`}
            >
              {/* Top row: name + switch */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-slate-100 truncate">{rule.name}</h2>
                  {rule.member !== undefined && <div className="mt-1"><VmCapsule member={rule.member} name={rule.member_name} vmid={rule.vmid} size="xs" onClick={() => setScope(rule.member ?? 'hub')} /></div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {togglingId === rule.id && <Loader2 size={14} className="animate-spin text-slate-500" aria-hidden />}
                  {/* (not disabled while it saves: a disabled control drops the keyboard's focus) */}
                  <Switch
                    checked={rule.enabled}
                    onChange={() => { if (isAdmin && !togglingId) handleToggle(rule) }}
                    disabled={!isAdmin}
                    aria-busy={togglingId === rule.id}
                    aria-label={`Enable ${rule.name}`}
                  />
                </div>
              </div>

              {/* Trigger + action badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {rule.trigger_type === 'schedule' ? (
                  <Badge component="span" color="slate" leftSection={<CalendarClock size={10} />}>Schedule</Badge>
                ) : (
                  <Badge component="span" color="slate" leftSection={<AlertTriangle size={10} />}>Condition</Badge>
                )}

                <Badge component="span" color={actionTone(rule.action_type)} leftSection={actionIcon(rule.action_type)}>
                  {actionLabel(rule.action_type)}
                </Badge>
              </div>

              {/* Detail rows */}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs mb-3">
                <div className="flex items-center gap-2">
                  <dt className="text-slate-500 shrink-0 w-16">Trigger:</dt>
                  <dd>
                    {rule.trigger_type === 'schedule' ? (
                      <code className="font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/15 text-[11px]">
                        {rule.trigger_value}
                      </code>
                    ) : (
                      <span className="text-slate-200">{CONDITION_OPTIONS.find((c) => c.value === rule.trigger_value)?.label ?? rule.trigger_value}</span>
                    )}
                  </dd>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <dt className="text-slate-500 shrink-0 w-16">Target:</dt>
                  <dd className="text-slate-300 font-mono text-[11px] truncate">{rule.action_target || '*'}</dd>
                </div>

                <div className="flex items-center gap-2">
                  <dt className="text-slate-500 shrink-0 w-16">Last run:</dt>
                  <dd className="text-slate-400 flex items-center gap-1">
                    <Clock size={11} className="text-slate-500" aria-hidden />
                    {relativeTime(rule.last_run)}
                  </dd>
                </div>

                <div className="flex items-center gap-2">
                  <dt className="text-slate-500 shrink-0 w-16">Runs:</dt>
                  <dd className="text-slate-400 tabular-nums">{rule.run_count}</dd>
                </div>
              </dl>

              {/* Actions row */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-white/[0.03]">
                <button type="button" onClick={() => openHistory(rule)} aria-label={`History of ${rule.name}`} className={`${BTN_CARD} ${TONE_QUIET} sm:mr-auto`}>
                  <History size={12} />
                  History
                </button>
                {isAdmin && (
                  <>
                    <Hint label="Run the action now">
                      <button type="button" onClick={() => handleRun(rule)} disabled={runningId === rule.id} aria-label={`Run ${rule.name} now`} className={`${BTN_CARD} ${TONE_QUIET}`}>
                        {runningId === rule.id ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                        Run now
                      </button>
                    </Hint>
                    <button type="button" onClick={() => openEditModal(rule)} aria-label={`Edit ${rule.name}`} className={`${BTN_CARD} ${TONE_QUIET}`}>
                      <Pencil size={12} />
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(rule)} disabled={deletingId === rule.id} aria-label={`Delete ${rule.name}`} className={`${BTN_CARD} ${TONE_DANGER}`}>
                      {deletingId === rule.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Run history                                                          */}
      {/* ------------------------------------------------------------------- */}
      {historyRuleId && createPortal(
        <ModalOverlay onClose={closeHistory} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-full max-w-lg glass border border-white/10 rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <History size={16} className="text-slate-400 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-200">Run history</h2>
                  <p className="text-[11px] text-slate-500 truncate">{historyRuleName}</p>
                </div>
              </div>
              <button type="button" aria-label="Close" onClick={closeHistory} className={`${BTN_ICON_SM} ${TONE_GHOST}`}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {historyLoading && (
                <div className="space-y-2" role="status" aria-label="Reading the history">
                  {[0, 1, 2].map((i) => <div key={i} className="skeleton h-9 rounded-lg" aria-hidden />)}
                </div>
              )}

              {!historyLoading && historyEntries.length === 0 && (
                <EmptyState
                  compact
                  icon={<History size={28} />}
                  title="No run history yet"
                  hint="Entries appear here once this automation rule has been triggered."
                />
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
                      <div key={entry.timestamp} className="rounded-lg border border-white/[0.03] overflow-hidden">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedHistoryIdx(isExpanded ? null : idx)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40"
                        >
                          {entry.success ? (
                            <CheckCircle size={13} className="text-emerald-400 shrink-0" aria-hidden />
                          ) : (
                            <XCircle size={13} className="text-rose-400 shrink-0" aria-hidden />
                          )}

                          <span className="text-xs text-slate-400 font-mono tabular-nums flex-1">
                            {timeStr}
                          </span>

                          <Badge component="span" color={entry.success ? 'emerald' : 'rose'}>{entry.success ? 'Success' : 'Failed'}</Badge>

                          {isExpanded ? (
                            <ChevronUp size={12} className="text-slate-500 shrink-0" aria-hidden />
                          ) : (
                            <ChevronDown size={12} className="text-slate-500 shrink-0" aria-hidden />
                          )}
                        </button>

                        {/* Expanded output log */}
                        {isExpanded && entry.message && (
                          <div className="px-3 pb-3 pt-0">
                            <pre className="text-[11px] text-slate-400 font-mono bg-slate-950/60 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap border border-white/[0.03] max-h-48 overflow-y-auto scrollbar-thin">
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
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/5 shrink-0">
              <span className="text-[11px] text-slate-500 tabular-nums">
                {historyEntries.length} run{historyEntries.length !== 1 ? 's' : ''}
              </span>
              <button type="button" onClick={closeHistory} className={BTN_SHEET_QUIET + ' px-6'}>
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>,
        document.body,
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Create or edit a rule                                                */}
      {/* ------------------------------------------------------------------- */}
      {showCreateModal && createPortal(
        <ModalOverlay onClose={() => setShowCreateModal(false)} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); handleCreate() }}
            className="w-full max-w-lg glass border border-white/10 rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-slate-400" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-200">{editingId ? 'Edit automation' : 'New automation'}</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setShowCreateModal(false)} className={`${BTN_ICON_SM} ${TONE_GHOST}`}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Name */}
              <div>
                <label htmlFor={`${uid}-name`} className={LABEL}>Rule name</label>
                <input
                  id={`${uid}-name`}
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Nightly backup"
                  autoComplete="off"
                  className={FIELD}
                  autoFocus
                />
              </div>

              {/* Trigger type */}
              <div>
                <span className={LABEL}>Trigger type</span>
                <SegmentedControl
                  fullWidth
                  aria-label="Trigger type"
                  value={formTriggerType}
                  onChange={(v) => setFormTriggerType(v as 'schedule' | 'condition')}
                  data={[
                    { value: 'schedule', label: <span className="flex items-center justify-center gap-1.5 py-0.5"><CalendarClock size={13} aria-hidden />Schedule</span> },
                    { value: 'condition', label: <span className="flex items-center justify-center gap-1.5 py-0.5"><AlertTriangle size={13} aria-hidden />Condition</span> },
                  ]}
                />
              </div>

              {/* Schedule: cron input + presets */}
              {formTriggerType === 'schedule' && (
                <div>
                  <label htmlFor={`${uid}-cron`} className={LABEL}>Cron expression</label>
                  <input
                    id={`${uid}-cron`}
                    type="text"
                    value={formCron}
                    onChange={(e) => setFormCron(e.target.value)}
                    placeholder="* * * * *"
                    autoComplete="off"
                    spellCheck={false}
                    className={`${FIELD} font-mono mb-2`}
                  />
                  <span className={LABEL}>Quick presets</span>
                  <div className="flex flex-wrap gap-1.5">
                    {CRON_PRESETS.map((p) => (
                      <button
                        key={p.cron}
                        type="button"
                        aria-pressed={formCron === p.cron}
                        onClick={() => setFormCron(p.cron)}
                        className={`h-8 sm:h-7 px-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
                          formCron === p.cron
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-white/[0.03] text-slate-400 border-white/5 hover:bg-white/5 hover:text-slate-300'
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
                  <label htmlFor={`${uid}-condition`} className={LABEL}>Condition</label>
                  <select
                    id={`${uid}-condition`}
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    className={`${FIELD} cursor-pointer`}
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
                <label htmlFor={`${uid}-action`} className={LABEL}>Action type</label>
                <select
                  id={`${uid}-action`}
                  value={formActionType}
                  onChange={(e) => setFormActionType(e.target.value)}
                  className={`${FIELD} cursor-pointer`}
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
                <label htmlFor={`${uid}-target`} className={LABEL}>Action target</label>
                <input
                  id={`${uid}-target`}
                  type="text"
                  value={formActionTarget}
                  onChange={(e) => setFormActionTarget(e.target.value)}
                  placeholder='Stack name, container name, or "*" for all'
                  autoComplete="off"
                  className={FIELD}
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Leave empty or use "*" to target all stacks/containers.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-white/5 shrink-0">
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                Press <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.03] text-[9px] font-mono text-slate-400">Esc</kbd> to close
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button type="button" onClick={() => setShowCreateModal(false)} className={`${BTN_SHEET_QUIET} flex-1 sm:flex-none sm:px-6`}>
                  Cancel
                </button>
                <button type="submit" disabled={creating || !formName.trim()} className={`${BTN_SHEET_PRIMARY} flex-1 sm:flex-none`}>
                  {creating ? <Loader2 size={14} className="animate-spin" /> : (editingId ? <Pencil size={14} /> : <Plus size={14} />)}
                  {editingId ? 'Save changes' : 'Create'}
                </button>
              </div>
            </div>
          </form>
        </ModalOverlay>,
        document.body,
      )}
    </div>
  )
}
