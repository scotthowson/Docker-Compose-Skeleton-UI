// =============================================================================
// Maintenance — Docker system maintenance, orphan detection, disk analysis
// On a hub: Everywhere adds the hub's and every VM's numbers up (each asked at
// the same time) and runs each action on all of them; Hub or a VM: that one.
// =============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Wrench, RefreshCw, Loader2, Trash2, RotateCcw, AlertTriangle,
  CheckCircle2, Box, Image, HardDrive, Network, FileText, Scissors,
  BookOpen, ChevronRight, ChevronDown, X, Search, Boxes,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import {
  fetchFleetMaintenanceReport,
  fetchFleetOrphans,
  fetchFleetDisk,
  triggerDeepPruneScoped,
  triggerLogRotateScoped,
  runDockerPruneScoped,
  runImagePruneScoped,
  fleetTargets,
  fanOut,
  summarizeOutcomes,
  parseSizeBytes,
} from '../api/fleetScopedOps'
import { useFleetScope } from '../hooks/useFleetScope'
import FleetScopeChips from '../components/fleet/FleetScopeChips'
import VmCapsule from '../components/fleet/VmCapsule'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { useConfirm } from '../components/common/ConfirmDialog'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import type { FleetTarget, MemberOutcome, FleetMaintenanceReport, FleetOrphanReport, FleetDiskAnalysis } from '../../shared/fleetScopedOps'
import { LoadingState } from '../components/common/PageState'
import ModalOverlay from '../components/common/ModalOverlay'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** a row key: the resource on its DCS (one server's rows share one member) */
const rowKey = (member: string | null, id: string) => `${member ?? ''}|${id}`

/** who answered and who did not, for the Everywhere strip */
function answered(members: MemberOutcome<unknown>[]): { ok: number; failed: MemberOutcome<unknown>[] } {
  return { ok: members.filter((m) => m.ok).length, failed: members.filter((m) => !m.ok) }
}

// ---------------------------------------------------------------------------
// Guide
// ---------------------------------------------------------------------------

const MAINTENANCE_GUIDE_SECTIONS = [
  {
    title: 'Safe Prune',
    icon: Trash2,
    content: `Removes stopped containers and unused networks.
This is the safest cleanup option and won't
remove any images or volumes.

Command: docker system prune -f

Safe to run regularly — it only cleans up
resources that are already stopped or detached.`,
  },
  {
    title: 'Image Prune',
    icon: Image,
    content: `Removes dangling images (untagged layers left
over from builds and updates).

Standard:   docker image prune -f
Aggressive: docker image prune -af

Aggressive mode removes ALL unused images, not
just dangling ones. Configure with the
AGGRESSIVE_IMAGE_PRUNE flag in your .env file.`,
  },
  {
    title: 'Deep Prune',
    icon: AlertTriangle,
    content: `WARNING: Aggressive cleanup that removes:

• ALL stopped containers
• ALL unused networks
• ALL dangling AND unreferenced images
• ALL unused volumes
• Build cache

Command: docker system prune -af --volumes

This can free significant disk space but may
remove data you want to keep. Always backup
important volumes before running deep prune.`,
  },
  {
    title: 'Log Rotation',
    icon: FileText,
    content: `Archives the current DCS log file and starts fresh.

Process:
1. Compresses current log to logs/archive/
2. Truncates the active log file
3. Enforces retention (LOG_BACKUP_COUNT archives)

Default retention: 12 archived logs
Configure: LOG_BACKUP_COUNT in .env

Does not affect Docker container logs — only
the DCS framework operational log.`,
  },
  {
    title: 'A Proxmox fleet',
    icon: Boxes,
    content: `On a hub every VM runs its own Docker:

Everywhere  the hub's and every VM's numbers
            added up, each row marked with
            where it is; an action runs on the
            hub and on every VM that answers,
            one summary at the end
Hub         only the hub itself
VM chip     only that VM (through the hub)

A VM that does not answer is left out and
named in the strip under the header.`,
  },
  {
    title: 'Orphan Detection',
    icon: Search,
    content: `Scans for unused Docker resources:

Orphaned Containers
  Exited containers no longer managed by any
  stack's docker-compose.yml

Dangling Images
  Untagged image layers from builds/updates
  that are no longer referenced

Dangling Volumes
  Named volumes not attached to any container

Review orphans before pruning to ensure nothing
important is accidentally removed.`,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Maintenance() {
  const isConnected = useConnectionStore((s) => s.status) === 'connected'
  const { addToast } = useToast()
  const confirm = useConfirm()

  // ---- Scope: everywhere (the hub and every VM that answers), the hub, or one VM ----
  const { scope, setScope, member: scopeMember, memberName, members: scopeMembers, hasFleet } = useFleetScope()
  const everywhere = scope === 'all'
  const targets = useMemo<FleetTarget[]>(() => {
    if (everywhere) return fleetTargets(scopeMembers)
    if (scopeMember) return [{ id: scopeMember, name: memberName, vmid: scopeMembers.find((m) => m.id === scopeMember)?.vmid ?? null }]
    return [{ id: null, name: 'Hub', vmid: null }]
  }, [everywhere, scopeMember, memberName, scopeMembers])
  // the poll functions read the latest targets without restarting the poll every time the member list refreshes
  const targetsRef = useRef(targets)
  useEffect(() => { targetsRef.current = targets }, [targets])
  const whereLabel = hasFleet ? (everywhere ? 'everywhere' : scopeMember ? `VM ${memberName}` : 'the hub') : ''
  const vmCount = Math.max(targets.length - 1, 0)

  // ---- Polling (one fan-out per card; a single server is a fan-out of one) ----
  // Everywhere asks every server three questions per round: a slower round keeps a 16-VM hub under its request budget
  const fetchReport = useCallback(() => fetchFleetMaintenanceReport(targetsRef.current), [])
  const {
    data: reportData,
    loading: reportLoading,
    refresh: refreshReport,
  } = usePolling<FleetMaintenanceReport>(fetchReport, everywhere ? 45000 : 10000, { enabled: isConnected })

  const fetchOrphans = useCallback(() => fetchFleetOrphans(targetsRef.current), [])
  const {
    data: orphans,
    loading: orphansLoading,
    refresh: refreshOrphans,
  } = usePolling<FleetOrphanReport>(fetchOrphans, everywhere ? 60000 : 15000, { enabled: isConnected })

  const fetchDisk = useCallback(() => fetchFleetDisk(targetsRef.current), [])
  const {
    data: disk,
    loading: diskLoading,
    refresh: refreshDisk,
  } = usePolling<FleetDiskAnalysis>(fetchDisk, everywhere ? 60000 : 15000, { enabled: isConnected })

  // another view: ask again right away
  const scopeRef = useRef(scope)
  useEffect(() => {
    if (scopeRef.current === scope) return
    scopeRef.current = scope
    refreshReport(); refreshOrphans(); refreshDisk()
  }, [scope, refreshReport, refreshOrphans, refreshDisk])

  const report = reportData?.totals ?? null

  // ---- Action state ----
  const [pruning, setPruning] = useState(false)
  const [imagePruning, setImagePruning] = useState(false)
  const [deepPruning, setDeepPruning] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [showDeepPruneModal, setShowDeepPruneModal] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null)

  // Close topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showDeepPruneModal) { setShowDeepPruneModal(false); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showDeepPruneModal])

  // ---- Action handlers: one server, or on Everywhere the hub and every VM at once ----
  type ActionResult = { success: boolean; output?: string; message?: string }
  const runAction = useCallback(async (opts: {
    verb: string
    done: string
    call: (member: string | null) => Promise<ActionResult>
    setBusy: (b: boolean) => void
    /** the deep-prune modal already asked */
    confirmed?: boolean
    danger?: boolean
  }) => {
    const { verb, done, call, setBusy } = opts
    if (everywhere && !opts.confirmed) {
      const ok = await confirm({
        title: `${verb} everywhere`,
        message: `Run ${verb.toLowerCase()} on the hub and on ${vmCount} VM${vmCount === 1 ? '' : 's'}? Each server cleans its own Docker; one that fails does not stop the others.`,
        confirmLabel: 'Run everywhere',
        danger: opts.danger,
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      if (everywhere) {
        const outcomes = await fanOut(targets, call)
        // a server that answered but reported a failure counts as one
        const graded = outcomes.map((o) => (o.ok && o.value && o.value.success === false ? { ...o, ok: false, error: o.value.message || o.value.output || 'failed' } : o))
        const summary = summarizeOutcomes(graded, done)
        addToast({ type: summary.ok ? 'success' : 'error', message: summary.message, duration: summary.ok ? 5000 : 9000 })
      } else {
        const res = await call(scopeMember)
        const where = whereLabel ? ` on ${whereLabel}` : ''
        addToast({
          type: res.success ? 'success' : 'error',
          message: res.success ? `${done}${where}` : (res.message || res.output || `${verb} failed`),
        })
      }
      refreshReport()
      refreshOrphans()
      refreshDisk()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : `${verb} failed` })
    } finally {
      setBusy(false)
    }
  }, [everywhere, vmCount, targets, scopeMember, whereLabel, confirm, addToast, refreshReport, refreshOrphans, refreshDisk])

  const handleSafePrune = () => runAction({ verb: 'Safe prune', done: 'Docker system prune completed', call: runDockerPruneScoped, setBusy: setPruning })
  const handleImagePrune = () => runAction({ verb: 'Image prune', done: 'Image prune completed', call: runImagePruneScoped, setBusy: setImagePruning })
  const handleDeepPrune = () => {
    setShowDeepPruneModal(false)
    void runAction({ verb: 'Deep prune', done: 'Deep prune completed — all unused resources removed', call: triggerDeepPruneScoped, setBusy: setDeepPruning, confirmed: true, danger: true })
  }
  const handleLogRotate = () => runAction({ verb: 'Log rotation', done: 'Logs rotated', call: triggerLogRotateScoped, setBusy: setRotating })

  // ---- Refresh all ----
  const handleRefreshAll = () => {
    refreshReport()
    refreshOrphans()
    refreshDisk()
  }

  const isAnyLoading = reportLoading || orphansLoading || diskLoading

  // ---- Orphan state ----
  const orphanContainers = orphans?.containers ?? []
  const danglingImages = orphans?.images ?? []
  const danglingVolumes = orphans?.volumes ?? []
  const allClean = orphanContainers.length === 0 && danglingImages.length === 0 && danglingVolumes.length === 0

  // ---- Disk bar sizing ----
  const stackSizes = disk?.stack_sizes ?? []
  const maxStackBytes = stackSizes.reduce((max, s) => Math.max(max, parseSizeBytes(s.size) ?? 0), 0) || 1

  // ---- Who answered (Everywhere) ----
  const reportAnswered = reportData ? answered(reportData.members) : null

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* Deep Prune Confirmation Modal */}
      {showDeepPruneModal && createPortal(
        <ModalOverlay onClose={() => setShowDeepPruneModal(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDeepPruneModal(false)}
        >
          <div
            className="relative w-full max-w-md mx-4 glass p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/10">
                <AlertTriangle size={18} className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Deep Prune</h3>
                <p className="text-[10px] text-slate-500">Destructive action</p>
              </div>
            </div>

            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 mb-4">
              <p className="text-xs text-rose-300 leading-relaxed">
                <span className="font-semibold text-rose-400">Warning:</span> This will aggressively
                remove <span className="font-semibold">all</span> stopped containers, unused networks,
                dangling and unreferenced images, unused volumes, and build cache. Data stored in
                removed volumes will be <span className="font-semibold text-rose-400">permanently lost</span>.
              </p>
            </div>

            <p className="text-xs text-slate-400 mb-5">
              This action cannot be undone. Only proceed if you are certain no important data
              resides in dangling volumes or unused images.
            </p>

            <p className="text-[11px] text-slate-500 mb-4">
              Containers that Traefik starts on demand (Sablier) are stopped on purpose: they, their images, volumes and networks are left alone.
            </p>

            {hasFleet && (
              <p className="text-[11px] text-amber-200/90 mb-4 flex items-center gap-1.5">
                <Boxes size={12} className="shrink-0" />
                {everywhere ? `Runs on the hub and on ${vmCount} VM${vmCount === 1 ? '' : 's'}, each cleaning its own Docker.` : `Runs on ${whereLabel} only.`}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDeepPruneModal(false)}
                className="h-10 inline-flex items-center justify-center rounded-lg text-sm font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all press"
              >
                Cancel
              </button>
              <button
                onClick={handleDeepPrune}
                className="h-10 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-white bg-rose-500 border border-rose-400/40 hover:bg-rose-400 transition-all press whitespace-nowrap"
              >
                <Trash2 size={14} />
                {everywhere ? 'Delete everywhere' : 'Delete everything'}
              </button>
            </div>
          </div>
        </ModalOverlay>,
        document.body,
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Wrench size={20} className="text-amber-400" />
            <h2 className="text-base md:text-xl font-bold"><span className="text-gradient">Maintenance</span>{scopeMember && <span className="ml-2 text-sm font-medium text-amber-200/90">· VM {memberName}</span>}</h2>
          </div>
          {hasFleet && <div className="mt-2"><FleetScopeChips scope={scope} members={scopeMembers} onChange={setScope} label="Show" busy={reportLoading && !!reportData} /></div>}
          <p className="mt-0.5 text-sm text-slate-500">
            {hasFleet ? (everywhere ? 'Docker cleanup on the hub and every VM: numbers added up, actions run on all of them' : `Docker cleanup on ${whereLabel}`) : 'Docker system maintenance and cleanup'}
          </p>
          {everywhere && reportAnswered && (
            <p className="mt-1 text-[11px] text-slate-500">
              {reportAnswered.ok} of {targets.length} server{targets.length === 1 ? '' : 's'} answered
              {scopeMembers.some((m) => !m.reachable) && <span> · {scopeMembers.filter((m) => !m.reachable).length} VM{scopeMembers.filter((m) => !m.reachable).length === 1 ? '' : 's'} not answering ({scopeMembers.filter((m) => !m.reachable).map((m) => m.name).join(', ')})</span>}
              {reportAnswered.failed.length > 0 && <span className="text-amber-300/80"> · no report from {reportAnswered.failed.map((m) => m.name).join(', ')}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowGuide((v) => !v)}
            className={`
              flex items-center gap-2 rounded-lg px-3 py-2
              text-xs font-medium
              border transition-all duration-200
              ${showGuide
                ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20'
                : 'text-slate-300 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/15'
              }
            `}
          >
            <BookOpen size={14} />
            Guide
          </button>
          <button
            onClick={handleRefreshAll}
            disabled={isAnyLoading}
            className="
              flex items-center gap-2 rounded-lg px-3 py-2
              text-xs font-medium text-slate-300
              bg-white/5 border border-white/10
              hover:bg-white/10 hover:border-white/15
              disabled:opacity-50 transition-all duration-200
            "
          >
            <RefreshCw size={14} className={isAnyLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Guide Panel */}
      {showGuide && (
        <div className="glass rounded-xl overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Maintenance Guide</h2>
            </div>
            <button aria-label="Close" onClick={() => setShowGuide(false)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-400 mb-4">
              Maintenance tools help keep your Docker environment clean and efficient. Run cleanup operations regularly to reclaim disk space and remove orphaned resources.
            </p>
            {MAINTENANCE_GUIDE_SECTIONS.map((section, i) => {
              const isExpanded = expandedGuide === i
              const Icon = section.icon
              return (
                <div key={section.title} className="border border-white/[0.03] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedGuide(isExpanded ? null : i)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <Icon size={14} className="text-cyan-400 shrink-0" />
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

      {/* ================================================================== */}
      {/* 1. Actions */}
      {/* ================================================================== */}
      <div className="glass rounded-xl p-5 border border-white/5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">Actions{hasFleet && <span className="text-[11px] font-normal text-slate-500">{everywhere ? `on the hub and ${vmCount} VM${vmCount === 1 ? '' : 's'}` : `on ${whereLabel}`}</span>}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Safe Prune */}
          <button
            onClick={handleSafePrune}
            disabled={pruning || imagePruning || deepPruning || rotating}
            className="
              flex items-center justify-center gap-2 rounded-lg px-4 py-2.5
              text-sm font-medium
              bg-cyan-500/10 text-cyan-400 border border-cyan-500/20
              hover:bg-cyan-500/20 hover:border-cyan-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            {pruning ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
            Safe Prune
          </button>

          {/* Image Prune */}
          <button
            onClick={handleImagePrune}
            disabled={pruning || imagePruning || deepPruning || rotating}
            className="
              flex items-center justify-center gap-2 rounded-lg px-4 py-2.5
              text-sm font-medium
              bg-amber-500/10 text-amber-400 border border-amber-500/20
              hover:bg-amber-500/20 hover:border-amber-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            {imagePruning ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />}
            Image Prune
          </button>

          {/* Deep Prune */}
          <button
            onClick={() => setShowDeepPruneModal(true)}
            disabled={pruning || imagePruning || deepPruning || rotating}
            className="
              flex items-center justify-center gap-2 rounded-lg px-4 py-2.5
              text-sm font-medium
              bg-rose-500/10 text-rose-400 border border-rose-500/20
              hover:bg-rose-500/20 hover:border-rose-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            {deepPruning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Deep Prune
          </button>

          {/* Rotate Logs */}
          <button
            onClick={handleLogRotate}
            disabled={pruning || imagePruning || deepPruning || rotating}
            className="
              flex items-center justify-center gap-2 rounded-lg px-4 py-2.5
              text-sm font-medium
              bg-violet-500/10 text-violet-400 border border-violet-500/20
              hover:bg-violet-500/20 hover:border-violet-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
          >
            {rotating ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Rotate Logs
          </button>
        </div>
      </div>

      {/* 2. System Report */}
      {/* ================================================================== */}
      <div className="glass rounded-xl p-5 border border-white/5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">System Report{everywhere && <span className="text-[11px] font-normal text-slate-500">added up across {targets.length} server{targets.length === 1 ? '' : 's'}</span>}</h3>

        {reportLoading && !report ? (
          <LoadingState compact label="Loading…" />
        ) : report ? (
          <div className="space-y-4">
            {/* 2x4 stat grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Containers */}
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Box size={12} className="text-cyan-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Containers</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-slate-100">{report.containers.total}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {report.containers.running}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    {report.containers.stopped}
                  </span>
                </div>
              </div>

              {/* Images */}
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Image size={12} className="text-violet-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Images</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-slate-100">{report.images.total}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {report.images.dangling > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      {report.images.dangling} dangling
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      clean
                    </span>
                  )}
                </div>
              </div>

              {/* Volumes */}
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <HardDrive size={12} className="text-amber-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Volumes</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-slate-100">{report.volumes.total}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {report.volumes.dangling > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      {report.volumes.dangling} dangling
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      clean
                    </span>
                  )}
                </div>
              </div>

              {/* Networks */}
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Network size={12} className="text-emerald-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Networks</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-slate-100">{report.networks.total}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                    {report.networks.custom} custom
                  </span>
                </div>
              </div>

              {/* App Data Size */}
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 sm:col-span-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <HardDrive size={12} className="text-cyan-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">App Data</span>
                </div>
                <p className="text-lg font-bold text-slate-100 font-mono">{report.app_data_size}</p>
              </div>

              {/* Log Size */}
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 sm:col-span-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={12} className="text-violet-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Log Size</span>
                </div>
                <p className="text-lg font-bold text-slate-100 font-mono">{report.log_size}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ================================================================== */}
      {/* 3. Orphan Detection */}
      {/* ================================================================== */}
      <div className="glass rounded-xl p-5 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">Orphan Detection</h3>
          {!orphansLoading && orphans && allClean && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 size={12} />
              All Clean
            </span>
          )}
        </div>

        {orphansLoading && !orphans ? (
          <LoadingState compact label="Loading…" />
        ) : orphans ? (
          <div className="space-y-4">
            {/* Orphaned Containers */}
            {orphanContainers.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                  <Box size={12} className="text-rose-400" />
                  Orphaned Containers ({orphanContainers.length})
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Image</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {orphanContainers.map((c) => (
                        <tr key={rowKey(c.member, c.name)} className="hover:bg-white/[0.03] transition-colors duration-150">
                          <td className="px-4 py-2 font-mono text-slate-200 text-xs"><span className="inline-flex items-center gap-2">{c.name}{everywhere && <VmCapsule member={c.member} name={c.member_name} vmid={c.vmid} size="xs" onClick={() => setScope(c.member ?? 'hub')} />}</span></td>
                          <td className="px-4 py-2 font-mono text-slate-400 text-xs">{c.image}</td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dangling Images */}
            {danglingImages.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                  <Image size={12} className="text-amber-400" />
                  Dangling Images ({danglingImages.length})
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {danglingImages.map((img) => (
                        <tr key={rowKey(img.member, img.id)} className="hover:bg-white/[0.03] transition-colors duration-150">
                          <td className="px-4 py-2 font-mono text-slate-200 text-xs"><span className="inline-flex items-center gap-2">{img.id.slice(0, 12)}{everywhere && <VmCapsule member={img.member} name={img.member_name} vmid={img.vmid} size="xs" onClick={() => setScope(img.member ?? 'hub')} />}</span></td>
                          <td className="px-4 py-2 font-mono text-amber-400 text-xs">{img.size}</td>
                          <td className="px-4 py-2 text-slate-400 text-xs">{img.created}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dangling Volumes */}
            {danglingVolumes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                  <HardDrive size={12} className="text-amber-400" />
                  Dangling Volumes ({danglingVolumes.length})
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Driver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {danglingVolumes.map((vol) => (
                        <tr key={rowKey(vol.member, vol.name)} className="hover:bg-white/[0.03] transition-colors duration-150">
                          <td className="px-4 py-2 font-mono text-slate-200 text-xs"><span className="inline-flex items-center gap-2">{vol.name}{everywhere && <VmCapsule member={vol.member} name={vol.member_name} vmid={vol.vmid} size="xs" onClick={() => setScope(vol.member ?? 'hub')} />}</span></td>
                          <td className="px-4 py-2">
                            <span className="inline-flex rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                              {vol.driver}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* All clean message */}
            {allClean && (
              <div className="flex items-center justify-center py-6">
                <div className="text-center">
                  <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-300">No orphaned resources detected{whereLabel ? ` ${everywhere ? 'anywhere' : `on ${whereLabel}`}` : ''}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{everywhere ? 'Every server that answered is tidy' : 'Your Docker environment is tidy'}</p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ================================================================== */}
      {/* 4. Disk Analysis */}
      {/* ================================================================== */}
      <div className="glass rounded-xl p-5 border border-white/5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">Disk Analysis{everywhere && <span className="text-[11px] font-normal text-slate-500">every server&apos;s stacks; Docker&apos;s table added up per type</span>}</h3>

        {diskLoading && !disk ? (
          <LoadingState compact label="Loading…" />
        ) : disk ? (
          <div className="space-y-5">
            {/* Total app data */}
            <div className="flex items-center gap-2">
              <HardDrive size={14} className="text-cyan-400" />
              <span className="text-xs text-slate-400">Total App Data:</span>
              <span className="text-sm font-bold text-slate-100 font-mono">{disk.total_app_data}</span>
            </div>

            {/* Per-stack sizes as horizontal bars */}
            {stackSizes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 mb-3">Per-Stack App-Data</p>
                <div className="space-y-2">
                  {stackSizes.map((entry) => {
                    const pct = Math.max(((parseSizeBytes(entry.size) ?? 0) / maxStackBytes) * 100, 2)
                    return (
                      <div key={rowKey(entry.member, entry.name)}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-300 font-mono truncate mr-3 inline-flex items-center gap-2 min-w-0"><span className="truncate">{entry.name}</span>{everywhere && <VmCapsule member={entry.member} name={entry.member_name} vmid={entry.vmid} size="xs" onClick={() => setScope(entry.member ?? 'hub')} />}</span>
                          <span className="text-xs text-slate-400 font-mono shrink-0">{entry.size}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Docker system df table */}
            {disk.docker_df.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 mb-3">Docker System Disk Usage</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Active</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Reclaimable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {disk.docker_df.map((row) => (
                        <tr key={row.type} className="hover:bg-white/[0.03] transition-colors duration-150">
                          <td className="px-4 py-2 text-slate-200 font-medium text-xs">{row.type}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-300 text-xs">{row.total}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-300 text-xs">{row.active}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-300 text-xs">{row.size}</td>
                          <td className="px-4 py-2 text-right">
                            <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                              {row.reclaimable}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ================================================================== */}
    </div>
  )
}
