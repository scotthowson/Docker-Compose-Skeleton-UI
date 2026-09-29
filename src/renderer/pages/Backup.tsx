// =============================================================================
// Backup — Backup and restore management page with status, trigger, and archive
// On a hub: Everywhere lists every server's archives, a stack is backed up where
// it lives (the hub or its VM), a restore acts on the server that keeps the file.
// =============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { useConfirm } from '../components/common/ConfirmDialog'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { fetchStacks } from '../api/endpoints'
import {
  fetchBackupsScoped,
  fetchBackupStatusScoped,
  fetchBackupConfigScoped,
  triggerBackupScoped,
  restoreBackupScoped,
  cancelBackupScoped,
  fleetTargets,
  fanOut,
  summarizeOutcomes,
} from '../api/fleetScopedOps'
import { useFleetScope } from '../hooks/useFleetScope'
import FleetScopeChips from '../components/fleet/FleetScopeChips'
import VmCapsule from '../components/fleet/VmCapsule'
import {
  Archive,
  Play,
  RotateCcw,
  Clock,
  HardDrive,
  Shield,
  AlertTriangle,
  Loader2,
  CheckCircle,
  X,
  Download,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Layers,
  XCircle,
  Boxes,
  Info,
} from 'lucide-react'
import type {
  BackupStatusResponse,
  BackupConfigResponse,
  BackupTriggerResponse,
} from '../../shared/types'
import type { FleetBackupEntry, FleetBackupListResponse, BackupStackChoice, MemberOutcome } from '../../shared/fleetScopedOps'
import { LoadingState } from '../components/common/PageState'
import RecoveryBundleCard from '../components/backup/RecoveryBundleCard'
import ModalOverlay from '../components/common/ModalOverlay'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateString(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** a row key: the archive on its DCS (the hub's rows have no member) */
const backupKey = (b: { member?: string | null; filename: string }) => `${b.member ?? ''}|${b.filename}`

/** the drop-down value of a stack: where it lives, then its name */
const stackKey = (member: string | null, name: string) => `${member ?? ''}|${name}`
const parseStackKey = (key: string): { member: string | null; name: string } => {
  const i = key.indexOf('|')
  return { member: i > 0 ? key.slice(0, i) : null, name: key.slice(i + 1) }
}

const vmLabel = (name: string, vmid: number | null | undefined) => `VM${vmid ? ` #${vmid}` : ''} · ${name}`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BACKUP_GUIDE_SECTIONS = [
  {
    title: 'What Gets Backed Up',
    icon: Archive,
    content: `Full backups capture your entire DCS directory:

• docker-compose.yml    All stack compose files
• .env files            Stack and root environment configs
• .config/              DCS framework configuration
• .api-auth/            User accounts and settings
• .templates/           Custom service templates
• .plugins/             Installed plugins

Backups do NOT include Docker volumes or
container data — only configuration files.
Use Docker volume snapshots for data backup.`,
  },
  {
    title: 'Configuration',
    icon: Shield,
    content: `Configure backup in your server's .env file:

BACKUP_DEST_DIR="/path/to/backup/storage"
BACKUP_SOURCE_DIR=""     # defaults to DCS root
BACKUP_RETENTION_COUNT=5 # keep last 5 backups

The destination must be a writable directory.
Common choices:
  /srv/backups        Local backup storage
  /mnt/nas/backups    Network-attached storage
  /mnt/usb/backups    External USB drive`,
  },
  {
    title: 'Targeted Stack Backups',
    icon: Layers,
    content: `Targeted backups capture a single stack:

1. Select the stack from the dropdown
2. Click "Backup Stack"

This creates a smaller archive containing only
that stack's compose file, .env, and related
configuration. Useful for quick saves before
making changes to a specific stack.`,
  },
  {
    title: 'Backups in a Proxmox fleet',
    icon: Boxes,
    content: `On a hub every VM runs its own DCS, and a
backup runs where the stack lives:

• The stack drop-down lists the hub's stacks
  first, then each VM's ("VM #103 · media")
• "Backup Stack" for a VM stack runs on that
  VM and the status card follows it
• Everywhere lists every server's archives;
  Hub or a VM chip shows one server's
• "Back up everything" starts a full backup
  on the hub and on every VM at once
• A restore always acts on the server that
  keeps the archive
• Each VM has its own BACKUP_DEST_DIR and
  retention: pick the VM chip to see them

The hub cannot carry an archive to your
browser: a VM's file stays on that VM's disk
(copy it over ssh from its BACKUP_DEST_DIR).`,
  },
  {
    title: 'Restoring from Backup',
    icon: RotateCcw,
    content: `To restore from a backup archive:

1. Find the backup in the archives table
2. Click "Restore" on the desired backup
3. Type RESTORE to confirm
4. Wait for the restore to complete

IMPORTANT: Restoring overwrites current
configuration files. It does NOT automatically
restart stacks — do this manually after restore.

Tip: Create a fresh backup before restoring
an older one, so you can roll back if needed.`,
  },
]

export default function Backup() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()
  const confirm = useConfirm()
  const { scope, setScope, member: scopeMember, memberName, members: scopeMembers, hasFleet } = useFleetScope()

  // ---- State ----
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [selectedStack, setSelectedStack] = useState<string>('')
  const [stackChoices, setStackChoices] = useState<BackupStackChoice[]>([])
  const [restoreTarget, setRestoreTarget] = useState<FleetBackupEntry | null>(null)
  const [restoreConfirmText, setRestoreConfirmText] = useState('')
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null)
  // Everywhere: the server whose progress the status card follows (the last one a backup was started on)
  const [watchMember, setWatchMember] = useState<string | null>(null)
  // the last "back up everything": what every server answered
  const [fleetRun, setFleetRun] = useState<MemberOutcome<BackupTriggerResponse>[] | null>(null)

  // Close topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (restoreTarget && !restoreLoading) {
        setRestoreTarget(null)
        setRestoreConfirmText('')
        return
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [restoreTarget, restoreLoading])

  // ---- Which server the status and the config cards talk about ----
  const watchStillThere = watchMember === null || scopeMembers.some((m) => m.id === watchMember)
  const statusMember: string | null = scope === 'all' ? (watchStillThere ? watchMember : null) : scopeMember
  const statusName = statusMember ? (scopeMembers.find((m) => m.id === statusMember)?.name ?? statusMember) : ''
  const statusVmid = statusMember ? (scopeMembers.find((m) => m.id === statusMember)?.vmid ?? null) : null
  // the config panel shows one server's settings: on Everywhere the hub's, with a note
  const configMember: string | null = scope === 'all' ? null : scopeMember

  // ---- Polling ----
  const fetchScopedStatus = useCallback(() => fetchBackupStatusScoped(statusMember), [statusMember])
  const {
    data: statusData,
    loading: statusLoading,
    refresh: refreshStatus,
  } = usePolling<BackupStatusResponse>(fetchScopedStatus, 5000, {
    enabled: isConnected,
  })
  const statusRef = useRef(statusMember)
  useEffect(() => { if (statusRef.current !== statusMember) { statusRef.current = statusMember; refreshStatus() } }, [statusMember, refreshStatus])

  const fetchScopedBackups = useCallback(() => fetchBackupsScoped(scope), [scope])
  const {
    data: backupsData,
    loading: backupsLoading,
    refresh: refreshBackups,
  } = usePolling<FleetBackupListResponse>(fetchScopedBackups, 15000, {
    enabled: isConnected,
  })
  const scopeRef = useRef(scope)
  useEffect(() => { if (scopeRef.current !== scope) { scopeRef.current = scope; refreshBackups(); setSelectedStack('') } }, [scope, refreshBackups])

  const fetchScopedConfig = useCallback(() => fetchBackupConfigScoped(configMember), [configMember])
  const {
    data: configData,
    refresh: refreshConfig,
  } = usePolling<BackupConfigResponse>(fetchScopedConfig, 30000, {
    enabled: isConnected,
  })
  const configRef = useRef(configMember)
  useEffect(() => { if (configRef.current !== configMember) { configRef.current = configMember; refreshConfig() } }, [configMember, refreshConfig])

  // ---- The stacks the drop-down offers: the hub's first, then each VM's (a hub's /stacks lists them all) ----
  useEffect(() => {
    if (!isConnected) return
    fetchStacks()
      .then((res) => {
        const hub: BackupStackChoice[] = []
        const vm: BackupStackChoice[] = []
        for (const s of res.stacks) {
          if (s.placement === 'vm' && s.member) {
            vm.push({ name: s.name, member: s.member, member_name: s.member_name ?? s.member, vmid: s.vmid ?? null, reachable: s.reachable !== false })
          } else {
            hub.push({ name: s.name, member: null, member_name: 'Hub', vmid: null, reachable: true })
          }
        }
        vm.sort((a, b) => (a.vmid ?? 0) - (b.vmid ?? 0) || a.member_name.localeCompare(b.member_name) || a.name.localeCompare(b.name))
        setStackChoices([...hub, ...vm])
      })
      .catch(() => {})
  }, [isConnected, scope])

  // what the current view can back up: everything, the hub's stacks, or one VM's
  const visibleStacks = useMemo(
    () => stackChoices.filter((s) => (scope === 'all' ? true : scope === 'hub' ? s.member === null : s.member === scopeMember)),
    [stackChoices, scope, scopeMember],
  )
  const stackGroups = useMemo(() => {
    const groups: { key: string; label: string; stacks: BackupStackChoice[] }[] = []
    for (const s of visibleStacks) {
      const key = s.member ?? ''
      let g = groups.find((x) => x.key === key)
      if (!g) { g = { key, label: s.member ? vmLabel(s.member_name, s.vmid) : 'Hub', stacks: [] }; groups.push(g) }
      g.stacks.push(s)
    }
    return groups
  }, [visibleStacks])

  // ---- Handlers ----
  const handleTriggerBackup = useCallback(
    async (member: string | null, stack?: string) => {
      setTriggerLoading(true)
      const where = member ? ` on ${scopeMembers.find((m) => m.id === member)?.name ?? member}` : hasFleet ? ' on the hub' : ''
      addToast({
        type: 'info',
        message: stack ? `Starting backup for "${stack}"${where}...` : `Starting full backup${where}...`,
        duration: 2500,
      })
      try {
        const result = await triggerBackupScoped(member, stack || undefined)
        if (result.success) {
          addToast({
            type: 'success',
            message: result.message || `Backup "${result.filename}" started${where}`,
          })
          // the status card follows the server the backup runs on
          if (scope === 'all') setWatchMember(member)
          refreshBackups()
          refreshStatus()
        } else {
          addToast({
            type: 'error',
            message: result.message || 'Failed to start backup',
            duration: 6000,
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        addToast({ type: 'error', message: `Backup failed: ${message}`, duration: 6000 })
      } finally {
        setTriggerLoading(false)
      }
    },
    [addToast, refreshBackups, refreshStatus, scope, scopeMembers, hasFleet],
  )

  /** Everywhere: a full backup on the hub and on every VM that answers, at the same time */
  const handleBackupEverything = useCallback(async () => {
    const targets = fleetTargets(scopeMembers)
    const vms = targets.length - 1
    const ok = await confirm({
      title: 'Back up everything',
      message: `Start a full backup on the hub and on ${vms} VM${vms === 1 ? '' : 's'}? Each server writes its own archive to its own BACKUP_DEST_DIR; a VM that is not configured for backups reports that and the others carry on.`,
      confirmLabel: 'Start everywhere',
    })
    if (!ok) return
    setTriggerLoading(true)
    setFleetRun(null)
    try {
      const outcomes = await fanOut(targets, (m) => triggerBackupScoped(m))
      // a server that answered but refused (not configured) counts as a failure too
      const graded = outcomes.map((o) => (o.ok && o.value && o.value.success === false ? { ...o, ok: false, error: o.value.message || 'refused' } : o))
      setFleetRun(graded)
      const summary = summarizeOutcomes(graded, 'Backup started')
      addToast({ type: summary.ok ? 'success' : 'error', message: summary.message, duration: summary.ok ? 5000 : 9000 })
      setWatchMember(null)
      refreshBackups()
      refreshStatus()
    } finally {
      setTriggerLoading(false)
    }
  }, [scopeMembers, confirm, addToast, refreshBackups, refreshStatus])

  const handleCancelBackup = useCallback(async () => {
    setCancelling(true)
    try {
      const result = await cancelBackupScoped(statusMember)
      addToast({ type: result.success ? 'info' : 'error', message: result.message })
      refreshStatus()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to cancel' })
    } finally {
      setCancelling(false)
    }
  }, [addToast, refreshStatus, statusMember])

  const handleRestore = useCallback(async () => {
    if (!restoreTarget) return
    // the archive's own server: a fleet row says so, a single server's list is the scope's
    const member = restoreTarget.member !== undefined ? restoreTarget.member : scopeMember
    setRestoreLoading(true)
    addToast({
      type: 'info',
      message: `Restoring from "${restoreTarget.filename}"...`,
      duration: 3000,
    })
    try {
      const result = await restoreBackupScoped(member, restoreTarget.filename)
      if (result.success) {
        addToast({
          type: 'success',
          message: result.message || `Restore from "${restoreTarget.filename}" completed`,
        })
      } else {
        addToast({
          type: 'error',
          message: result.message || 'Restore failed',
          duration: 6000,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addToast({ type: 'error', message: `Restore failed: ${message}`, duration: 6000 })
    } finally {
      setRestoreLoading(false)
      setRestoreTarget(null)
      setRestoreConfirmText('')
      refreshBackups()
    }
  }, [restoreTarget, addToast, refreshBackups, scopeMember])

  const backups: FleetBackupEntry[] = backupsData?.backups ?? []
  const fleetMembers = backupsData?.members ?? []
  const silentMembers = fleetMembers.filter((m) => m.id !== null && !m.reachable)
  const status = statusData?.status ?? 'idle'
  const isConfigured = configData?.configured ?? true
  const busy = status === 'running' || status === 'restoring'
  const selected = selectedStack ? parseStackKey(selectedStack) : null
  const selectedChoice = selected ? visibleStacks.find((s) => s.name === selected.name && s.member === selected.member) ?? null : null
  const configName = configMember ? (scopeMembers.find((m) => m.id === configMember)?.name ?? configMember) : ''
  const configVmid = configMember ? (scopeMembers.find((m) => m.id === configMember)?.vmid ?? null) : null

  // ---- Not connected ----
  if (!isConnected) {
    return (
      <LoadingState label="Waiting for the server connection…" hint="Make sure the DCS Orchestrator API is running" />
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-4 md:p-6 animate-fade-in">
      <DisconnectedBanner />
      <div className="flex flex-col gap-5 animate-fade-in">
        {/* ---- Header ---- */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold tracking-tight"><span className="text-gradient">Backup & Restore</span>{scopeMember && <span className="ml-2 text-sm font-medium text-amber-200/90">· VM {memberName}</span>}</h1>
            {hasFleet && <div className="mt-2"><FleetScopeChips scope={scope} members={scopeMembers} onChange={setScope} label="Show" busy={backupsLoading && !!backupsData} /></div>}
            <p className="text-sm text-slate-400 mt-1">
              {hasFleet
                ? scope === 'all' ? 'Every server\'s archives; a backup runs where the stack lives' : scopeMember ? `Archives, backups and restores on the VM ${memberName}` : 'The hub\'s own archives, backups and restores'
                : 'Create, manage, and restore server backups'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/15 transition-all duration-200"
            >
              <BookOpen size={14} />
              <span className="hidden sm:inline">Guide</span>
            </button>
            <button
              onClick={() => { refreshBackups(); refreshStatus(); refreshConfig() }}
              disabled={backupsLoading}
              className="
                flex items-center gap-2 rounded-lg px-3 py-2
                text-xs font-medium text-slate-300
                bg-white/5 border border-white/10
                hover:bg-white/10 hover:border-white/15
                disabled:opacity-50 transition-all duration-200
              "
            >
              <RotateCcw size={14} className={backupsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Backup Guide */}
        {showGuide && (
          <div className="glass rounded-xl overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">Backup & Restore Guide</h2>
              </div>
              <button aria-label="Close" onClick={() => setShowGuide(false)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-400 mb-4">
                Backups create compressed archives of your DCS configuration. Use them to protect against accidental changes or migrate to a new server.
              </p>
              {BACKUP_GUIDE_SECTIONS.map((section, i) => {
                const isExpanded = expandedGuide === i
                const Icon = section.icon
                return (
                  <div key={section.title} className="border border-white/[0.03] rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedGuide(isExpanded ? null : i)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                    >
                      <Icon size={14} className="text-emerald-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-200 flex-1">{section.title}</span>
                      {isExpanded
                        ? <ChevronDown size={14} className="text-slate-500" />
                        : <ChevronRight size={14} className="text-slate-500" />
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
          </div>
        )}

        {/* ================================================================= */}
        {/* Backup Status                                                     */}
        {/* ================================================================= */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex flex-wrap items-center gap-2">
            <Shield size={16} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200">Backup Status</h3>
            {hasFleet && <VmCapsule member={statusMember} name={statusName} vmid={statusVmid} size="xs" />}
            {hasFleet && scope === 'all' && (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 hidden sm:inline">Follow</span>
                <select
                  value={statusMember ?? ''}
                  onChange={(e) => setWatchMember(e.target.value || null)}
                  className="rounded-lg px-2 py-1 text-[11px] bg-white/5 border border-white/10 text-slate-300 focus:outline-none focus:border-cyan-500/30 appearance-none cursor-pointer"
                  title="Whose progress the status card shows"
                >
                  <option value="" className="bg-slate-900">Hub</option>
                  {scopeMembers.map((m) => (
                    <option key={m.id} value={m.id} disabled={!m.reachable} className="bg-slate-900">{vmLabel(m.name, m.vmid)}{m.reachable ? '' : ' (not answering)'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="p-5">
            {/* Idle */}
            {status === 'idle' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10">
                  <CheckCircle size={24} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Idle
                    </span>
                  </div>
                  {statusData?.last_backup ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-slate-300">
                        Last backup:{' '}
                        <span className="font-mono text-xs text-slate-400 break-all">
                          {statusData.last_backup.filename}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {statusData.last_backup.size} &middot;{' '}
                        {formatDateString(statusData.last_backup.timestamp)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No backups recorded yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Running */}
            {status === 'running' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10">
                    <Loader2 size={24} className="text-cyan-400 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        Running
                      </span>
                    </div>
                    {statusData?.filename && (
                      <p className="mt-1.5 text-sm text-slate-300 font-mono text-xs break-all">
                        {statusData.filename}
                      </p>
                    )}
                    {statusData?.progress && (
                      <p className="text-xs text-slate-500 mt-0.5">{statusData.progress}</p>
                    )}
                  </div>
                </div>
                {/* Progress bar — real percentage when available, animated fallback */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{statusData?.stage === 'copy' ? 'Copying files' : statusData?.stage === 'archive' ? 'Creating archive' : statusData?.stage === 'cleanup' ? 'Cleaning up' : statusData?.stage === 'retention' ? 'Enforcing retention' : 'Processing'}</span>
                    <span className="text-[10px] font-mono text-cyan-400">{statusData?.percent != null ? `${statusData.percent}%` : ''}</span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    {statusData?.percent != null ? (
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 shadow-lg shadow-cyan-500/20 transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(statusData.percent, 2)}%` }}
                      />
                    ) : (
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 animate-pulse" style={{ width: '45%' }} />
                    )}
                  </div>
                  <button
                    onClick={handleCancelBackup}
                    disabled={cancelling}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/15 hover:bg-rose-500/20 disabled:opacity-50 transition-all press mt-1"
                  >
                    {cancelling ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                    Cancel Backup
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {status === 'error' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-rose-500/10">
                  <AlertTriangle size={24} className="text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      Error
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-rose-300">
                    {statusData?.error || 'An error occurred during the last backup'}
                  </p>
                </div>
              </div>
            )}

            {/* Restoring */}
            {status === 'restoring' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10">
                    <RotateCcw size={24} className="text-amber-400 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Restoring
                      </span>
                    </div>
                    {statusData?.filename && (
                      <p className="mt-1.5 text-sm text-slate-300 font-mono text-xs break-all">
                        {statusData.filename}
                      </p>
                    )}
                    {statusData?.progress && (
                      <p className="text-xs text-slate-500 mt-0.5">{statusData.progress}</p>
                    )}
                  </div>
                </div>
                <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                    style={{
                      animation: 'backupProgressPulse 2s ease-in-out infinite',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Loading placeholder */}
            {statusLoading && !statusData && (
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading backup status...</span>
              </div>
            )}

            {/* the last "back up everything": one line per server */}
            {fleetRun && scope === 'all' && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Back up everything · {fleetRun.filter((o) => o.ok).length} of {fleetRun.length} started</p>
                  <button onClick={() => setFleetRun(null)} className="text-[10px] text-slate-500 hover:text-slate-300">Dismiss</button>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {fleetRun.map((o) => (
                    <li key={o.id ?? 'hub'} className="flex items-center gap-1.5 text-[11px]" title={o.ok ? o.value?.filename ?? 'started' : o.error ?? 'failed'}>
                      <VmCapsule member={o.id} name={o.name} vmid={o.vmid} size="xs" onClick={() => setWatchMember(o.id)} />
                      {o.ok ? <CheckCircle size={11} className="text-emerald-400" /> : <XCircle size={11} className="text-rose-400" />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* Recovery bundle: the hub's own (a VM's is on its own dashboard)    */}
        {/* ================================================================= */}
        {!scopeMember && <RecoveryBundleCard />}

        {/* ================================================================= */}
        {/* Trigger Backup                                                    */}
        {/* ================================================================= */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex flex-wrap items-center gap-2">
            <Play size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">Trigger Backup</h3>
            {hasFleet && <VmCapsule member={configMember} name={configName} vmid={configVmid} size="xs" />}
          </div>

          <div className="p-5">
            {!isConfigured && (
              <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 mb-5">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Backup not configured{hasFleet ? (configMember ? ` on the VM ${configName}` : ' on the hub') : ''}</p>
                  <p className="text-xs text-amber-400/70 mt-1">
                    Set <code className="font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">BACKUP_DEST_DIR</code> in {configMember ? 'that VM\'s' : 'the server\'s'} <code className="font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">.env</code> file (the Environment page) to enable backups there.
                  </p>
                </div>
              </div>
            )}

            {/* Config summary */}
            {configData && isConfigured && (
              <div className="mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="glass border border-white/5 rounded-lg p-3">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Destination</p>
                    <p className="mt-1 text-xs font-mono text-slate-300 truncate" title={configData.destination}>
                      {configData.destination || 'N/A'}
                    </p>
                  </div>
                  <div className="glass border border-white/5 rounded-lg p-3">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Source</p>
                    <p className="mt-1 text-xs font-mono text-slate-300 truncate" title={configData.source}>
                      {configData.source || 'N/A'}
                    </p>
                  </div>
                  <div className="glass border border-white/5 rounded-lg p-3">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Retention</p>
                    <p className="mt-1 text-xs font-mono text-slate-300">
                      {configData.retention_count} backup{configData.retention_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {hasFleet && scope === 'all' && (
                  <p className="mt-2 text-[11px] text-slate-500 flex items-start gap-1.5">
                    <Info size={12} className="mt-0.5 shrink-0 text-slate-500" />
                    <span>These are the hub&apos;s settings. Every VM keeps its own destination and retention: pick a VM chip above to see and use them.</span>
                  </p>
                )}
              </div>
            )}

            {/* Action row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Full backup: this server, or on Everywhere the hub and every VM */}
              {scope === 'all' ? (
                <button
                  onClick={handleBackupEverything}
                  disabled={triggerLoading || busy}
                  title="A full backup on the hub and on every VM that answers, started at the same time"
                  className="
                    flex items-center justify-center gap-2.5 rounded-lg px-5 py-2.5
                    text-sm font-semibold text-white
                    bg-emerald-600 hover:bg-emerald-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200
                    shadow-lg shadow-emerald-500/20 press
                  "
                >
                  {triggerLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Boxes size={16} />
                  )}
                  Back up everything
                </button>
              ) : (
                <button
                  onClick={() => handleTriggerBackup(scopeMember)}
                  disabled={triggerLoading || busy || !isConfigured}
                  className="
                    flex items-center justify-center gap-2.5 rounded-lg px-5 py-2.5
                    text-sm font-semibold text-white
                    bg-emerald-600 hover:bg-emerald-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200
                    shadow-lg shadow-emerald-500/20 press
                  "
                >
                  {triggerLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Archive size={16} />
                  )}
                  Full Backup{scopeMember ? ` of ${memberName}` : ''}
                </button>
              )}

              {/* Stack selector: where each stack lives is part of the choice */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
                <select aria-label="Stack"
                  value={selectedStack}
                  onChange={(e) => setSelectedStack(e.target.value)}
                  disabled={!isConfigured && scope !== 'all'}
                  className="
                    flex-1 min-w-0 rounded-lg px-3 py-2.5 text-sm
                    bg-white/5 border border-white/10
                    text-slate-200
                    focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200
                    appearance-none
                  "
                >
                  <option value="" className="bg-slate-900 text-slate-400">
                    {visibleStacks.length === 0 ? 'No stacks here' : 'Select stack for targeted backup...'}
                  </option>
                  {hasFleet ? stackGroups.map((g) => (
                    <optgroup key={g.key || 'hub'} label={g.label} className="bg-slate-900 text-slate-400">
                      {g.stacks.map((s) => (
                        <option key={stackKey(s.member, s.name)} value={stackKey(s.member, s.name)} disabled={!s.reachable} className="bg-slate-900 text-slate-200">
                          {s.name}{s.member ? ` — ${vmLabel(s.member_name, s.vmid)}` : scope === 'all' ? ' — Hub' : ''}{s.reachable ? '' : ' (not answering)'}
                        </option>
                      ))}
                    </optgroup>
                  )) : visibleStacks.map((s) => (
                    <option key={s.name} value={stackKey(null, s.name)} className="bg-slate-900 text-slate-200">
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedChoice) handleTriggerBackup(selectedChoice.member, selectedChoice.name)
                  }}
                  disabled={!selectedChoice || !selectedChoice.reachable || triggerLoading || busy}
                  title={selectedChoice?.member ? `Runs on ${vmLabel(selectedChoice.member_name, selectedChoice.vmid)}` : selectedChoice && hasFleet ? 'Runs on the hub' : undefined}
                  className="
                    flex items-center justify-center gap-2 rounded-lg px-4 py-2.5
                    text-sm font-medium text-slate-300
                    bg-white/5 border border-white/10
                    hover:bg-white/10 hover:border-white/10
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200 shrink-0
                  "
                >
                  <Download size={15} />
                  Backup Stack
                </button>
              </div>
            </div>
            {selectedChoice && hasFleet && (
              <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                <span>Runs where the stack lives:</span>
                <VmCapsule member={selectedChoice.member} name={selectedChoice.member_name} vmid={selectedChoice.vmid} size="xs" />
              </p>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* Backup Archives                                                   */}
        {/* ================================================================= */}
        <div className="glass border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <HardDrive size={16} className="text-cyan-400" />
              Backup Archives
              <span className="text-xs font-normal text-slate-500">
                ({backups.length})
              </span>
            </h3>
            {backupsData?.fleet && (
              <p className="text-[11px] text-slate-500">
                the hub and {Math.max(fleetMembers.length - 1, 0)} VM{fleetMembers.length - 1 === 1 ? '' : 's'}
                {silentMembers.length > 0 && <span className="text-amber-300/80"> · {silentMembers.length} not answering ({silentMembers.map((m) => m.name).join(', ')})</span>}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Filename
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] stagger-children">
                {backups.length === 0 && !backupsLoading && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Archive size={32} className="text-slate-500" />
                        <p className="text-sm text-slate-500">No backup archives found{scopeMember ? ` on the VM ${memberName}` : ''}</p>
                        <p className="text-xs text-slate-500">
                          Trigger a backup above to create your first archive
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {backupsLoading && backups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                      <Loader2 size={16} className="inline animate-spin mr-2" />
                      Loading backup archives...
                    </td>
                  </tr>
                )}
                {backups.map((backup) => {
                  const onVm = !!(backup.member ?? scopeMember)
                  return (
                    <tr
                      key={backupKey(backup)}
                      className="hover:bg-white/[0.03] transition-colors duration-150"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Archive
                            size={14}
                            className="text-slate-500 shrink-0"
                          />
                          <span className="font-mono text-xs text-slate-200 truncate max-w-[200px] md:max-w-[320px]" title={backup.filename}>
                            {backup.filename}
                          </span>
                          {backup.member !== undefined && <VmCapsule member={backup.member} name={backup.member_name} vmid={backup.vmid} size="xs" onClick={() => setScope(backup.member ?? 'hub')} />}
                        </div>
                        {onVm && (
                          <p className="mt-1 text-[10px] text-slate-500 flex items-center gap-1" title="The hub's proxy carries JSON, not files: copy the archive over ssh from that VM's BACKUP_DEST_DIR">
                            <Info size={10} /> stays on the VM&apos;s disk
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-400">{backup.size}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
                          <Clock size={12} className="text-slate-500" />
                          {formatTimestamp(backup.timestamp)}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            setRestoreTarget(backup)
                            setRestoreConfirmText('')
                          }}
                          disabled={busy && (backup.member ?? null) === statusMember}
                          title={onVm ? `Restores on ${backup.member_name ?? memberName}` : hasFleet ? 'Restores on the hub' : 'Restore'}
                          className="
                            inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5
                            text-xs font-medium
                            text-rose-400 bg-rose-500/10 border border-rose-500/20
                            hover:bg-rose-500/20 hover:border-rose-500/30
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all duration-200
                          "
                        >
                          <RotateCcw size={12} />
                          Restore
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Restore Confirmation Modal                                        */}
      {/* ================================================================= */}
      {restoreTarget && createPortal(
        <ModalOverlay onClose={() => { if (!restoreLoading) { setRestoreTarget(null); setRestoreConfirmText('') } }} className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (!restoreLoading) {
                setRestoreTarget(null)
                setRestoreConfirmText('')
              }
            }}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md mx-4 glass rounded-2xl border border-white/10 shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-rose-500/15">
                  <AlertTriangle size={18} className="text-rose-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">Confirm Restore</h3>
              </div>
              <button aria-label="Close"
                onClick={() => {
                  if (!restoreLoading) {
                    setRestoreTarget(null)
                    setRestoreConfirmText('')
                  }
                }}
                disabled={restoreLoading}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all duration-150 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Warning */}
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-4">
                <p className="text-sm text-rose-300 font-medium">
                  This will overwrite the configuration and data files{hasFleet ? (restoreTarget.member ?? scopeMember) ? ` on the VM ${restoreTarget.member_name ?? memberName}` : ' on the hub' : ''}.
                </p>
                <p className="text-xs text-rose-400/70 mt-1.5">
                  This action cannot be undone. Make sure you have a current backup before proceeding.
                </p>
              </div>

              {/* Archive info */}
              <div className="glass border border-white/5 rounded-lg p-3.5">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Restoring from
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Archive size={14} className="text-slate-400 shrink-0" />
                  <span className="font-mono text-xs text-slate-200 break-all">
                    {restoreTarget.filename}
                  </span>
                  {hasFleet && <VmCapsule member={restoreTarget.member ?? scopeMember} name={restoreTarget.member_name ?? (scopeMember ? memberName : undefined)} vmid={restoreTarget.vmid ?? (scopeMember ? scopeMembers.find((m) => m.id === scopeMember)?.vmid : null)} size="xs" />}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {restoreTarget.size} &middot; {formatTimestamp(restoreTarget.timestamp)}
                </p>
              </div>

              {/* Confirmation input */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Type <code className="font-mono bg-white/[0.06] px-1.5 py-0.5 rounded text-rose-400">RESTORE</code> to confirm
                </label>
                <input
                  type="text"
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  placeholder="RESTORE"
                  disabled={restoreLoading}
                  className="
                    w-full px-3 py-2.5 rounded-lg text-sm font-mono
                    bg-white/5 border border-white/10
                    text-slate-200 placeholder-slate-600
                    focus:outline-none focus:ring-1 focus:ring-rose-500/30 focus:border-rose-500/30
                    disabled:opacity-50
                    transition-all duration-200
                  "
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button
                onClick={() => {
                  setRestoreTarget(null)
                  setRestoreConfirmText('')
                }}
                disabled={restoreLoading}
                className="
                  px-4 py-2 rounded-lg text-sm font-medium
                  text-slate-400 bg-white/5 border border-white/5
                  hover:bg-white/10 hover:text-slate-300
                  disabled:opacity-50
                  transition-all duration-200
                "
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoreConfirmText !== 'RESTORE' || restoreLoading}
                className="
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                  text-white bg-rose-600 hover:bg-rose-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                  shadow-lg shadow-rose-500/20
                "
              >
                {restoreLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RotateCcw size={15} />
                )}
                Restore Backup
              </button>
            </div>
          </div>
        </ModalOverlay>,
        document.body,
      )}
    </div>
  )
}
