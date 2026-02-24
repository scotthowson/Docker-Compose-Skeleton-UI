// =============================================================================
// Images — Image tracking page with table/card toggle and summary stats
// =============================================================================

import React, { useState, useCallback, useMemo } from 'react'
import { useImageStore } from '../stores/imageStore'
import { useApi } from '../hooks/useApi'
import { fetchImages, runImagePrune, deleteImage } from '../api/endpoints'
import { useToast } from '../components/common/Toast'
import ImageList from '../components/images/ImageList'
import ImageCard from '../components/images/ImageCard'
import {
  HardDrive,
  CircleCheck,
  Clock,
  AlertTriangle,
  LayoutList,
  LayoutGrid,
  Search,
  Trash2,
  Loader2,
  ListChecks,
} from 'lucide-react'

const IMAGE_POLL_INTERVAL = 60_000

const Images: React.FC = () => {
  const setImages = useImageStore((s) => s.setImages)
  const setLoading = useImageStore((s) => s.setLoading)
  const images = useImageStore((s) => s.images)
  const loading = useImageStore((s) => s.loading)

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [pruneLoading, setPruneLoading] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResults, setBatchResults] = useState<Array<{ id: string; success: boolean; message: string }> | null>(null)
  const { addToast } = useToast()

  // Fetch images via the connection-aware polling hook
  const handleFetch = useCallback(async () => {
    setLoading(true)
    const result = await fetchImages()
    setImages(result.images)
    setLoading(false)
    return result
  }, [setImages, setLoading])

  useApi(handleFetch, IMAGE_POLL_INTERVAL)

  // Prune dangling images
  const handlePrune = useCallback(async () => {
    if (pruneLoading) return
    setPruneLoading(true)
    try {
      const result = await runImagePrune()
      addToast({
        type: 'success',
        message: result.message || 'Dangling images pruned successfully',
      })
      // Refresh image list after prune
      await handleFetch()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to prune dangling images'
      addToast({ type: 'error', message })
    } finally {
      setPruneLoading(false)
    }
  }, [pruneLoading, addToast, handleFetch])

  // Filter by search
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images
    const q = searchQuery.toLowerCase()
    return images.filter(
      (i) =>
        i.repository.toLowerCase().includes(q) ||
        i.tag.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        i.staleness.toLowerCase().includes(q),
    )
  }, [images, searchQuery])

  // Batch mode handlers
  const handleToggleBatch = useCallback(() => {
    setBatchMode(prev => {
      if (prev) {
        setSelectedImages(new Set())
        setBatchResults(null)
      }
      return !prev
    })
  }, [])

  const handleToggleImage = useCallback((id: string) => {
    setSelectedImages(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedImages(new Set(filteredImages.map(i => i.id)))
  }, [filteredImages])

  const handleClearSelection = useCallback(() => {
    setSelectedImages(new Set())
  }, [])

  const handleDeleteSelected = useCallback(async () => {
    if (selectedImages.size === 0 || batchLoading) return
    setBatchLoading(true)
    setBatchResults(null)

    const results: Array<{ id: string; success: boolean; message: string }> = []

    for (const id of selectedImages) {
      try {
        const res = await deleteImage(id)
        results.push({ id, success: res.success, message: res.message })
      } catch (err) {
        results.push({ id, success: false, message: err instanceof Error ? err.message : 'Failed' })
      }
    }

    setBatchResults(results)
    setBatchLoading(false)

    const successCount = results.filter(r => r.success).length
    if (successCount > 0) {
      addToast({ type: 'success', message: `Deleted ${successCount} image${successCount !== 1 ? 's' : ''}` })
      await handleFetch()
    }
    if (successCount < results.length) {
      addToast({ type: 'error', message: `${results.length - successCount} deletion${results.length - successCount !== 1 ? 's' : ''} failed`, duration: 5000 })
    }
    setSelectedImages(new Set())
  }, [selectedImages, batchLoading, addToast, handleFetch])

  // Summary counts
  const counts = useMemo(() => {
    const total = images.length
    const current = images.filter((i) => i.staleness === 'current').length
    const aging = images.filter((i) => i.staleness === 'aging').length
    const stale = images.filter((i) => i.staleness === 'stale').length
    return { total, current, aging, stale }
  }, [images])

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-4 md:p-6">
      <div className="flex flex-col gap-5 animate-in">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-white">Images</h1>
            <p className="text-sm text-slate-400 mt-1">
              Track Docker image freshness and staleness
            </p>
          </div>

          <div className="flex items-center gap-3">
          {/* Batch mode toggle */}
          <button
            onClick={handleToggleBatch}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border backdrop-blur-sm transition-all duration-200 ${
              batchMode
                ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]'
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            {batchMode ? 'Exit Batch' : 'Batch Mode'}
          </button>

          {/* Prune dangling images */}
          <button
            onClick={handlePrune}
            disabled={pruneLoading}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
              border backdrop-blur-sm transition-all duration-200
              ${
                pruneLoading
                  ? 'bg-rose-500/5 border-rose-500/10 text-rose-400/50 cursor-not-allowed'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/30 press'
              }
            `}
          >
            {pruneLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Prune All Dangling
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                transition-all duration-200
                ${
                  viewMode === 'table'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-slate-500 hover:text-slate-300'
                }
              `}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                transition-all duration-200
                ${
                  viewMode === 'cards'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-slate-500 hover:text-slate-300'
                }
              `}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </button>
          </div>
          </div>
        </div>

        {/* ---- Search bar ---- */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search images by repository, tag, or ID..."
            className="
              w-full pl-10 pr-4 py-2.5 rounded-xl text-sm
              bg-white/[0.04] border border-white/[0.08]
              text-slate-200 placeholder-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30
              transition-all duration-200
            "
          />
          {searchQuery && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
              {filteredImages.length} result{filteredImages.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ---- Batch action bar ---- */}
        {batchMode && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
            <span className="text-sm font-medium text-emerald-400">
              {selectedImages.size} selected
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={handleSelectAll} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition-all">
                Select All
              </button>
              <button onClick={handleClearSelection} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition-all">
                Clear
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedImages.size === 0 || batchLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/20 disabled:opacity-50 transition-all"
              >
                {batchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* ---- Summary stat cards ---- */}
        <div className="grid grid-cols-4 gap-3">
          <SummaryCard
            icon={<HardDrive className="h-4 w-4 text-cyan-400" />}
            label="Total Images"
            value={counts.total}
            color="cyan"
          />
          <SummaryCard
            icon={<CircleCheck className="h-4 w-4 text-emerald-400" />}
            label="Current"
            value={counts.current}
            color="emerald"
          />
          <SummaryCard
            icon={<Clock className="h-4 w-4 text-amber-400" />}
            label="Aging"
            value={counts.aging}
            color="amber"
          />
          <SummaryCard
            icon={<AlertTriangle className="h-4 w-4 text-rose-400" />}
            label="Stale"
            value={counts.stale}
            color="rose"
          />
        </div>

        {/* ---- Content ---- */}
        {viewMode === 'table' ? (
          <ImageList
            batchMode={batchMode}
            selectedImages={selectedImages}
            onToggleImage={handleToggleImage}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredImages.length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <HardDrive className="h-8 w-8 text-slate-600" />
                  <span className="text-sm text-slate-500">
                    {searchQuery ? 'No images match your search.' : 'No images found.'}
                  </span>
                </div>
              </div>
            ) : (
              filteredImages.map((image, idx) => (
                <ImageCard key={`${image.id}-${idx}`} image={image} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SummaryCard — small stat card for the summary row
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: number
  color: 'emerald' | 'cyan' | 'rose' | 'amber'
}

const GLOW_MAP: Record<string, string> = {
  emerald: 'glow-emerald',
  cyan: 'glow-cyan',
  rose: 'glow-rose',
  amber: 'glow-amber',
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, color }) => (
  <div className={`glass-subtle p-4 flex items-center gap-3 ${GLOW_MAP[color] ?? ''}`}>
    <div className="flex-shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  </div>
)

export default Images
