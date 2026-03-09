// =============================================================================
// Images — Image tracking page with table/card toggle and summary stats
// =============================================================================

import React, { useState, useCallback, useMemo } from 'react'
import { useImageStore } from '../stores/imageStore'
import { useApi } from '../hooks/useApi'
import { fetchImages, runImagePrune, deleteImage, searchImages, pullImage } from '../api/endpoints'
import { useToast } from '../components/common/Toast'
import { useConnectionStore } from '../stores/connectionStore'
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
  Download,
  Star,
  BadgeCheck,
  X,
  Globe,
  RefreshCw,
} from 'lucide-react'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import type { ImageSearchResult } from '../../shared/types'

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
  const isConnected = useConnectionStore((s) => s.status === 'connected')

  // Docker Hub search state
  const [activeTab, setActiveTab] = useState<'library' | 'search'>('library')
  const [hubSearchQuery, setHubSearchQuery] = useState('')
  const [hubSearchResults, setHubSearchResults] = useState<ImageSearchResult[]>([])
  const [hubSearchLoading, setHubSearchLoading] = useState(false)
  const [hubSearched, setHubSearched] = useState(false)
  const [pullingImages, setPullingImages] = useState<Set<string>>(new Set())

  // Fetch images via the connection-aware polling hook
  const handleFetch = useCallback(async () => {
    setLoading(true)
    const result = await fetchImages()
    setImages(result.images)
    setLoading(false)
    return result
  }, [setImages, setLoading])

  const { refresh } = useApi(handleFetch, IMAGE_POLL_INTERVAL, { enabled: isConnected })

  // Docker Hub search handler
  const handleHubSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!hubSearchQuery.trim() || hubSearchLoading) return
    setHubSearchLoading(true)
    setHubSearched(true)
    try {
      const res = await searchImages(hubSearchQuery.trim(), 25)
      setHubSearchResults(res.results)
    } catch {
      addToast({ type: 'error', message: 'Failed to search Docker Hub' })
      setHubSearchResults([])
    } finally {
      setHubSearchLoading(false)
    }
  }, [hubSearchQuery, hubSearchLoading, addToast])

  // Pull image handler
  const handlePullImage = useCallback(async (imageName: string) => {
    if (pullingImages.has(imageName)) return
    setPullingImages((prev) => new Set(prev).add(imageName))
    try {
      const res = await pullImage(imageName)
      if (res.success) {
        addToast({ type: 'success', message: `Pulling ${imageName} started` })
        // Refresh image list after a delay
        setTimeout(() => handleFetch(), 3000)
      } else {
        addToast({ type: 'error', message: res.message || `Failed to pull ${imageName}` })
      }
    } catch {
      addToast({ type: 'error', message: `Failed to pull ${imageName}` })
    } finally {
      setPullingImages((prev) => {
        const next = new Set(prev)
        next.delete(imageName)
        return next
      })
    }
  }, [pullingImages, addToast, handleFetch])

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
      <DisconnectedBanner />
      <div className="flex flex-col gap-5 animate-in">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-white">Images</h1>
            <p className="text-sm text-slate-400 mt-1">
              Track Docker image freshness and staleness
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {/* Refresh */}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

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

        {/* ---- Tab Toggle (Library / Docker Hub Search) ---- */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/[0.06] self-start">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all duration-200 ${
              activeTab === 'library'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            <HardDrive size={13} />
            Image Library
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all duration-200 ${
              activeTab === 'search'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            <Globe size={13} />
            Docker Hub Search
          </button>
        </div>

        {activeTab === 'library' && (
          <>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          </>
        )}

        {/* ---- Docker Hub Search Tab ---- */}
        {activeTab === 'search' && (
          <div className="space-y-4 animate-fade-in">
            {/* Search form */}
            <form onSubmit={handleHubSearch} className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={hubSearchQuery}
                  onChange={(e) => setHubSearchQuery(e.target.value)}
                  placeholder="Search Docker Hub for images (e.g. nginx, postgres, redis)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all duration-200"
                />
                {hubSearchQuery && (
                  <button
                    type="button"
                    onClick={() => { setHubSearchQuery(''); setHubSearchResults([]); setHubSearched(false) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={hubSearchLoading || !hubSearchQuery.trim() || !isConnected}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-all duration-200 disabled:opacity-50 press"
              >
                {hubSearchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Search
              </button>
            </form>

            {/* Loading */}
            {hubSearchLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-slate-600" />
              </div>
            )}

            {/* No results */}
            {!hubSearchLoading && hubSearched && hubSearchResults.length === 0 && (
              <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-12 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
                  <Search size={22} className="text-slate-600" />
                </div>
                <p className="text-sm text-slate-500">No images found for &quot;{hubSearchQuery}&quot;</p>
              </div>
            )}

            {/* Initial state */}
            {!hubSearchLoading && !hubSearched && (
              <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-12 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
                  <Globe size={22} className="text-cyan-500/60" />
                </div>
                <p className="text-sm text-slate-400">Search Docker Hub for container images</p>
                <p className="text-xs text-slate-600">Find official and community images to pull</p>
              </div>
            )}

            {/* Results */}
            {!hubSearchLoading && hubSearchResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-slate-500 mb-2">
                  {hubSearchResults.length} result{hubSearchResults.length !== 1 ? 's' : ''} for &quot;{hubSearchQuery}&quot;
                </div>
                {hubSearchResults.map((result, idx) => (
                  <div
                    key={`${result.name}-${idx}`}
                    className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.1] hover:bg-slate-900/80 transition-all duration-200 animate-fade-in"
                    style={{ animationDelay: `${Math.min(idx * 40, 400)}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-slate-200 truncate">{result.name}</span>
                          {result.official === '[OK]' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              <BadgeCheck size={10} />
                              Official
                            </span>
                          )}
                          {result.automated === '[OK]' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                              Auto
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {result.description || 'No description available'}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                            <Star size={10} />
                            {result.stars.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePullImage(result.name)}
                        disabled={pullingImages.has(result.name) || !isConnected}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all duration-200 disabled:opacity-50 press"
                      >
                        {pullingImages.has(result.name) ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Download size={13} />
                        )}
                        Pull
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
