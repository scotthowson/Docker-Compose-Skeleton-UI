// =============================================================================
// ImageList — Image table with filtering tabs and sortable columns
// =============================================================================

import React, { useState, useMemo } from 'react'
import { ImageInfo } from '../../../shared/types'
import { useImageStore } from '../../stores/imageStore'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  HardDrive,
  Tag,
  Database,
  Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortKey = keyof ImageInfo
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  key: SortKey
  direction: SortDirection
}

function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  const mult = direction === 'asc' ? 1 : -1

  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * mult
  }

  const strA = String(a ?? '').toLowerCase()
  const strB = String(b ?? '').toLowerCase()
  return strA.localeCompare(strB) * mult
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'current' | 'aging' | 'stale'

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'current', label: 'Current' },
  { key: 'aging', label: 'Aging' },
  { key: 'stale', label: 'Stale' },
]

const TAB_COLORS: Record<FilterTab, string> = {
  all: 'text-cyan-400 border-cyan-400',
  current: 'text-emerald-400 border-emerald-400',
  aging: 'text-amber-400 border-amber-400',
  stale: 'text-rose-400 border-rose-400',
}

// ---------------------------------------------------------------------------
// Staleness badge styles
// ---------------------------------------------------------------------------

interface StalenessStyle {
  bg: string
  text: string
  ring: string
  dot: string
}

const STALENESS_STYLES: Record<string, StalenessStyle> = {
  current: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  aging: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-400',
  },
  stale: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    ring: 'ring-rose-500/20',
    dot: 'bg-rose-400',
  },
  unknown: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    ring: 'ring-slate-500/20',
    dot: 'bg-slate-400',
  },
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: SortKey
  label: string
  align?: 'left' | 'center' | 'right'
}

const COLUMNS: ColumnDef[] = [
  { key: 'repository', label: 'Repository' },
  { key: 'tag', label: 'Tag' },
  { key: 'id', label: 'ID' },
  { key: 'created', label: 'Created' },
  { key: 'size', label: 'Size' },
  { key: 'age_days', label: 'Age (days)', align: 'center' },
  { key: 'staleness', label: 'Staleness', align: 'center' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ImageListProps {
  batchMode?: boolean
  selectedImages?: Set<string>
  onToggleImage?: (id: string) => void
}

const ImageList: React.FC<ImageListProps> = ({ batchMode = false, selectedImages, onToggleImage }) => {
  const images = useImageStore((s) => s.images)
  const loading = useImageStore((s) => s.loading)

  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [sort, setSort] = useState<SortConfig>({ key: 'repository', direction: 'asc' })

  // Filter by staleness tab
  const filtered = useMemo(() => {
    if (activeTab === 'all') return images
    return images.filter((img) => img.staleness === activeTab)
  }, [images, activeTab])

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      compareValues(a[sort.key], b[sort.key], sort.direction),
    )
  }, [filtered, sort])

  // Tab counts
  const tabCounts: Record<FilterTab, number> = useMemo(
    () => ({
      all: images.length,
      current: images.filter((i) => i.staleness === 'current').length,
      aging: images.filter((i) => i.staleness === 'aging').length,
      stale: images.filter((i) => i.staleness === 'stale').length,
    }),
    [images],
  )

  // Toggle sort column
  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  // Sort indicator
  const SortIcon: React.FC<{ columnKey: SortKey }> = ({ columnKey }) => {
    if (sort.key !== columnKey) {
      return <ChevronsUpDown className="h-3 w-3 text-slate-500" />
    }
    return sort.direction === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-emerald-400" />
    ) : (
      <ChevronDown className="h-3 w-3 text-emerald-400" />
    )
  }

  /** Truncate image ID for display. */
  const shortId = (id: string): string => (id.length > 19 ? id.slice(0, 19) : id)

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Filter tabs ---- */}
      <div className="flex items-center gap-1 border-b border-white/5 select-none">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                px-4 py-2.5 text-sm font-medium transition-all duration-200
                border-b-2 -mb-[1px]
                ${
                  isActive
                    ? TAB_COLORS[tab.key]
                    : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-700'
                }
              `}
            >
              {tab.label}
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/10' : 'bg-white/5'
                }`}
              >
                {tabCounts[tab.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* ---- Table ---- */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {batchMode && (
                  <th className="px-4 py-3 w-10"></th>
                )}
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`
                      px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400
                      cursor-pointer select-none hover:text-slate-200 transition-colors
                      ${col.align === 'center' ? 'text-center' : 'text-left'}
                    `}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <SortIcon columnKey={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && images.length === 0 ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={COLUMNS.length + (batchMode ? 1 : 0)} className="py-1.5 px-3">
                        <div className="animate-pulse bg-slate-800/40 rounded-lg h-10 border border-white/[0.03]" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + (batchMode ? 1 : 0)} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <HardDrive className="h-8 w-8 text-slate-500" />
                      <span className="text-sm text-slate-500">
                        {activeTab !== 'all'
                          ? `No ${activeTab} images found.`
                          : 'No images found.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((image, idx) => {
                  const ss =
                    STALENESS_STYLES[image.staleness] ?? STALENESS_STYLES.unknown

                  return (
                    <tr
                      key={`${image.id}-${idx}`}
                      onClick={() => batchMode && onToggleImage?.(image.id)}
                      className={`group border-b border-white/[0.03] hover:bg-white/5 transition-colors ${
                        batchMode ? 'cursor-pointer' : ''
                      } ${batchMode && selectedImages?.has(image.id) ? 'bg-emerald-500/[0.06]' : ''}`}
                    >
                      {/* Batch checkbox */}
                      {batchMode && (
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleImage?.(image.id) }}
                            className={`flex items-center justify-center w-5 h-5 rounded border transition-all ${
                              selectedImages?.has(image.id)
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'bg-white/5 border-white/20 hover:border-white/40'
                            }`}
                          >
                            {selectedImages?.has(image.id) && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </td>
                      )}

                      {/* Repository */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                          <span
                            className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors truncate max-w-[240px]"
                            title={image.repository}
                          >
                            {image.repository}
                          </span>
                        </div>
                      </td>

                      {/* Tag */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                          <Tag className="h-3 w-3" />
                          {image.tag}
                        </span>
                      </td>

                      {/* ID */}
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-slate-500" title={image.id}>
                          {shortId(image.id)}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-400">{image.created}</span>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-400">{image.size}</span>
                      </td>

                      {/* Age (days) */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-medium ${
                            image.age_days > 90
                              ? 'text-rose-400'
                              : image.age_days > 30
                              ? 'text-amber-400'
                              : 'text-slate-300'
                          }`}
                        >
                          <span className="tabular-nums">{image.age_days}</span>
                        </span>
                      </td>

                      {/* Staleness */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${ss.bg} ${ss.text} ${ss.ring}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                          {image.staleness}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ImageList
