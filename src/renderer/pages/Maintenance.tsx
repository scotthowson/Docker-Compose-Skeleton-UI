// =============================================================================
// Maintenance — Docker system maintenance, orphan detection, disk analysis
// =============================================================================

import { useState } from 'react'
import {
  Wrench, RefreshCw, Loader2, Trash2, RotateCcw, AlertTriangle,
  CheckCircle2, Box, Image, HardDrive, Network, FileText, Scissors,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import {
  fetchMaintenanceReport,
  fetchMaintenanceOrphans,
  fetchMaintenanceDisk,
  triggerDeepPrune,
  triggerLogRotate,
  runDockerPrune,
  runImagePrune,
} from '../api/endpoints'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import type { MaintenanceReport, OrphanReport, DiskAnalysis } from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse size strings like "1.2 GB", "450 MB" to a numeric value for bar width */
function parseSizeToMb(size: string): number {
  const match = size.match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i)
  if (!match) return 0
  const val = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  switch (unit) {
    case 'TB': return val * 1024 * 1024
    case 'GB': return val * 1024
    case 'MB': return val
    case 'KB': return val / 1024
    default: return val / (1024 * 1024)
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Maintenance() {
  const isConnected = useConnectionStore((s) => s.status) === 'connected'
  const { addToast } = useToast()

  // ---- Polling ----
  const {
    data: report,
    loading: reportLoading,
    refresh: refreshReport,
  } = usePolling<MaintenanceReport>(fetchMaintenanceReport, 10000, { enabled: isConnected })

  const {
    data: orphans,
    loading: orphansLoading,
    refresh: refreshOrphans,
  } = usePolling<OrphanReport>(fetchMaintenanceOrphans, 15000, { enabled: isConnected })

  const {
    data: disk,
    loading: diskLoading,
    refresh: refreshDisk,
  } = usePolling<DiskAnalysis>(fetchMaintenanceDisk, 15000, { enabled: isConnected })

  // ---- Action state ----
  const [pruning, setPruning] = useState(false)
  const [imagePruning, setImagePruning] = useState(false)
  const [deepPruning, setDeepPruning] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [showDeepPruneModal, setShowDeepPruneModal] = useState(false)

  // ---- Action handlers ----
  const handleSafePrune = async () => {
    setPruning(true)
    try {
      const res = await runDockerPrune()
      addToast({
        type: res.success ? 'success' : 'error',
        message: res.success ? 'Docker system prune completed' : (res.output || 'Prune failed'),
      })
      refreshReport()
      refreshOrphans()
      refreshDisk()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Prune failed' })
    } finally {
      setPruning(false)
    }
  }

  const handleImagePrune = async () => {
    setImagePruning(true)
    try {
      const res = await runImagePrune()
      addToast({
        type: res.success ? 'success' : 'error',
        message: res.success ? 'Image prune completed' : (res.output || 'Image prune failed'),
      })
      refreshReport()
      refreshOrphans()
      refreshDisk()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Image prune failed' })
    } finally {
      setImagePruning(false)
    }
  }

  const handleDeepPrune = async () => {
    setShowDeepPruneModal(false)
    setDeepPruning(true)
    try {
      const res = await triggerDeepPrune()
      addToast({
        type: res.success ? 'success' : 'error',
        message: res.success ? 'Deep prune completed — all unused resources removed' : (res.output || 'Deep prune failed'),
      })
      refreshReport()
      refreshOrphans()
      refreshDisk()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Deep prune failed' })
    } finally {
      setDeepPruning(false)
    }
  }

  const handleLogRotate = async () => {
    setRotating(true)
    try {
      const res = await triggerLogRotate()
      addToast({
        type: res.success ? 'success' : 'error',
        message: res.success ? (res.message || 'Logs rotated successfully') : (res.message || 'Log rotation failed'),
      })
      refreshReport()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Log rotation failed' })
    } finally {
      setRotating(false)
    }
  }

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
  const maxStackMb = stackSizes.reduce((max, s) => Math.max(max, parseSizeToMb(s.size)), 0) || 1

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Deep Prune Confirmation Modal */}
      {showDeepPruneModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDeepPruneModal(false)}
        >
          <div
            className="relative w-full max-w-md mx-4 glass p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
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

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeepPruneModal(false)}
                className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeepPrune}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/25 transition-all"
              >
                <Trash2 size={14} />
                I understand, delete everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Wrench size={20} className="text-amber-400" />
            <h2 className="text-base md:text-xl font-bold text-slate-100">Maintenance</h2>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Docker system maintenance and cleanup
          </p>
        </div>
        <button
          onClick={handleRefreshAll}
          disabled={isAnyLoading}
          className="
            flex items-center gap-2 rounded-lg px-3.5 py-2
            text-sm font-medium text-slate-300
            bg-white/5 border border-white/10
            hover:bg-white/10 hover:border-white/15
            disabled:opacity-50 transition-all duration-200
          "
        >
          <RefreshCw size={15} className={isAnyLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ================================================================== */}
      {/* 1. System Report */}
      {/* ================================================================== */}
      <div className="glass rounded-xl p-5 border border-white/[0.06]">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">System Report</h3>

        {reportLoading && !report ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        ) : report ? (
          <div className="space-y-4">
            {/* 2x4 stat grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Containers */}
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
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
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
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
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
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
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
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
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 sm:col-span-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <HardDrive size={12} className="text-cyan-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">App Data</span>
                </div>
                <p className="text-lg font-bold text-slate-100 font-mono">{report.app_data_size}</p>
              </div>

              {/* Log Size */}
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 sm:col-span-2">
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
      {/* 2. Orphan Detection */}
      {/* ================================================================== */}
      <div className="glass rounded-xl p-5 border border-white/[0.06]">
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
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
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
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Image</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {orphanContainers.map((c) => (
                        <tr key={c.name} className="hover:bg-white/[0.02] transition-colors duration-150">
                          <td className="px-4 py-2 font-mono text-slate-200 text-xs">{c.name}</td>
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
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {danglingImages.map((img) => (
                        <tr key={img.id} className="hover:bg-white/[0.02] transition-colors duration-150">
                          <td className="px-4 py-2 font-mono text-slate-200 text-xs">{img.id.slice(0, 12)}</td>
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
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Driver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {danglingVolumes.map((vol) => (
                        <tr key={vol.name} className="hover:bg-white/[0.02] transition-colors duration-150">
                          <td className="px-4 py-2 font-mono text-slate-200 text-xs">{vol.name}</td>
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
                  <p className="text-sm text-slate-300">No orphaned resources detected</p>
                  <p className="text-xs text-slate-500 mt-0.5">Your Docker environment is tidy</p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ================================================================== */}
      {/* 3. Disk Analysis */}
      {/* ================================================================== */}
      <div className="glass rounded-xl p-5 border border-white/[0.06]">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Disk Analysis</h3>

        {diskLoading && !disk ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
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
                    const pct = Math.max((parseSizeToMb(entry.size) / maxStackMb) * 100, 2)
                    return (
                      <div key={entry.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-300 font-mono truncate mr-3">{entry.name}</span>
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
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Active</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Reclaimable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {disk.docker_df.map((row) => (
                        <tr key={row.type} className="hover:bg-white/[0.02] transition-colors duration-150">
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
      {/* 4. Actions */}
      {/* ================================================================== */}
      <div className="glass rounded-xl p-5 border border-white/[0.06]">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Actions</h3>
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
    </div>
  )
}
