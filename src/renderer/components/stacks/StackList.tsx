// =============================================================================
// StackList — Premium stack grid with create card, sorting, batch mode toggle
// =============================================================================

import { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, Layers, Filter, Plus, Play, Square, Download,
  ArrowUpDown, X, Loader2, AlertTriangle, Check, Sparkles,
  Trash2, ListChecks,
} from 'lucide-react'
import { useStackStore } from '../../stores/stackStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { usePluginStore } from '../../stores/pluginStore'
import { deleteStack, fetchStackCompose } from '../../api/endpoints'
import { lintCompose, isComposeLinterEnabled } from '../../hooks/useComposeLinter'
import type { LintDiagnostic } from '../../hooks/useComposeLinter'
import StackCard from './StackCard'

interface Props {
  onAction: (stackName: string, action: 'start' | 'stop' | 'restart' | 'update') => void
  onSelect: (stackName: string) => void
  onRefresh: () => void
  onEdit?: (stackName: string) => void
  onCreateStack?: () => void
  batchMode?: boolean
  selectedStacks?: Set<string>
  onToggleSelect?: (name: string) => void
  onToggleBatchMode?: () => void
  isAdmin?: boolean
}

type StatusFilter = 'all' | 'running' | 'stopped'
type SortMode = 'name' | 'status' | 'priority' | 'containers'

const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
}

export default function StackList({ onAction, onSelect, onRefresh, onEdit, onCreateStack, batchMode, selectedStacks, onToggleSelect, onToggleBatchMode, isAdmin }: Props) {
  const { stacks, actionLoading, loading } = useStackStore()
  const stackAnnotations = useSettingsStore((s) => s.stackAnnotations) ?? {}
  const linterPluginEnabled = usePluginStore((s) => { const p = s.plugins.find((pl) => pl.name === 'compose-linter'); return !p || p.enabled })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('priority')
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [lintAllLoading, setLintAllLoading] = useState(false)
  const [lintAllResults, setLintAllResults] = useState<{ name: string; diagnostics: LintDiagnostic[] }[] | null>(null)

  const sorted = useMemo(() => {
    const list = [...stacks]
    switch (sortMode) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'status':
        list.sort((a, b) => {
          if (a.status === b.status) return a.name.localeCompare(b.name)
          return a.status === 'running' ? -1 : 1
        })
        break
      case 'priority':
        list.sort((a, b) => {
          const ap = priorityOrder[stackAnnotations[a.name]?.priority ?? 'normal'] ?? 2
          const bp = priorityOrder[stackAnnotations[b.name]?.priority ?? 'normal'] ?? 2
          if (ap !== bp) return ap - bp
          if (a.status !== b.status) return a.status === 'running' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        break
      case 'containers':
        list.sort((a, b) => b.running_containers - a.running_containers)
        break
    }
    return list
  }, [stacks, sortMode, stackAnnotations])

  const filtered = useMemo(() => {
    return sorted.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        (stackAnnotations[s.name]?.label ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'running' && s.status === 'running') ||
        (statusFilter === 'stopped' && s.status === 'stopped')
      return matchesSearch && matchesStatus
    })
  }, [sorted, search, statusFilter, stackAnnotations])

  const runningCount = stacks.filter((s) => s.status === 'running').length
  const stoppedCount = stacks.filter((s) => s.status === 'stopped').length
  const criticalCount = stacks.filter((s) => stackAnnotations[s.name]?.priority === 'critical').length

  const handleLintAll = useCallback(async () => {
    if (lintAllLoading || stacks.length === 0 || !isComposeLinterEnabled()) return
    setLintAllLoading(true)
    const results: { name: string; diagnostics: LintDiagnostic[] }[] = []
    for (const stack of stacks) {
      try {
        const res = await fetchStackCompose(stack.name)
        const diagnostics = lintCompose(res.content)
        results.push({ name: stack.name, diagnostics })
      } catch {
        results.push({ name: stack.name, diagnostics: [] })
      }
    }
    setLintAllResults(results)
    setLintAllLoading(false)
  }, [lintAllLoading, stacks])

  const handleDelete = useCallback(async (name: string) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteStack(name)
      if (result.success) {
        setShowDeleteModal(null)
        onRefresh()
      } else {
        setDeleteError(result.message || 'Failed to delete stack')
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete stack')
    } finally {
      setDeleting(false)
    }
  }, [onRefresh])

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass p-6 max-w-sm w-full mx-4 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Delete Stack</h3>
                <p className="text-xs text-slate-400">
                  This will permanently remove the stack directory and all its files.
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Are you sure you want to delete{' '}
              <span className="font-mono text-rose-400">{showDeleteModal}</span>?
            </p>

            {deleteError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2">
                <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                <p className="text-xs text-rose-300">{deleteError}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowDeleteModal(null); setDeleteError(null) }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteModal)}
                disabled={deleting}
                className="
                  flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                  bg-rose-500/15 text-rose-400 border border-rose-500/25
                  hover:bg-rose-500/25 transition-all
                  disabled:opacity-50
                "
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Header with stats + actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <Layers className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Stack Manager</h2>
            <p className="text-xs text-slate-500">
              {stacks.length} total
              <span className="mx-1.5 text-slate-700">|</span>
              <span className="text-emerald-400">{runningCount} running</span>
              <span className="mx-1.5 text-slate-700">|</span>
              <span className="text-slate-400">{stoppedCount} stopped</span>
              {criticalCount > 0 && (
                <>
                  <span className="mx-1.5 text-slate-700">|</span>
                  <span className="text-rose-400">{criticalCount} critical</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2">
          {/* Quick actions: Start All / Stop All */}
          {!batchMode && stacks.length > 0 && (
            <>
              {stoppedCount > 0 && (
                <button
                  onClick={() => {
                    const stopped = stacks.filter((s) => s.status === 'stopped').map((s) => s.name)
                    stopped.forEach((name) => onAction(name, 'start'))
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                >
                  <Play size={13} />
                  Start All
                </button>
              )}
              {runningCount > 0 && (
                <button
                  onClick={() => {
                    const running = stacks.filter((s) => s.status === 'running').map((s) => s.name)
                    running.forEach((name) => onAction(name, 'stop'))
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                >
                  <Square size={13} />
                  Stop All
                </button>
              )}
            </>
          )}

          {/* Batch mode toggle */}
          {isAdmin && onToggleBatchMode && (
            <button
              onClick={onToggleBatchMode}
              className={`
                flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium
                border transition-all duration-200
                ${batchMode
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25 ring-1 ring-cyan-500/20'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200 hover:bg-white/10'}
              `}
            >
              <ListChecks size={15} />
              {batchMode ? 'Exit Batch' : 'Batch'}
            </button>
          )}

          {linterPluginEnabled && (
            <button
              onClick={handleLintAll}
              disabled={lintAllLoading || stacks.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 press"
            >
              {lintAllLoading ? <Loader2 size={15} className="animate-spin" /> : <ListChecks size={15} />}
              Lint All
            </button>
          )}

          {isAdmin && (
            <button
              onClick={onCreateStack}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all press"
            >
              <Plus size={14} />
              New Stack
            </button>
          )}
        </div>
      </div>

      {/* Search, filter, and sort bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-0 md:min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search stacks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg
              text-sm text-slate-200 placeholder-slate-500
              focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20
              transition-all duration-200
            "
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-lg">
          <Filter className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
          {(['all', 'running', 'stopped'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`
                px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                ${
                  statusFilter === f
                    ? f === 'running'
                      ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
                      : f === 'stopped'
                        ? 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25'
                        : 'bg-white/10 text-slate-200 ring-1 ring-white/15'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }
              `}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-lg">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
          {(['priority', 'name', 'status', 'containers'] as SortMode[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortMode(s)}
              className={`
                px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                ${
                  sortMode === s
                    ? 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/25'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }
              `}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Batch mode indicator */}
      {batchMode && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/15">
          <ListChecks size={14} className="text-cyan-400" />
          <span className="text-xs text-cyan-300 font-medium">
            Batch mode active — click cards to select, then use the action bar below
          </span>
          {selectedStacks && selectedStacks.size > 0 && (
            <span className="ml-auto text-xs text-cyan-400/70">
              {selectedStacks.size} selected
            </span>
          )}
        </div>
      )}

      {/* Stack grid */}
      {loading && stacks.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-800/40 rounded-xl h-[200px] border border-white/[0.03]" />
          ))}
        </div>
      ) : filtered.length > 0 || stacks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
          {filtered.map((stack) => (
            <StackCard
              key={stack.name}
              stack={stack}
              isActionLoading={actionLoading === stack.name}
              onAction={onAction}
              onSelect={onSelect}
              onEdit={isAdmin ? onEdit : undefined}
              onDelete={isAdmin ? (name) => setShowDeleteModal(name) : undefined}
              batchMode={batchMode}
              isSelected={selectedStacks?.has(stack.name)}
              onToggleSelect={onToggleSelect}
              isAdmin={isAdmin}
            />
          ))}

          {/* Create Stack Card — always at the end (hidden in batch mode and for non-admins) */}
          {isAdmin && !batchMode && (
            <button
              onClick={onCreateStack}
              className="
                group relative flex flex-col items-center justify-center
                min-h-[200px] rounded-xl border border-dashed
                border-white/10 hover:border-emerald-500/30
                bg-white/[0.02] hover:bg-emerald-500/[0.04]
                transition-all duration-300 cursor-pointer
              "
            >
              <div className="
                flex items-center justify-center w-12 h-12 rounded-xl
                bg-white/5 group-hover:bg-emerald-500/15
                border border-white/5 group-hover:border-emerald-500/20
                transition-all duration-300 mb-3
              ">
                <Plus className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors duration-300" />
              </div>
              <span className="text-sm font-medium text-slate-400 group-hover:text-emerald-400 transition-colors duration-300">
                Create New Stack
              </span>
              <span className="text-[10px] text-slate-500 group-hover:text-slate-400 mt-1 transition-colors">
                Add a new service category
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="glass-subtle flex flex-col items-center justify-center py-16 rounded-xl">
          <Layers className="w-10 h-10 text-slate-500 mb-3" />
          <p className="text-sm text-slate-500">
            {search || statusFilter !== 'all'
              ? 'No stacks match your filters'
              : 'No stacks found'}
          </p>
          {(search || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
              }}
              className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Bottom spacer when batch mode is active to avoid floating bar overlap */}
      {batchMode && selectedStacks && selectedStacks.size > 0 && (
        <div className="h-20" />
      )}

      {/* Lint All Results Modal */}
      {lintAllResults && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setLintAllResults(null)}>
          <div className="glass rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin border border-white/10 animate-scale-in gradient-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                  <ListChecks size={18} className="text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Compose Lint Results</h3>
                  <p className="text-[10px] text-slate-500">{stacks.length} stacks analyzed</p>
                </div>
              </div>
              <button onClick={() => setLintAllResults(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400">
                <X size={16} />
              </button>
            </div>
            {/* Summary */}
            <div className="flex items-center gap-4 mb-4 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
              <span className="flex items-center gap-1 text-[11px] font-medium text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {lintAllResults.reduce((sum, r) => sum + r.diagnostics.filter(d => d.severity === 'error').length, 0)} errors
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {lintAllResults.reduce((sum, r) => sum + r.diagnostics.filter(d => d.severity === 'warning').length, 0)} warnings
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                {lintAllResults.reduce((sum, r) => sum + r.diagnostics.filter(d => d.severity === 'info').length, 0)} info
              </span>
            </div>
            {/* Per-stack results */}
            <div className="space-y-2">
              {lintAllResults.map((result) => {
                const errors = result.diagnostics.filter(d => d.severity === 'error').length
                const warnings = result.diagnostics.filter(d => d.severity === 'warning').length
                const infos = result.diagnostics.filter(d => d.severity === 'info').length
                return (
                  <div key={result.name} className={`rounded-xl border p-3 ${errors > 0 ? 'border-rose-500/15 bg-rose-500/[0.03]' : warnings > 0 ? 'border-amber-500/10 bg-amber-500/[0.02]' : 'border-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-200">{result.name}</span>
                      <div className="flex items-center gap-2">
                        {errors > 0 && <span className="text-[10px] font-medium text-rose-400">{errors}E</span>}
                        {warnings > 0 && <span className="text-[10px] font-medium text-amber-400">{warnings}W</span>}
                        {infos > 0 && <span className="text-[10px] font-medium text-cyan-400">{infos}I</span>}
                        {result.diagnostics.length === 0 && <span className="text-[10px] font-medium text-emerald-400">Clean</span>}
                      </div>
                    </div>
                    {result.diagnostics.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {result.diagnostics.slice(0, 5).map((d) => (
                          <div key={`${d.line}-${d.message}`} className="flex items-start gap-2 text-[10px]">
                            <span className={`shrink-0 mt-0.5 ${d.severity === 'error' ? 'text-rose-400' : d.severity === 'warning' ? 'text-amber-400' : 'text-cyan-400'}`}>
                              {d.severity === 'error' ? '\u25cf' : d.severity === 'warning' ? '\u25b2' : '\u2139'}
                            </span>
                            <span className="text-slate-500 tabular-nums shrink-0">L{d.line}</span>
                            <span className="text-slate-400">{d.message}</span>
                          </div>
                        ))}
                        {result.diagnostics.length > 5 && <p className="text-[9px] text-slate-500 ml-4">+{result.diagnostics.length - 5} more</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
