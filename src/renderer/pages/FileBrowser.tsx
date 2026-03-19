// =============================================================================
// FileBrowser — Container File Browser for exploring filesystem inside
//               running Docker containers via the DCS REST API
// =============================================================================

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  FolderOpen, FileText, Link, Folder, ChevronRight,
  Loader2, WifiOff, AlertTriangle, X, ArrowUp,
  RefreshCw, Search, Box,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useConnectionStore } from '../stores/connectionStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useToast } from '../components/common/Toast'
import {
  fetchContainers,
  fetchContainerFiles,
  fetchContainerFileContent,
} from '../api/endpoints'
import type {
  ContainerFilesResponse,
  ContainerFileContentResponse,
  ContainerInfo,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileEntry {
  name: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  permissions: string
  modified: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format bytes into a human-readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/** Split a path into breadcrumb segments */
function pathSegments(path: string): { name: string; fullPath: string }[] {
  const parts = path.split('/').filter(Boolean)
  const segments: { name: string; fullPath: string }[] = [
    { name: '/', fullPath: '/' },
  ]
  for (let i = 0; i < parts.length; i++) {
    segments.push({
      name: parts[i],
      fullPath: '/' + parts.slice(0, i + 1).join('/'),
    })
  }
  return segments
}

/** Sort entries: directories first, then files, alphabetically within each group */
function sortEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (a.type !== 'directory' && b.type === 'directory') return 1
    return a.name.localeCompare(b.name)
  })
}

// ---------------------------------------------------------------------------
// File Content Viewer Modal
// ---------------------------------------------------------------------------

interface FileViewerProps {
  filePath: string
  content: string
  size: number
  onClose: () => void
}

function FileViewer({ filePath, content, size, onClose }: FileViewerProps) {
  const isEmpty = !content || content.length === 0
  const isTooLarge = size > 1024 * 1024 // 1 MB

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-6xl bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 flex flex-col animate-scale-in overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-200 truncate">{filePath}</h3>
              <p className="text-[10px] text-slate-500">{formatBytes(size)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-0">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileText size={28} className="text-slate-600" />
              <p className="text-sm text-slate-500">File is empty or binary content cannot be displayed</p>
            </div>
          )}
          {!isEmpty && isTooLarge && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertTriangle size={28} className="text-amber-500/60" />
              <p className="text-sm text-slate-500">File content is too large to display ({formatBytes(size)})</p>
              <p className="text-xs text-slate-600">Only the retrieved portion is shown below</p>
            </div>
          )}
          {!isEmpty && (
            <pre className="p-4 md:p-6 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap break-all bg-slate-950/50 min-h-[200px] overflow-auto scrollbar-thin">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Main File Browser Page
// ---------------------------------------------------------------------------

export default function FileBrowser() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [containersLoading, setContainersLoading] = useState(false)

  const [selectedContainer, setSelectedContainer] = useState<string>('')
  const [currentPath, setCurrentPath] = useState<string>('/')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [fileContent, setFileContent] = useState<{
    path: string
    content: string
    size: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Fetch running containers
  // -------------------------------------------------------------------------

  const loadContainers = useCallback(async () => {
    if (!isConnected) return
    setContainersLoading(true)
    try {
      const data = await fetchContainers()
      setContainers(
        (data.containers ?? []).filter((c) => c.state === 'running'),
      )
    } catch {
      // Silently fail — the user will see no containers
    } finally {
      setContainersLoading(false)
    }
  }, [isConnected])

  useEffect(() => {
    loadContainers()
  }, [loadContainers])

  // -------------------------------------------------------------------------
  // Fetch directory listing
  // -------------------------------------------------------------------------

  const loadDirectory = useCallback(async () => {
    if (!selectedContainer || !isConnected) return
    setLoading(true)
    setError(null)
    try {
      const data: ContainerFilesResponse = await fetchContainerFiles(
        selectedContainer,
        currentPath,
      )
      setEntries(data.entries ?? [])
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to list directory'
      // Detect common docker exec errors
      if (msg.includes('exit code 125') || msg.includes('permission denied')) {
        setError(
          'Permission denied or container does not support file browsing. The container may lack the required binaries (ls, stat).',
        )
      } else {
        setError(msg)
      }
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [selectedContainer, currentPath, isConnected])

  useEffect(() => {
    loadDirectory()
  }, [loadDirectory])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleContainerChange = useCallback(
    (name: string) => {
      setSelectedContainer(name)
      setCurrentPath('/')
      setEntries([])
      setFileContent(null)
      setError(null)
    },
    [],
  )

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path)
    setFileContent(null)
    setError(null)
  }, [])

  const navigateUp = useCallback(() => {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    navigateTo(parts.length === 0 ? '/' : '/' + parts.join('/'))
  }, [currentPath, navigateTo])

  const handleEntryClick = useCallback(
    async (entry: FileEntry) => {
      if (entry.type === 'directory') {
        const newPath =
          currentPath === '/'
            ? `/${entry.name}`
            : `${currentPath}/${entry.name}`
        navigateTo(newPath)
        return
      }

      // It's a file (or symlink) — fetch content
      setLoading(true)
      try {
        const filePath =
          currentPath === '/'
            ? `/${entry.name}`
            : `${currentPath}/${entry.name}`
        const data: ContainerFileContentResponse =
          await fetchContainerFileContent(selectedContainer, filePath)
        setFileContent({
          path: data.path,
          content: data.content,
          size: data.size,
        })
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Failed to read file'
        addToast({ type: 'error', message: msg })
      } finally {
        setLoading(false)
      }
    },
    [currentPath, selectedContainer, addToast, navigateTo],
  )

  const handleRefresh = useCallback(() => {
    loadDirectory()
  }, [loadDirectory])

  // Close file viewer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (fileContent) { setFileContent(null); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [fileContent])

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const sortedEntries = useMemo(() => sortEntries(entries), [entries])
  const breadcrumbs = useMemo(() => pathSegments(currentPath), [currentPath])

  // -------------------------------------------------------------------------
  // Disconnected state
  // -------------------------------------------------------------------------

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
          <WifiOff size={24} className="text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">
          Connect to a server to browse container files
        </p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* ----------------------------------------------------------------- */}
      {/* Page header                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 flex items-center justify-center text-cyan-400">
            <FolderOpen size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold"><span className="text-gradient">File Browser</span></h2>
            <p className="text-xs text-slate-500">
              Browse files inside running containers
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading || !selectedContainer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-all duration-200 disabled:opacity-50 press"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Warning note                                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-amber-500/[0.06] border border-amber-500/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle size={14} className="text-amber-500/70 mt-0.5 shrink-0" />
        <p className="text-[11px] text-amber-400/80 leading-relaxed">
          Commands run as the container's default user. Some containers may not
          support file browsing.
        </p>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Container selector                                                 */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-4">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 block font-semibold">
          Select Container
        </label>
        <div className="relative">
          <Box size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select
            value={selectedContainer}
            onChange={(e) => handleContainerChange(e.target.value)}
            disabled={containersLoading}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200 focus:outline-none focus:border-cyan-500/30 focus:bg-white/[0.05] transition-colors appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-slate-400">
              {containersLoading
                ? 'Loading containers...'
                : containers.length === 0
                  ? 'No running containers'
                  : '-- Choose a container --'}
            </option>
            {containers.map((c) => (
              <option
                key={c.name}
                value={c.name}
                className="bg-slate-900 text-slate-200"
              >
                {c.name}
              </option>
            ))}
          </select>
          {/* Custom dropdown chevron */}
          <ChevronRight
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none rotate-90"
          />
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Empty state — no container selected                                */}
      {/* ----------------------------------------------------------------- */}
      {!selectedContainer && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center">
            <Search size={22} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500 text-center max-w-sm">
            Select a running container above to browse its filesystem.
          </p>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Breadcrumb path bar                                                */}
      {/* ----------------------------------------------------------------- */}
      {selectedContainer && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl px-4 py-3">
          <div className="flex items-center gap-1 flex-wrap text-xs">
            <FolderOpen size={14} className="text-cyan-400 shrink-0 mr-1" />
            {breadcrumbs.map((seg, i) => (
              <span key={seg.fullPath} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight size={12} className="text-slate-600" />
                )}
                <button
                  onClick={() => navigateTo(seg.fullPath)}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    i === breadcrumbs.length - 1
                      ? 'text-slate-200 font-medium bg-white/[0.06]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  {seg.name}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Loading state                                                      */}
      {/* ----------------------------------------------------------------- */}
      {selectedContainer && loading && entries.length === 0 && !error && (
        <div className="flex items-center justify-center py-16 animate-fade-in">
          <Loader2 size={24} className="animate-spin text-slate-600" />
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Error state                                                        */}
      {/* ----------------------------------------------------------------- */}
      {selectedContainer && error && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-rose-500/15 rounded-xl p-6 text-center animate-fade-in">
          <AlertTriangle size={28} className="text-rose-500/40 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-1">
            Failed to browse files
          </p>
          <p className="text-xs text-slate-600 mb-4 max-w-md mx-auto">
            {error}
          </p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Directory listing table                                            */}
      {/* ----------------------------------------------------------------- */}
      {selectedContainer && !error && (entries.length > 0 || (!loading && entries.length === 0 && currentPath !== '/')) && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <span className="w-5" />
            <span>Name</span>
            <span className="w-20 text-right">Size</span>
            <span className="w-24 text-center">Permissions</span>
            <span className="w-32 text-right">Modified</span>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {/* Parent directory (..) */}
            {currentPath !== '/' && (
              <button
                onClick={navigateUp}
                className="w-full grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors group"
              >
                <ArrowUp
                  size={16}
                  className="text-slate-500 group-hover:text-slate-300 transition-colors mt-0.5"
                />
                <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors font-medium">
                  ..
                </span>
                <span className="hidden sm:block w-20" />
                <span className="hidden sm:block w-24" />
                <span className="hidden sm:block w-32" />
              </button>
            )}

            {/* File/directory rows */}
            {sortedEntries.map((entry) => (
              <button
                key={entry.name}
                onClick={() => handleEntryClick(entry)}
                className="w-full grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors group"
              >
                {/* Icon */}
                <span className="mt-0.5">
                  {entry.type === 'directory' ? (
                    <Folder
                      size={16}
                      className="text-amber-400/80 group-hover:text-amber-400 transition-colors"
                    />
                  ) : entry.type === 'symlink' ? (
                    <Link
                      size={16}
                      className="text-violet-400/80 group-hover:text-violet-400 transition-colors"
                    />
                  ) : (
                    <FileText
                      size={16}
                      className="text-slate-500 group-hover:text-slate-300 transition-colors"
                    />
                  )}
                </span>

                {/* Name */}
                <span
                  className={`text-xs truncate transition-colors ${
                    entry.type === 'directory'
                      ? 'text-cyan-400 group-hover:text-cyan-300 font-medium'
                      : entry.type === 'symlink'
                        ? 'text-violet-400 group-hover:text-violet-300'
                        : 'text-slate-300 group-hover:text-slate-100'
                  }`}
                >
                  {entry.name}
                  {entry.type === 'directory' && '/'}
                </span>

                {/* Size */}
                <span className="hidden sm:block w-20 text-right text-[11px] text-slate-500 tabular-nums">
                  {entry.type === 'directory' ? '--' : formatBytes(entry.size)}
                </span>

                {/* Permissions */}
                <span className="hidden sm:block w-24 text-center">
                  <code className="text-[10px] text-slate-600 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">
                    {entry.permissions}
                  </code>
                </span>

                {/* Modified */}
                <span className="hidden sm:block w-32 text-right text-[11px] text-slate-500">
                  {entry.modified || '--'}
                </span>
              </button>
            ))}
          </div>

          {/* Empty directory */}
          {sortedEntries.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FolderOpen size={24} className="text-slate-600" />
              <p className="text-xs text-slate-500">Directory is empty</p>
            </div>
          )}

          {/* Loading indicator for subsequent fetches */}
          {loading && entries.length > 0 && (
            <div className="flex items-center justify-center py-4 border-t border-white/[0.04]">
              <Loader2 size={16} className="animate-spin text-slate-600" />
              <span className="text-xs text-slate-500 ml-2">Loading...</span>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Empty directory at root (first load, no entries, no error)         */}
      {/* ----------------------------------------------------------------- */}
      {selectedContainer &&
        !error &&
        !loading &&
        entries.length === 0 &&
        currentPath === '/' && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FolderOpen size={24} className="text-slate-600" />
              <p className="text-xs text-slate-500">
                No entries found at root. The container may not support file
                listing.
              </p>
            </div>
          </div>
        )}

      {/* ----------------------------------------------------------------- */}
      {/* File content viewer modal                                          */}
      {/* ----------------------------------------------------------------- */}
      {fileContent && (
        <FileViewer
          filePath={fileContent.path}
          content={fileContent.content}
          size={fileContent.size}
          onClose={() => setFileContent(null)}
        />
      )}
    </div>
  )
}
