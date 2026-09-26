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
  Power,
  Info,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { fetchImageUpdates, checkImageRegistry, updateImage, checkSystemUpdate, applySystemUpdate, rollbackSystemUpdate, fetchVersion, applyUiUpdate, restartApiServer } from '../api/endpoints'
import type { ImageCheckResponse, ImageUpdateInfo, SystemUpdateCheckResponse, SystemUpdateApplyResponse, APIVersion } from '../../shared/types'
import { BUILD_VERSION, BUILD_DATE } from '../constants/buildInfo'

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

/** Registry path, repository and tag rendered as one readable reference that
 *  wraps at path boundaries instead of mid-word */
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff) || diff < 0) return 'just now'
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.floor(h / 24)} d ago`
}

function ImageRef({ image }: { image: string }) {
  const at = image.indexOf('@')
  const base = at >= 0 ? image.slice(0, at) : image
  const lastSlash = base.lastIndexOf('/')
  const path = lastSlash >= 0 ? base.slice(0, lastSlash + 1) : ''
  const nameTag = base.slice(lastSlash + 1)
  const colon = nameTag.lastIndexOf(':')
  const name = colon > 0 ? nameTag.slice(0, colon) : nameTag
  const tag = colon > 0 ? nameTag.slice(colon + 1) : ''
  const segments = path.split('/').filter(Boolean)
  return (
    <span className="font-mono text-xs leading-5" title={image}>
      {segments.map((seg) => (
        <span key={seg} className="text-slate-500">{seg}/<wbr /></span>
      ))}
      <span className="text-slate-100 font-semibold">{name}</span>
      {tag && (
        <span className="ml-1.5 inline-flex items-center rounded-md bg-white/[0.06] border border-white/[0.06] px-1.5 py-px text-[10px] text-slate-300 align-middle whitespace-nowrap">
          {tag}
        </span>
      )}
    </span>
  )
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

function UpdateStatusBadge({ res }: { res: SystemUpdateCheckResponse }) {
  if (res.checked === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full">
        <AlertTriangle size={10} />
        Check failed
      </span>
    )
  }
  if (res.available) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {res.latest_name ? `${res.latest_name} available` : 'Update available'}
      </span>
    )
  }
  if (res.state === 'ahead') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full" title="This checkout has commits newer than the release">
        <GitBranch size={10} />
        Ahead of the release
      </span>
    )
  }
  if (res.state === 'diverged') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
        <AlertTriangle size={10} />
        Diverged
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 bg-white/[0.06] px-2 py-0.5 rounded-full">
      <CheckCircle size={10} />
      Up to date
    </span>
  )
}

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
  const [replaceLocal, setReplaceLocal] = useState(false)
  const [restartAfter, setRestartAfter] = useState(true)
  const [restartingApi, setRestartingApi] = useState<string | null>(null)
  const [restartHint, setRestartHint] = useState<string | null>(null)
  const [applyReport, setApplyReport] = useState<SystemUpdateApplyResponse | null>(null)
  const [lastBackupTag, setLastBackupTag] = useState<string | null>(() => {
    // Persist across navigation — load from sessionStorage
    try { return sessionStorage.getItem('dcs-last-backup-tag') } catch { return null }
  })

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

  const ingestCheck = useCallback((res: SystemUpdateCheckResponse) => {
    setSysUpdate(res)
    setUiUpdateAvailable(!!res.ui_update?.available)
    useSettingsStore.getState().updateSetting('updatesAvailable', res.available ? Math.max(1, res.commits_behind) : 0)
    if (res.last_backup_tag) {
      setLastBackupTag(res.last_backup_tag)
      try { sessionStorage.setItem('dcs-last-backup-tag', res.last_backup_tag) } catch {}
    } else if (res.last_backup_tag === '') {
      setLastBackupTag(null)
      try { sessionStorage.removeItem('dcs-last-backup-tag') } catch {}
    }
    setLastChecked(Date.now())
  }, [])

  /** After a restart: wait for the API to answer again (up to ~1 min), then re-check */
  const waitForApi = useCallback(async (etaSeconds: number) => {
    const deadline = Date.now() + (Math.max(5, etaSeconds) + 50) * 1000
    await new Promise((r) => setTimeout(r, Math.min(Math.max(2, etaSeconds), 8) * 1000))
    while (Date.now() < deadline) {
      try {
        const res = await checkSystemUpdate()
        ingestCheck(res)
        fetchVersion().then(setApiVersionInfo).catch(() => {})
        return true
      } catch {
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
    return false
  }, [ingestCheck])

  const handleCheckSystemUpdate = useCallback(async () => {
    if (sysChecking) return
    setSysChecking(true)
    try {
      const result = await checkSystemUpdate()
      ingestCheck(result)
      if (result.checked === false) {
        addToast({ type: 'error', message: `Could not check for updates: ${result.error || 'GitHub is unreachable'}` })
      } else if (result.available) {
        addToast({ type: 'info', message: `DCS ${result.latest_version || result.latest_name || ''} is available (${result.commits_behind} commit${result.commits_behind !== 1 ? 's' : ''})` })
      } else if (result.ui_update?.available) {
        addToast({ type: 'info', message: 'DCS Manager UI update available' })
      } else {
        addToast({ type: 'success', message: 'Everything is up to date' })
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to check for updates' })
    } finally {
      setSysChecking(false)
    }
  }, [sysChecking, addToast, ingestCheck])

  const handleApplySystemUpdate = useCallback(async () => {
    if (sysApplying || !sysUpdate?.available) return
    const blocking = sysUpdate.local_changes?.conflicts ?? []
    if (blocking.length > 0 && !replaceLocal) {
      addToast({ type: 'error', message: 'Tick "Replace them with the release versions" first, or revert those files.' })
      return
    }
    setSysApplying(true)
    setApplyReport(null)
    setRestartHint(null)
    try {
      const result = await applySystemUpdate({ replaceLocal, restart: restartAfter })
      if (result.updated) {
        setApplyReport(result)
        const tag = result.backup_tag
        setLastBackupTag(tag)
        try { if (tag) sessionStorage.setItem('dcs-last-backup-tag', tag) } catch {}
        useSettingsStore.getState().updateSetting('updatesAvailable', 0)
        addToast({ type: 'success', message: `Updated to ${result.new_version || 'the latest release'}`, duration: 6000 })
        if (result.restart_scheduled && result.restart) {
          setRestartingApi(result.restart.method === 'systemd' ? 'Restarting the API through systemd (about 10 s)…' : 'Restarting the API…')
          const back = await waitForApi(result.restart.eta_seconds)
          setRestartingApi(null)
          addToast(back
            ? { type: 'success', message: 'The API is back on the new version' }
            : { type: 'error', message: 'The API did not answer after the restart — check the dcs-api service' })
        } else {
          if (result.restart?.hint) setRestartHint(result.restart.hint)
          const fresh = await checkSystemUpdate()
          ingestCheck(fresh)
          fetchVersion().then(setApiVersionInfo).catch(() => {})
        }
      } else {
        addToast({ type: result.state === 'current' ? 'info' : 'error', message: result.message || 'Nothing to apply' })
        const fresh = await checkSystemUpdate()
        ingestCheck(fresh)
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Update failed' })
    } finally {
      setSysApplying(false)
    }
  }, [sysApplying, sysUpdate, replaceLocal, restartAfter, addToast, ingestCheck, waitForApi])

  const handleRollback = useCallback(async () => {
    if (sysRollingBack || !lastBackupTag) return
    if (!window.confirm(`Roll back to ${lastBackupTag}?\n\nYour stack, template and plugin files are kept as they are.`)) return
    setSysRollingBack(true)
    setRestartHint(null)
    try {
      const result = await rollbackSystemUpdate(lastBackupTag, restartAfter)
      if (result.rolled_back) {
        addToast({ type: 'success', message: `Rolled back to ${result.restored_version || 'the previous version'}` })
        setLastBackupTag(null)
        try { sessionStorage.removeItem('dcs-last-backup-tag') } catch {}
        setApplyReport(null)
        if (result.restart_scheduled && result.restart) {
          setRestartingApi('Restarting the API…')
          await waitForApi(result.restart.eta_seconds)
          setRestartingApi(null)
        } else {
          if (result.restart?.hint) setRestartHint(result.restart.hint)
          const fresh = await checkSystemUpdate()
          ingestCheck(fresh)
        }
      } else {
        addToast({ type: 'error', message: result.message || 'Rollback failed' })
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Rollback failed' })
    } finally {
      setSysRollingBack(false)
    }
  }, [sysRollingBack, lastBackupTag, restartAfter, addToast, ingestCheck, waitForApi])

  const handleRestartApi = useCallback(async () => {
    if (restartingApi) return
    if (!window.confirm('Restart the API now?\n\nOpen pages reconnect by themselves. A deploy, backup or image pull running at this moment would be interrupted.')) return
    setRestartHint(null)
    try {
      const res = await restartApiServer()
      if (!res.restarting) {
        setRestartHint(res.hint)
        addToast({ type: 'info', message: 'DCS cannot restart this listener by itself — see the hint' })
        return
      }
      setRestartingApi(res.method === 'systemd' ? 'Restarting the API through systemd (about 10 s)…' : 'Restarting the API…')
      const back = await waitForApi(res.eta_seconds)
      setRestartingApi(null)
      addToast(back ? { type: 'success', message: 'API restarted' } : { type: 'error', message: 'The API did not answer after the restart' })
    } catch (err) {
      setRestartingApi(null)
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Restart failed' })
    }
  }, [restartingApi, addToast, waitForApi])

  const conflicts = sysUpdate?.local_changes?.conflicts ?? []
  const userEdits = sysUpdate?.local_changes?.user.length ?? 0

  // Auto-check for system + UI updates on mount
  useEffect(() => {
    if (isConnected && !sysUpdate && !sysChecking) {
      checkSystemUpdate().then(ingestCheck).catch(() => {})
      fetchVersion().then(setApiVersionInfo).catch(() => {})
    }
  }, [isConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic auto-check
  useEffect(() => {
    if (!isConnected || !autoCheckUpdates || autoCheckUpdates <= 0) return
    const timer = setInterval(() => {
      checkSystemUpdate().then(ingestCheck).catch(() => {})
    }, autoCheckUpdates)
    return () => clearInterval(timer)
  }, [isConnected, autoCheckUpdates, ingestCheck])

  // ---- Image update state ----
  const [registryChecking, setRegistryChecking] = useState(false)
  const [updatingImages, setUpdatingImages] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  // Recreate the Compose services right after a pull. Off = pull only: the
  // containers keep running on the old image until someone recreates them.
  const [recreate, setRecreate] = useState<boolean>(() => {
    try { return localStorage.getItem('updates.recreate') !== 'false' } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem('updates.recreate', recreate ? 'true' : 'false') } catch { /* storage unavailable */ }
  }, [recreate])
  // Outcome of the last bulk run per image, shown in the row until the next registry check
  const [bulkResults, setBulkResults] = useState<Record<string, 'done' | 'failed'>>({})

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

  // Everything "Update All" touches: confirmed registry updates first, then
  // images that are stale by age (deduplicated)
  const bulkTargets = useMemo(() => {
    const seen = new Set<string>()
    const out: ImageUpdateInfo[] = []
    for (const img of [...updatableImages, ...staleImages]) {
      if (!seen.has(img.image)) { seen.add(img.image); out.push(img) }
    }
    return out
  }, [updatableImages, staleImages])
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null)

  // ---- Check registry for updates (slow POST) ----
  const handleCheckRegistry = useCallback(async () => {
    if (registryChecking) return
    setRegistryChecking(true)
    setBulkResults({})
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
        const result = await updateImage(imageName, { recreate })
        if (result.success) {
          const parts: string[] = []
          if (result.containers_restarted.length > 0) parts.push(`recreated ${result.containers_restarted.join(', ')}`)
          if (result.containers_failed?.length) parts.push(`${result.containers_failed.join(', ')} did not come back up`)
          if (result.containers_skipped?.length) parts.push(`${result.containers_skipped.join(', ')} skipped (not Compose-managed)`)
          const tail = parts.length
            ? ` — ${parts.join('; ')}`
            : recreate ? ' — no running container uses it' : ' — containers keep running on the old image until they are recreated'
          addToast({
            type: result.containers_failed?.length ? 'warning' : 'success',
            message: `Pulled ${imageName}${tail}`,
            duration: 6000,
          })
          setBulkResults((prev) => ({ ...prev, [imageName]: 'done' }))
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
    [updatingImages, addToast, refresh, recreate],
  )

  // ---- Update every image with a confirmed update or a stale age ----
  const handleUpdateAllStale = useCallback(async () => {
    if (bulkUpdating || bulkTargets.length === 0) return
    setBulkUpdating(true)
    setBulkResults({})
    let successCount = 0
    let failCount = 0
    const restarted: string[] = []
    const skipped: string[] = []
    const failedContainers: string[] = []

    for (let i = 0; i < bulkTargets.length; i++) {
      const img = bulkTargets[i]
      setBulkProgress({ done: i, total: bulkTargets.length, current: img.image })
      try {
        const result = await updateImage(img.image, { recreate })
        if (result.success) {
          successCount++
          restarted.push(...result.containers_restarted)
          skipped.push(...(result.containers_skipped ?? []))
          failedContainers.push(...(result.containers_failed ?? []))
          setBulkResults((prev) => ({ ...prev, [img.image]: 'done' }))
        } else {
          failCount++
          setBulkResults((prev) => ({ ...prev, [img.image]: 'failed' }))
        }
      } catch {
        failCount++
        setBulkResults((prev) => ({ ...prev, [img.image]: 'failed' }))
      }
    }
    setBulkProgress(null)

    if (successCount > 0) {
      const parts: string[] = []
      if (restarted.length) parts.push(`recreated ${restarted.join(', ')}`)
      if (failedContainers.length) parts.push(`${failedContainers.join(', ')} did not come back up`)
      if (skipped.length) parts.push(`${skipped.length} not Compose-managed, left running`)
      if (!recreate) parts.push('containers keep running on the old image until they are recreated')
      addToast({
        type: failedContainers.length ? 'warning' : 'success',
        message: `Pulled ${successCount} image${successCount !== 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}${parts.length ? ` — ${parts.join('; ')}` : ''}`,
        duration: 8000,
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
  }, [bulkUpdating, bulkTargets, addToast, refresh, recreate])

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
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Installed</span>
                  <span className="text-xs font-mono text-slate-300">
                    {sysUpdate.current_version}
                    {sysUpdate.current_commit && <span className="text-slate-500"> · {sysUpdate.current_commit}</span>}
                  </span>
                </div>
                {sysUpdate.available && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Available</span>
                    <span className="text-xs font-mono text-emerald-400">
                      {sysUpdate.latest_version || sysUpdate.latest_name}
                      {sysUpdate.latest_commit && <span className="text-emerald-500/60"> · {sysUpdate.latest_commit}</span>}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Channel</span>
                  <span className="text-xs font-mono text-slate-400" title="Change it under Server Config → Environment → Update Channel">
                    {sysUpdate.channel || 'stable'}
                    <span className="text-slate-600"> · {sysUpdate.branch.replace(/^heads\//, '')}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Status</span>
                  <UpdateStatusBadge res={sysUpdate} />
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

                {sysUpdate.checked === false && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-500/[0.06] border border-rose-500/15">
                    <AlertTriangle size={12} className="text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-rose-300">{sysUpdate.error || 'GitHub could not be reached, so nothing is known about newer releases.'}</p>
                  </div>
                )}
                {sysUpdate.state === 'diverged' && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
                    <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-300">This checkout carries commits the release does not have, so it cannot be fast-forwarded. Align it once by hand (git fetch origin, then git reset --hard {sysUpdate.latest_commit}); your stack and template files are not part of that.</p>
                  </div>
                )}

                {userEdits > 0 && (
                  <p className="text-[10px] text-slate-500 flex items-start gap-1.5">
                    <Shield size={11} className="shrink-0 mt-px" />
                    <span>{userEdits} stack, template or plugin file{userEdits === 1 ? '' : 's'} carry your edits — updates keep them exactly as they are.</span>
                  </p>
                )}
                {conflicts.length > 0 && (
                  <div className="px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/15 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-300">These framework files were edited on this server and the release changes them too:</p>
                    </div>
                    <ul className="pl-5 space-y-0.5 text-[10px] font-mono text-amber-200/80">
                      {conflicts.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                    <label className="flex items-start gap-2 text-[10px] text-amber-200 cursor-pointer">
                      <input type="checkbox" checked={replaceLocal} onChange={(e) => setReplaceLocal(e.target.checked)} className="accent-amber-500 mt-0.5" />
                      <span>Replace them with the release versions (the current copies are kept under .data/update-backups)</span>
                    </label>
                  </div>
                )}

                {sysUpdate.available && sysUpdate.release_notes && sysUpdate.release_notes.trim() && (
                  <div className="mt-3 pt-3 border-t border-white/[0.03]">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">What&apos;s new</p>
                    <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-56 overflow-y-auto scrollbar-thin rounded-lg bg-slate-950/50 border border-white/[0.03] p-3">{sysUpdate.release_notes.trim()}</pre>
                  </div>
                )}
                {sysUpdate.available && sysUpdate.changelog.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-400">
                      {sysUpdate.changelog.length} commit{sysUpdate.changelog.length !== 1 ? 's' : ''}
                    </summary>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin mt-2">
                      {sysUpdate.changelog.map((c) => (
                        <div key={c.hash} className="flex items-start gap-2">
                          <GitCommit size={12} className="text-slate-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-300 truncate">{c.message}</p>
                            <p className="text-[9px] text-slate-500">{c.hash} by {c.author}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {isAdmin && sysUpdate.available && (
                  <div className="mt-3 pt-3 border-t border-white/[0.03] space-y-2.5">
                    <label className="flex items-start gap-2 text-[10px] text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={restartAfter} onChange={(e) => setRestartAfter(e.target.checked)} className="accent-emerald-500 mt-0.5" />
                      <span>
                        Restart the API afterwards so every part runs the new version
                        {sysUpdate.restart_method === 'manual' && <span className="text-amber-400/80"> — not possible from here on this install; a hint follows</span>}
                      </span>
                    </label>
                    <button
                      onClick={handleApplySystemUpdate}
                      disabled={sysApplying || !!restartingApi || (conflicts.length > 0 && !replaceLocal)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all duration-200 press"
                    >
                      {sysApplying ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      {sysApplying ? 'Updating…' : `Update to ${sysUpdate.latest_version || sysUpdate.latest_name || 'latest'}`}
                    </button>
                  </div>
                )}

                {restartingApi && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 text-[11px] text-emerald-300">
                    <Loader2 size={12} className="animate-spin shrink-0" />
                    {restartingApi}
                  </div>
                )}
                {restartHint && !restartingApi && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
                    <Info size={12} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-300 break-words">{restartHint}</p>
                  </div>
                )}

                {applyReport && (
                  <div className="mt-3 pt-3 border-t border-white/[0.03] space-y-1 text-[10px] text-slate-400">
                    <p className="text-slate-300 font-medium">
                      Updated {applyReport.previous_version} → {applyReport.new_version}
                      {typeof applyReport.commits_applied === 'number' && ` (${applyReport.commits_applied} commit${applyReport.commits_applied !== 1 ? 's' : ''})`}
                    </p>
                    {(applyReport.kept_local?.length ?? 0) > 0 && (
                      <p>Kept your edits: <span className="font-mono">{applyReport.kept_local?.join(', ')}</span></p>
                    )}
                    {(applyReport.replaced_local?.length ?? 0) > 0 && (
                      <p>Replaced (copies in <span className="font-mono">{applyReport.backup_dir}</span>): <span className="font-mono">{applyReport.replaced_local?.join(', ')}</span></p>
                    )}
                    {(applyReport.new_settings?.length ?? 0) > 0 && (
                      <p>New settings in Server Config: <span className="font-mono">{applyReport.new_settings?.join(', ')}</span> (defaults apply until you set them)</p>
                    )}
                    {applyReport.service_definition_changed && (
                      <p className="text-amber-300">The systemd unit template changed — run <span className="font-mono">sudo .scripts/install-service.sh</span> once to refresh it.</p>
                    )}
                  </div>
                )}

                {isAdmin && (
                  <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-white/[0.03]">
                    <div className="min-w-0">
                      {lastBackupTag ? (
                        <>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Rollback available</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={lastBackupTag}>{lastBackupTag}</p>
                        </>
                      ) : (
                        <p className="text-[10px] text-slate-500">
                          API listener: {sysUpdate.restart_method === 'reexec' ? 'restarts in place' : sysUpdate.restart_method === 'systemd' ? 'restarts through systemd' : 'restart by hand only'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {lastBackupTag && (
                        <button
                          onClick={handleRollback}
                          disabled={sysRollingBack || !!restartingApi}
                          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30 disabled:opacity-50 transition-all press"
                        >
                          {sysRollingBack ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                          {sysRollingBack ? 'Rolling back…' : 'Rollback'}
                        </button>
                      )}
                      <button
                        onClick={handleRestartApi}
                        disabled={!!restartingApi || sysApplying}
                        title="Restart the API listener now"
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition-all press"
                      >
                        <Power size={13} />
                        Restart API
                      </button>
                    </div>
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

            <div className="mt-4 pt-3 border-t border-white/[0.03] space-y-2">
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-800/40">
                <Shield size={12} className="text-slate-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {window.electronAPI
                    ? 'App updates are delivered via new releases. Check the GitHub repository for the latest version.'
                    : 'Running in browser mode: the Update button pulls the latest published image and recreates the dashboard container.'}
                </p>
              </div>
              <a
                href="https://github.com/scotthowson/Docker-Compose-Skeleton-UI/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-colors group/apk"
                title="Every release ships an Android APK and desktop installers"
              >
                <Download size={12} className="text-cyan-400 shrink-0" />
                <span className="text-[10px] text-slate-400 group-hover/apk:text-slate-200 leading-relaxed">
                  Android app and desktop installers: download from the latest GitHub release
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>

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
          {/* What happens after a pull */}
          {isAdmin && (
            <label
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium text-slate-400 bg-white/[0.03] border border-white/5 cursor-pointer select-none hover:text-slate-200 hover:border-white/10 transition-all"
              title="On: the Compose services that use an image are recreated right after it is pulled. Off: pull only — the containers keep the old image until you recreate them."
            >
              <input
                type="checkbox"
                checked={recreate}
                onChange={(e) => setRecreate(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-emerald-500"
              />
              Recreate containers
            </label>
          )}

          {/* Update All — prioritizes images with confirmed registry updates */}
          {isAdmin && bulkTargets.length > 0 && (
            <button
              onClick={handleUpdateAllStale}
              disabled={bulkUpdating}
              title={recreate ? 'Pulls each image and recreates the Compose services that use it' : 'Pulls each image; the containers are not recreated'}
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
              {bulkProgress
                ? `Updating ${bulkProgress.done + 1}/${bulkProgress.total}…`
                : updatableImages.length > 0
                  ? `Update All (${bulkTargets.length})`
                  : `Update All Stale (${bulkTargets.length})`}
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
          {data?.registry_checked_at && (
            <span className="text-[10px] text-slate-500 whitespace-nowrap" title={new Date(data.registry_checked_at).toLocaleString()}>
              Registry checked {formatRelative(data.registry_checked_at)}
            </span>
          )}
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
                  // Only the image being pulled right now is "updating"; the rest
                  // of a bulk run is queued, finished or failed
                  const isUpdating = updatingImages.has(img.image) || bulkProgress?.current === img.image
                  const bulkState = bulkResults[img.image]
                  const queued = bulkUpdating && !isUpdating && !bulkState && bulkTargets.some((t) => t.image === img.image)
                  return (
                    <tr
                      key={img.image}
                      className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors duration-150"
                    >
                      {/* Image name */}
                      <td className="px-4 py-3 min-w-[240px]">
                        <ImageRef image={img.image} />
                        {img.size && (
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            {img.size}
                          </span>
                        )}
                      </td>

                      {/* Container(s) — one chip per container */}
                      <td className="px-4 py-3">
                        {img.containers && img.containers !== '-' ? (
                          <div className="flex flex-wrap gap-1 max-w-[380px]">
                            {img.containers.split(',').map((c) => c.trim()).filter(Boolean).map((c) => (
                              <span key={c} className="inline-flex rounded-md bg-white/[0.05] border border-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-slate-300 whitespace-nowrap">
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>

                      {/* Stack (hidden on mobile) */}
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                        {img.stack ? (
                          <span className="inline-flex rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-300 whitespace-nowrap">
                            {img.stack}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>

                      {/* Age (days) */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-xs font-mono text-slate-300">
                          {img.age_days >= 0 ? img.age_days : '-'}
                        </span>
                      </td>

                      {/* Staleness badge + update indicator */}
                      <td className="px-4 py-3 whitespace-nowrap">
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
                          {bulkState === 'done' && !isUpdating && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 animate-fade-in" title={recreate ? 'Pulled and recreated in this run' : 'Pulled in this run (containers not recreated)'}>
                              <CheckCircle size={10} />
                              Updated
                            </span>
                          )}
                          {bulkState === 'failed' && !isUpdating && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-rose-500/15 text-rose-400 animate-fade-in">
                              Failed
                            </span>
                          )}
                          {queued && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-white/[0.04] text-slate-500">
                              Queued
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Update button */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {isAdmin ? (
                          <button
                            onClick={() => handleUpdateImage(img.image)}
                            disabled={isUpdating || queued || (img.staleness === 'current' && img.update_available !== true)}
                            title={img.update_available === true ? (recreate ? 'A newer digest is published — pull it and recreate the containers' : 'A newer digest is published — pull it; the containers are not recreated') : img.staleness === 'stale' ? (recreate ? 'Pull the tag again and recreate the containers' : 'Pull the tag again; the containers are not recreated') : 'Nothing newer is known for this tag'}
                            className={`
                              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap
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
                              : queued
                                ? 'Queued'
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
