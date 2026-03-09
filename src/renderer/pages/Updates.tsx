// =============================================================================
// Updates — Image Update Checker page with registry check and bulk updates
// =============================================================================

import { useState, useMemo, useCallback } from 'react'
import {
  Download,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Package,
  ArrowUpCircle,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useAuthStore } from '../stores/authStore'
import { fetchImageUpdates, checkImageRegistry, updateImage } from '../api/endpoints'
import type { ImageCheckResponse, ImageUpdateInfo } from '../../shared/types'

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
    <tr className="border-b border-white/[0.04]">
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
      className={`bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6 flex items-center gap-3 ${GLOW_MAP[color] ?? ''}`}
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
// Updates Page Component
// ---------------------------------------------------------------------------

export default function Updates() {
  const isConnected = useConnectionStore((s) => s.status) === 'connected'
  const userRole = useAuthStore((s) => s.userRole)
  const isAdmin = userRole === 'admin'
  const { addToast } = useToast()

  // ---- State ----
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
    }
  }, [data])

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
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
          <ArrowUpCircle size={24} className="text-slate-600" />
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
          {/* Update All Stale */}
          {isAdmin && staleImages.length > 0 && (
            <button
              onClick={handleUpdateAllStale}
              disabled={bulkUpdating}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
                border backdrop-blur-sm transition-all duration-200
                ${bulkUpdating
                  ? 'bg-rose-500/5 border-rose-500/10 text-rose-400/50 cursor-not-allowed'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/30 press'
                }
              `}
            >
              {bulkUpdating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Update All Stale ({staleImages.length})
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      </div>

      {/* ---- Image Table ---- */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            Tracked Images
          </h3>
          <p className="text-[10px] text-slate-600 leading-relaxed max-w-md">
            Staleness is based on when the image was built upstream, not when you pulled it. An image may show as "aging" or "stale" even after updating if the upstream hasn't released a newer build.
          </p>
        </div>

        {/* Initial loading skeleton */}
        {isInitialLoad ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
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
            <Package className="h-10 w-10 text-slate-600 mb-3" />
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
                <tr className="border-b border-white/[0.06]">
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
              <tbody className="divide-y divide-white/[0.04]">
                {images.map((img: ImageUpdateInfo) => {
                  const isUpdating = updatingImages.has(img.image) || bulkUpdating
                  return (
                    <tr
                      key={img.image}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150"
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
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </td>

                      {/* Age (days) */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-mono text-slate-300">
                          {img.age_days >= 0 ? img.age_days : '-'}
                        </span>
                      </td>

                      {/* Staleness badge */}
                      <td className="px-4 py-3">
                        <StalenessBadge staleness={img.staleness} />
                      </td>

                      {/* Update button */}
                      <td className="px-4 py-3 text-right">
                        {isAdmin ? (
                          <button
                            onClick={() => handleUpdateImage(img.image)}
                            disabled={isUpdating || img.staleness === 'current'}
                            className={`
                              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                              transition-all duration-200
                              ${img.staleness === 'current'
                                ? 'bg-white/[0.03] text-slate-600 border border-white/[0.04] cursor-default'
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
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-600">
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
