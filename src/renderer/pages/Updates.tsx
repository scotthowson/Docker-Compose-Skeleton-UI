// =============================================================================
// Updates — System + Image Update Checker with registry check and bulk updates
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Download,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Package,
  ArrowUpCircle,
  GitBranch,
  GitCommit,
  Shield,
  RotateCcw,
  Server,
  Monitor,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { fetchImageUpdates, checkImageRegistry, updateImage, checkSystemUpdate, applySystemUpdate, rollbackSystemUpdate, fetchVersion, applyUiUpdate } from '../api/endpoints'
import type { ImageCheckResponse, ImageUpdateInfo, SystemUpdateCheckResponse, APIVersion } from '../../shared/types'
import { BUILD_VERSION, BUILD_DATE } from '../constants/buildInfo'
import WhatsNew from '../components/common/WhatsNew'

// ---------------------------------------------------------------------------
// Staleness Badge
// ---------------------------------------------------------------------------

const STALENESS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  current: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  aging: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  stale: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
  },
  unknown: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-400',
    dot: 'bg-slate-400',
  },
}

function StalenessBadge({ staleness }: { staleness: string }) {
  const style = STALENESS_STYLES[staleness] ?? STALENESS_STYLES.unknown
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {staleness}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Skeleton rows for loading state
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.03]">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 w-20 rounded skeleton" />
        </td>
      ))}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: number | null
  color: 'emerald' | 'cyan' | 'amber' | 'rose'
  loading: boolean
}

const GLOW_MAP: Record<string, string> = {
  emerald: 'glow-emerald',
  cyan: 'glow-cyan',
  rose: 'glow-rose',
  amber: 'glow-amber',
}

function SummaryCard({ icon, label, value, color, loading }: SummaryCardProps) {
  return (
    <div
      className={`bg-slate-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-xl p-4 md:p-6 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 ${GLOW_MAP[color] ?? ''}`}
    >
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
        {loading ? (
          <div className="h-6 w-10 rounded skeleton mt-1" />
        ) : (
          <p className="text-xl font-bold text-white">{value ?? 0}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ---------------------------------------------------------------------------
// Updates Page Component
// ---------------------------------------------------------------------------

export default function Updates() {
  const isConnected = useConnectionStore((s) => s.status) === 'connected'
  const userRole = useAuthStore((s) => s.userRole)
  const isAdmin = userRole === 'admin'
  const { addToast } = useToast()

  const autoCheckUpdates = useSettingsStore((s) => s.autoCheckUpdates)
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const [lastChecked, setLastChecked] = useState<number | null>(null)

  // ---- System update state ----
  const [sysUpdate, setSysUpdate] = useState<SystemUpdateCheckResponse | null>(null)
  const [sysChecking, setSysChecking] = useState(false)
  const [sysApplying, setSysApplying] = useState(false)
  const [sysRollingBack, setSysRollingBack] = useState(false)
  const [lastBackupTag, setLastBackupTag] = useState<string | null>(null)

  // ---- UI image update state ----
  const [uiUpdateAvailable, setUiUpdateAvailable] = useState(false)
  const [uiUpdating, setUiUpdating] = useState(false)

  // App version from Electron
  const [appVersion, setAppVersion] = useState<string>(BUILD_VERSION)
  useEffect(() => {
    if (window.electronAPI?.getVersion) {
      window.electronAPI.getVersion().then(v => setAppVersion(v)).catch(() => {})
    }
  }, [])

  // API version info
  const [apiVersionInfo, setApiVersionInfo] = useState<APIVersion | null>(null)

  const handleCheckSystemUpdate = useCallback(async () => {
    if (sysChecking) return
    setSysChecking(true)
    try {
      const result = await checkSystemUpdate()
      processUpdateResult(result)
      // Toasts for manual check
      const uiUp = (result as Record<string, unknown>).ui_update as { available?: boolean } | undefined
      if (uiUp?.available) {
        addToast({ type: 'info', message: 'DCS Manager UI update available' })
      }
      if (result.available) {
        addToast({ type: 'info', message: `DCS update available: ${result.commits_behind} commit${result.commits_behind !== 1 ? 's' : ''} behind` })
      } else if (!uiUp?.available) {
        addToast({ type: 'success', message: 'Everything is up to date' })
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to check for updates' })
    } finally {
      setSysChecking(false)
    }
  }, [sysChecking, addToast, processUpdateResult])

  const handleApplySystemUpdate = useCallback(async () => {
    if (sysApplying || !sysUpdate?.available) return
    setSysApplying(true)
    try {
      const result = await applySystemUpdate()
      if (result.success || result.updated) {
        setLastBackupTag(result.backup_tag)
        const newVersion = result.updated_to || result.new_version || 'latest'
        addToast({ type: 'success', message: `Updated to ${newVersion}${result.restart_required ? ' — API server restart may be needed' : ''}`, duration: 6000 })
        useSettingsStore.getState().updateSetting('updatesAvailable', 0)
        // Re-check to update UI
        const fresh = await checkSystemUpdate()
        setSysUpdate(fresh)
      } else {
        addToast({ type: 'error', message: result.message || 'Update failed' })
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Update failed' })
    } finally {
      setSysApplying(false)
    }
  }, [sysApplying, sysUpdate, addToast])

  const handleRollback = useCallback(async () => {
    if (sysRollingBack || !lastBackupTag) return
    setSysRollingBack(true)
    try {
      const result = await rollbackSystemUpdate(lastBackupTag)
      if (result.success || result.rolled_back) {
        addToast({ type: 'success', message: `Rolled back to ${result.restored_version || 'previous version'}` })
        setLastBackupTag(null)
        const fresh = await checkSystemUpdate()
        setSysUpdate(fresh)
      } else {
        addToast({ type: 'error', message: result.message || 'Rollback failed' })
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Rollback failed' })
    } finally {
      setSysRollingBack(false)
    }
  }, [sysRollingBack, lastBackupTag, addToast])

  // Process update check result — shared by auto-check and manual check
  const processUpdateResult = useCallback((res: SystemUpdateCheckResponse) => {
    setSysUpdate(res)
    const uiUp = (res as Record<string, unknown>).ui_update as { available?: boolean } | undefined
    setUiUpdateAvailable(!!uiUp?.available)
    useSettingsStore.getState().updateSetting('updatesAvailable', res.available ? res.commits_behind : 0)
    setLastChecked(Date.now())
  }, [])

  // Auto-check for system + UI updates on mount
  useEffect(() => {
    if (isConnected && !sysUpdate && !sysChecking) {
      checkSystemUpdate().then(processUpdateResult).catch(() => {})
      fetchVersion().then(setApiVersionInfo).catch(() => {})
    }
  }, [isConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic auto-check
  useEffect(() => {
    if (!isConnected || !autoCheckUpdates || autoCheckUpdates <= 0) return
    const timer = setInterval(() => {
      checkSystemUpdate().then(processUpdateResult).catch(() => {})
    }, autoCheckUpdates)
    return () => clearInterval(timer)
  }, [isConnected, autoCheckUpdates, processUpdateResult])

  // ---- Image update state ----
  const [registryChecking, setRegistryChecking] = useState(false)
  const [updatingImages, setUpdatingImages] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)

  // ---- Polling: local staleness data ----
  const {
    data,
    loading,
    refresh,
  } = usePolling<ImageCheckResponse>(fetchImageUpdates, 30000, {
    enabled: isConnected,
  })

  const images = data?.images ?? []

  // ---- Computed summary ----
  const counts = useMemo(() => {
    return {
      total: data?.total ?? 0,
      current: data?.current ?? 0,
      aging: data?.aging ?? 0,
      stale: data?.stale ?? 0,
      updates: data?.updates_available ?? images.filter((img) => img.update_available === true).length,
    }
  }, [data, images])

  const updatableImages = useMemo(
    () => images.filter((img) => img.update_available === true),
    [images],
  )

  const staleImages = useMemo(
    () => images.filter((img) => img.staleness === 'stale'),
    [images],
  )

  // ---- Check registry for updates (slow POST) ----
  const handleCheckRegistry = useCallback(async () => {
    if (registryChecking) return
    setRegistryChecking(true)
    try {
      const result = await checkImageRegistry()
      addToast({
        type: 'info',
        message: `Registry check complete: ${result.updates_available} update${result.updates_available !== 1 ? 's' : ''} available out of ${result.total} image${result.total !== 1 ? 's' : ''}`,
        duration: 5000,
      })
      // Refresh local data to pick up any new staleness info
      refresh()
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Registry check failed',
      })
    } finally {
      setRegistryChecking(false)
    }
  }, [registryChecking, addToast, refresh])

  // ---- Update a single image ----
  const handleUpdateImage = useCallback(
    async (imageName: string) => {
      if (updatingImages.has(imageName)) return
      setUpdatingImages((prev) => new Set(prev).add(imageName))
      try {
        const result = await updateImage(imageName)
        if (result.success) {
          addToast({
            type: 'success',
            message: `Updated ${imageName}${result.containers_restarted.length > 0 ? ` — restarted ${result.containers_restarted.join(', ')}` : ''}`,
          })
          refresh()
        } else {
          addToast({ type: 'error', message: `Failed to update ${imageName}` })
        }
      } catch (err) {
        addToast({
          type: 'error',
          message: err instanceof Error ? err.message : `Failed to update ${imageName}`,
        })
      } finally {
        setUpdatingImages((prev) => {
          const next = new Set(prev)
          next.delete(imageName)
          return next
        })
      }
    },
    [updatingImages, addToast, refresh],
  )

  // ---- Update all stale images ----
  const handleUpdateAllStale = useCallback(async () => {
    if (bulkUpdating || staleImages.length === 0) return
    setBulkUpdating(true)
    let successCount = 0
    let failCount = 0

    for (const img of staleImages) {
      try {
        const result = await updateImage(img.image)
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    if (successCount > 0) {
      addToast({
        type: 'success',
        message: `Updated ${successCount} stale image${successCount !== 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        duration: 5000,
      })
    }
    if (failCount > 0 && successCount === 0) {
      addToast({
        type: 'error',
        message: `All ${failCount} image update${failCount !== 1 ? 's' : ''} failed`,
      })
    }

    refresh()
    setBulkUpdating(false)
  }, [bulkUpdating, staleImages, addToast, refresh])

  // ---- Disconnected ----
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
          <ArrowUpCircle size={24} className="text-slate-500" />
        </div>
        <p className="text-sm text-slate-500">Connect to a server to check for image updates</p>
      </div>
    )
  }

  // ---- Initial loading skeleton ----
  const isInitialLoad = loading && !data

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />

      {/* ══════════════════════════════════════════════════════════════════════
          System & Framework Updates
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-xl p-4 md:p-6 gradient-border transition-all duration-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/10 flex items-center justify-center">
              <Server size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight"><span className="text-gradient">System Updates</span></h2>
              <p className="text-xs text-slate-500">DCS framework and application version management</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lastChecked && (
              <span className="text-[10px] text-slate-500">
                Last checked {formatRelativeTime(lastChecked)}
              </span>
            )}
            <button
              onClick={handleCheckSystemUpdate}
              disabled={sysChecking}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all duration-200 disabled:opacity-50 press"
            >
              {sysChecking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Check for Updates
            </button>
          </div>
        </div>

        {/* Auto-check settings */}
        <div className="flex items-center gap-3 mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.03]">
          <div className="flex-1">
            <p className="text-xs font-medium text-slate-300">Auto-check for updates</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Periodically check for DCS framework and image updates</p>
          </div>
          <select
            value={autoCheckUpdates}
            onChange={(e) => updateSetting('autoCheckUpdates', Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
          >
            <option value={0}>Off</option>
            <option value={3600000}>Every hour</option>
            <option value={86400000}>Every 24 hours</option>
            <option value={604800000}>Every week</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {/* DCS Backend */}
          <div className={`rounded-xl border p-5 transition-all duration-300 ${
            sysUpdate?.available
              ? 'bg-emerald-500/[0.04] border-emerald-500/15 glow-emerald'
              : 'bg-white/[0.03] border-white/5'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <GitBranch size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">DCS Framework</p>
                <p className="text-[10px] text-slate-500">Docker Compose Skeleton backend</p>
              </div>
            </div>

            {sysUpdate ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Current</span>
                  <span className="text-xs font-mono text-slate-300">{sysUpdate.current_version}</span>
                </div>
                {sysUpdate.available && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Latest</span>
                    <span className="text-xs font-mono text-emerald-400">{sysUpdate.latest_version}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Branch</span>
                  <span className="text-xs font-mono text-slate-400">{sysUpdate.branch.replace(/^heads\//, '')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Status</span>
                  {sysUpdate.available ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {sysUpdate.commits_behind} update{sysUpdate.commits_behind !== 1 ? 's' : ''} available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded-full">
                      <CheckCircle size={10} />
                      Up to date
                    </span>
                  )}
                </div>

                {apiVersionInfo && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">API Version</span>
                      <span className="text-xs font-mono text-slate-300">{apiVersionInfo.api_version}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Docker</span>
                      <span className="text-xs font-mono text-slate-300">{apiVersionInfo.docker_version}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Compose</span>
                      <span className="text-xs font-mono text-slate-300">{apiVersionInfo.compose_version}</span>
                    </div>
                  </>
                )}

                {sysUpdate.has_local_changes && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
                    <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-300">Local modifications detected. Commit or stash changes before updating.</p>
                  </div>
                )}

                {/* Changelog */}
                {sysUpdate.available && sysUpdate.changelog.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.03]">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Changelog</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin">
                      {sysUpdate.changelog.slice(0, 10).map((c) => (
                        <div key={c.hash} className="flex items-start gap-2">
                          <GitCommit size={12} className="text-slate-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-300 truncate">{c.message}</p>
                            <p className="text-[9px] text-slate-500">{c.hash} by {c.author}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {isAdmin && sysUpdate.available && !sysUpdate.has_local_changes && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.03]">
                    <button
                      onClick={handleApplySystemUpdate}
                      disabled={sysApplying}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all duration-200 press"
                    >
                      {sysApplying ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      {sysApplying ? 'Updating...' : 'Apply Update'}
                    </button>
                    {lastBackupTag && (
                      <button
                        onClick={handleRollback}
                        disabled={sysRollingBack}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-amber-400 disabled:opacity-50 transition-all press"
                      >
                        {sysRollingBack ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                        Rollback
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="h-3 w-16 rounded skeleton" />
                    <div className="h-3 w-20 rounded skeleton" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* UI Application */}
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center">
                <Monitor size={16} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">DCS Manager</p>
                <p className="text-[10px] text-slate-500">Desktop application</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Version</span>
                <span className="text-xs font-mono text-slate-300">{appVersion}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Build Date</span>
                <span className="text-xs text-slate-400">{BUILD_DATE}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Platform</span>
                <span className="text-xs text-slate-400">{window.electronAPI ? 'Electron Desktop' : 'Web Interface (Docker)'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Status</span>
                {uiUpdateAvailable ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                    <ArrowUpCircle size={10} />
                    Update Available
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded-full">
                    <CheckCircle size={10} />
                    Current
                  </span>
                )}
              </div>
            </div>
            {uiUpdateAvailable && (
              <div className="mt-3 pt-3 border-t border-white/[0.03]">
                <button
                  onClick={async () => {
                    setUiUpdating(true)
                    addToast({ type: 'info', message: 'Updating DCS Manager UI...', duration: 3000 })
                    try {
                      await applyUiUpdate()
                      addToast({ type: 'success', message: 'UI updated — reconnecting...', duration: 5000 })
                      setTimeout(() => window.location.reload(), 8000)
                    } catch (err) {
                      addToast({ type: 'error', message: err instanceof Error ? err.message : 'UI update failed' })
                    }
                    setUiUpdating(false)
                  }}
                  disabled={uiUpdating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-cyan-500 text-white hover:bg-cyan-400 shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all press"
                >
                  {uiUpdating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {uiUpdating ? 'Updating...' : 'Update DCS Manager'}
                </button>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-white/[0.03]">
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-800/40">
                <Shield size={12} className="text-slate-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {window.electronAPI
                    ? 'App updates are delivered via new releases. Check the GitHub repository for the latest version.'
                    : 'Running in browser mode. Update by pulling the latest source and rebuilding.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          What's New
          ══════════════════════════════════════════════════════════════════════ */}
      <WhatsNew />

      {/* ══════════════════════════════════════════════════════════════════════
          Image Updates (existing section)
          ══════════════════════════════════════════════════════════════════════ */}

      {/* ---- Header ---- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 flex items-center justify-center text-cyan-400">
            <ArrowUpCircle size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Image Updates</h2>
            <p className="text-xs text-slate-500">
              Check Docker images for available updates and apply them
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Update All — prioritizes images with confirmed registry updates */}
          {isAdmin && (updatableImages.length > 0 || staleImages.length > 0) && (
            <button
              onClick={handleUpdateAllStale}
              disabled={bulkUpdating}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
                border backdrop-blur-sm transition-all duration-200
                ${bulkUpdating
                  ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400/50 cursor-not-allowed'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30 press'
                }
              `}
            >
              {bulkUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {updatableImages.length > 0
                ? `Update All (${updatableImages.length})`
                : `Update All Stale (${staleImages.length})`}
            </button>
          )}

          {/* Check Registry */}
          <button
            onClick={handleCheckRegistry}
            disabled={registryChecking}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
              border backdrop-blur-sm transition-all duration-200
              ${registryChecking
                ? 'bg-cyan-500/5 border-cyan-500/10 text-cyan-400/50 cursor-not-allowed'
                : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/30 press'
              }
            `}
          >
            {registryChecking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Check Registry for Updates
          </button>
        </div>
      </div>

      {/* ---- Summary stat cards ---- */}
      <div className={`grid grid-cols-2 ${counts.updates > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3 stagger-children`}>
        <SummaryCard
          icon={<Package className="h-4 w-4 text-cyan-400" />}
          label="Total Images"
          value={counts.total}
          color="cyan"
          loading={isInitialLoad}
        />
        <SummaryCard
          icon={<CheckCircle className="h-4 w-4 text-emerald-400" />}
          label="Current"
          value={counts.current}
          color="emerald"
          loading={isInitialLoad}
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4 text-amber-400" />}
          label="Aging"
          value={counts.aging}
          color="amber"
          loading={isInitialLoad}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4 text-rose-400" />}
          label="Stale"
          value={counts.stale}
          color="rose"
          loading={isInitialLoad}
        />
        {counts.updates > 0 && (
          <SummaryCard
            icon={<ArrowUpCircle className="h-4 w-4 text-emerald-400" />}
            label="Updates"
            value={counts.updates}
            color="emerald"
            loading={isInitialLoad}
          />
        )}
      </div>

      {/* ---- Image Table ---- */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            Tracked Images
          </h3>
          <p className="text-[10px] text-slate-500 leading-relaxed max-w-md">
            Age shows when the image was built. Click "Check Registry" to compare digests against upstream — this shows definitive "Update" or "Latest" badges without pulling images.
          </p>
        </div>

        {/* Initial loading skeleton */}
        {isInitialLoad ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">Image</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">Container(s)</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase tracking-wider hidden sm:table-cell">Stack</th>
                  <th className="text-right px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">Age (days)</th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">Staleness</th>
                  <th className="text-right px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(6)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : images.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <Package className="h-10 w-10 text-slate-500 mb-3" />
            <p className="text-sm text-slate-400 font-medium">No images found</p>
            <p className="text-xs text-slate-500 mt-1">
              {isConnected
                ? 'Run a registry check to discover images and their update status.'
                : 'Connect to the API server to view image update information.'}
            </p>
            {isConnected && (
              <button
                onClick={handleCheckRegistry}
                disabled={registryChecking}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all duration-200 press"
              >
                {registryChecking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Check Registry
              </button>
            )}
          </div>
        ) : (
          /* Image table */
          <div className="overflow-x-auto -mx-4 md:-mx-6">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">
                    Image
                  </th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">
                    Container(s)
                  </th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                    Stack
                  </th>
                  <th className="text-right px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">
                    Age (days)
                  </th>
                  <th className="text-left px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">
                    Staleness
                  </th>
                  <th className="text-right px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {images.map((img: ImageUpdateInfo) => {
                  const isUpdating = updatingImages.has(img.image) || bulkUpdating
                  return (
                    <tr
                      key={img.image}
                      className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors duration-150"
                    >
                      {/* Image name */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-200 break-all">
                          {img.image}
                        </span>
                        {img.size && (
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            {img.size}
                          </span>
                        )}
                      </td>

                      {/* Container(s) */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-400 font-mono">
                          {img.containers || '-'}
                        </span>
                      </td>

                      {/* Stack (hidden on mobile) */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {img.stack ? (
                          <span className="inline-flex rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-300">
                            {img.stack}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>

                      {/* Age (days) */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-mono text-slate-300">
                          {img.age_days >= 0 ? img.age_days : '-'}
                        </span>
                      </td>

                      {/* Staleness badge + update indicator */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StalenessBadge staleness={img.staleness} />
                          {img.update_available === true && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400">
                              <ArrowUpCircle size={10} />
                              Update
                            </span>
                          )}
                          {img.update_available === false && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-white/[0.04] text-slate-500">
                              <CheckCircle size={10} />
                              Latest
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Update button */}
                      <td className="px-4 py-3 text-right">
                        {isAdmin ? (
                          <button
                            onClick={() => handleUpdateImage(img.image)}
                            disabled={isUpdating || (img.staleness === 'current' && img.update_available !== true)}
                            className={`
                              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                              transition-all duration-200
                              ${img.update_available === true
                                ? isUpdating
                                  ? 'bg-emerald-500/5 text-emerald-400/50 border border-emerald-500/10 cursor-not-allowed'
                                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 hover:border-emerald-500/35 press shadow-sm shadow-emerald-500/10'
                                : img.staleness === 'current'
                                  ? 'bg-white/[0.03] text-slate-500 border border-white/[0.03] cursor-default'
                                  : isUpdating
                                    ? 'bg-emerald-500/5 text-emerald-400/50 border border-emerald-500/10 cursor-not-allowed'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30 press'
                              }
                            `}
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : img.staleness === 'current' ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                            {isUpdating
                              ? 'Updating...'
                              : img.staleness === 'current'
                                ? 'Up to date'
                                : 'Update'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-500">
                            {img.staleness === 'current' ? (
                              <><CheckCircle className="h-3 w-3" /> Up to date</>
                            ) : (
                              <StalenessBadge staleness={img.staleness} />
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
