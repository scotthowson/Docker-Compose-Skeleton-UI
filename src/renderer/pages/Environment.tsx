// =============================================================================
// Environment — Root & per-stack .env editor with table view, validation, save
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import {
  FileCode, Save, CheckCircle, AlertTriangle, RefreshCw,
  ChevronDown, Eye, Pencil,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useToast } from '../components/common/Toast'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import {
  fetchRootEnv, saveRootEnv, validateEnv,
  fetchStacks, fetchStackEnv, saveStackEnv,
} from '../api/endpoints'
import type {
  RootEnvResponse, StackEnvResponse, StackListResponse,
  EnvValidateResponse,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Keys whose values should be masked in the table view */
const SENSITIVE_PATTERNS = [
  'PASSWORD', 'SECRET', 'TOKEN', 'KEY', 'CREDENTIAL', 'AUTH',
]

function isSensitive(key: string): boolean {
  const upper = key.toUpperCase()
  return SENSITIVE_PATTERNS.some((p) => upper.includes(p))
}

function maskValue(value: string): string {
  if (value.length <= 4) return '*'.repeat(value.length)
  return value.slice(0, 2) + '*'.repeat(Math.min(value.length - 4, 16)) + value.slice(-2)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'root' | 'stack'
type ViewMode = 'table' | 'raw'

// ---------------------------------------------------------------------------
// Env Table (parsed key-value view)
// ---------------------------------------------------------------------------

function EnvTable({
  variables,
}: {
  variables: { key: string; value: string; line: number; comment: string }[]
}) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (variables.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-slate-500 italic">No variables found</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-right px-4 py-2.5 text-[10px] font-medium text-slate-500 uppercase tracking-wider w-14">
              Line
            </th>
            <th className="text-left px-4 py-2.5 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              Key
            </th>
            <th className="text-left px-4 py-2.5 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              Value
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.03]">
          {variables.map((v) => {
            const sensitive = isSensitive(v.key)
            const isRevealed = revealed.has(v.key)
            const displayValue = sensitive && !isRevealed ? maskValue(v.value) : v.value

            return (
              <tr
                key={`${v.line}-${v.key}`}
                className="group hover:bg-white/[0.03] transition-colors duration-100"
              >
                <td className="text-right px-4 py-2 text-xs text-slate-500 font-mono tabular-nums">
                  {v.line}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-cyan-400 whitespace-nowrap">
                  {v.key}
                  {v.comment && (
                    <span className="ml-2 text-slate-500 italic text-[10px] font-sans">
                      {v.comment}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs break-all ${
                        sensitive && !isRevealed ? 'text-slate-500' : 'text-emerald-400'
                      }`}
                    >
                      {displayValue || <span className="text-slate-500 italic">(empty)</span>}
                    </span>
                    {sensitive && (
                      <button
                        onClick={() => toggleReveal(v.key)}
                        className="shrink-0 p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                        title={isRevealed ? 'Hide value' : 'Reveal value'}
                      >
                        <Eye size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Raw Editor (textarea with line numbers gutter)
// ---------------------------------------------------------------------------

function RawEditor({
  value,
  onChange,
  readOnly,
}: {
  value: string
  onChange: (v: string) => void
  readOnly?: boolean
}) {
  const lines = value.split('\n')
  const lineCount = lines.length

  return (
    <div className="relative flex rounded-lg border border-white/5 bg-slate-900/50 overflow-hidden focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
      {/* Line numbers gutter */}
      <div
        className="shrink-0 select-none py-3 pr-2 text-right border-r border-white/5 bg-slate-950/30"
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i}
            className="px-3 text-[11px] leading-[1.625rem] text-slate-500 font-mono tabular-nums"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        className="
          flex-1 resize-none py-3 px-4
          bg-transparent text-sm text-slate-200
          font-mono leading-[1.625rem]
          placeholder-slate-600
          focus:outline-none
          scrollbar-thin
        "
        style={{ minHeight: `${Math.max(lineCount, 8) * 26 + 24}px` }}
        placeholder="# Enter environment variables (KEY=VALUE)"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Validation Results
// ---------------------------------------------------------------------------

function ValidationResults({ result }: { result: EnvValidateResponse }) {
  if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 animate-fade-in">
        <CheckCircle size={16} className="text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300">Configuration is valid — no issues found</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 animate-fade-in">
      {result.errors.map((err, i) => (
        <div
          key={`err-${i}`}
          className="flex items-start gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-2.5"
        >
          <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            {err.line > 0 && (
              <span className="text-[10px] font-mono text-rose-500 mr-2">Line {err.line}</span>
            )}
            <span className="text-sm text-rose-400">{err.message}</span>
          </div>
        </div>
      ))}
      {result.warnings.map((warn, i) => (
        <div
          key={`warn-${i}`}
          className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2.5"
        >
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            {warn.line > 0 && (
              <span className="text-[10px] font-mono text-amber-500 mr-2">Line {warn.line}</span>
            )}
            <span className="text-sm text-amber-400">{warn.message}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Environment() {
  const isConnected = useConnectionStore((s) => s.status) === 'connected'
  const { addToast } = useToast()

  // Tabs
  const [activeTab, setActiveTab] = useState<TabId>('root')
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // ---- Root .env state ----
  const [rootRaw, setRootRaw] = useState('')
  const [rootOriginal, setRootOriginal] = useState('')
  const [rootSaving, setRootSaving] = useState(false)
  const [rootValidating, setRootValidating] = useState(false)
  const [rootValidation, setRootValidation] = useState<EnvValidateResponse | null>(null)

  const {
    data: rootEnvData,
    loading: rootLoading,
    refresh: refreshRoot,
  } = usePolling<RootEnvResponse>(fetchRootEnv, 60000, {
    enabled: isConnected && activeTab === 'root',
  })

  useEffect(() => {
    if (rootEnvData) {
      setRootRaw(rootEnvData.raw)
      setRootOriginal(rootEnvData.raw)
      setRootValidation(null)
    }
  }, [rootEnvData])

  const rootHasChanges = rootRaw !== rootOriginal

  const handleRootValidate = useCallback(async () => {
    setRootValidating(true)
    try {
      const result = await validateEnv(rootRaw)
      setRootValidation(result)
    } catch (err) {
      addToast({
        type: 'error',
        message: `Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    } finally {
      setRootValidating(false)
    }
  }, [rootRaw, addToast])

  const handleRootSave = useCallback(async () => {
    setRootSaving(true)
    try {
      const result = await saveRootEnv(rootRaw)
      if (result.success) {
        setRootOriginal(rootRaw)
        setRootValidation(null)
        addToast({ type: 'success', message: 'Root .env saved successfully (backup created)' })
        setTimeout(refreshRoot, 500)
      } else {
        addToast({ type: 'error', message: result.message || 'Failed to save' })
      }
    } catch (err) {
      addToast({
        type: 'error',
        message: `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    } finally {
      setRootSaving(false)
    }
  }, [rootRaw, addToast, refreshRoot])

  // ---- Stack .env state ----
  const [selectedStack, setSelectedStack] = useState('')
  const [stackRaw, setStackRaw] = useState('')
  const [stackOriginal, setStackOriginal] = useState('')
  const [stackSaving, setStackSaving] = useState(false)
  const [stackEnvData, setStackEnvData] = useState<StackEnvResponse | null>(null)
  const [stackEnvLoading, setStackEnvLoading] = useState(false)
  const [stackEnvEmpty, setStackEnvEmpty] = useState(false)
  const [stackViewMode, setStackViewMode] = useState<ViewMode>('table')

  const {
    data: stacksData,
    loading: stacksLoading,
  } = usePolling<StackListResponse>(fetchStacks, 60000, {
    enabled: isConnected && activeTab === 'stack',
  })

  const stacks = stacksData?.stacks ?? []

  // Fetch stack env when selection changes
  useEffect(() => {
    if (!selectedStack) {
      setStackEnvData(null)
      setStackRaw('')
      setStackOriginal('')
      setStackEnvEmpty(false)
      return
    }

    let mounted = true
    setStackEnvLoading(true)
    setStackEnvEmpty(false)

    fetchStackEnv(selectedStack)
      .then((data) => {
        if (!mounted) return
        setStackEnvData(data)
        setStackRaw(data.raw)
        setStackOriginal(data.raw)
        setStackEnvEmpty(!data.raw && data.variables.length === 0)
      })
      .catch(() => {
        if (!mounted) return
        setStackEnvData(null)
        setStackRaw('')
        setStackOriginal('')
        setStackEnvEmpty(true)
      })
      .finally(() => {
        if (mounted) setStackEnvLoading(false)
      })

    return () => { mounted = false }
  }, [selectedStack])

  const stackHasChanges = stackRaw !== stackOriginal

  const handleStackSave = useCallback(async () => {
    if (!selectedStack) return
    setStackSaving(true)
    try {
      const result = await saveStackEnv(selectedStack, stackRaw)
      if (result.success) {
        setStackOriginal(stackRaw)
        addToast({ type: 'success', message: `${selectedStack} .env saved successfully` })
      } else {
        addToast({ type: 'error', message: result.message || 'Failed to save' })
      }
    } catch (err) {
      addToast({
        type: 'error',
        message: `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    } finally {
      setStackSaving(false)
    }
  }, [selectedStack, stackRaw, addToast])

  // ---- Tab definitions ----
  const tabs: { id: TabId; label: string }[] = [
    { id: 'root', label: 'Root .env' },
    { id: 'stack', label: 'Stack .env' },
  ]

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/5">
            <FileCode size={24} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold"><span className="text-gradient">Environment Variables</span></h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage root and per-stack .env configuration</p>
          </div>
        </div>
        <button
          onClick={activeTab === 'root' ? refreshRoot : () => {
            if (selectedStack) {
              setStackEnvLoading(true)
              fetchStackEnv(selectedStack)
                .then((data) => {
                  setStackEnvData(data)
                  setStackRaw(data.raw)
                  setStackOriginal(data.raw)
                })
                .finally(() => setStackEnvLoading(false))
            }
          }}
          disabled={(activeTab === 'root' && rootLoading) || (activeTab === 'stack' && stackEnvLoading)}
          className="
            flex items-center gap-2 rounded-lg px-3.5 py-2
            text-sm font-medium text-slate-300
            bg-white/5 border border-white/10
            hover:bg-white/10 hover:border-white/15
            disabled:opacity-50 transition-all duration-200
          "
        >
          <RefreshCw
            size={15}
            className={(activeTab === 'root' && rootLoading) || (activeTab === 'stack' && stackEnvLoading) ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] backdrop-blur-lg rounded-xl p-1 border border-white/5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 flex-1 justify-center
                rounded-lg px-4 py-2.5 text-sm font-medium
                transition-all duration-200
                ${
                  isActive
                    ? 'bg-white/10 text-slate-100 shadow-sm border border-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <FileCode size={16} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ================================================================= */}
      {/* Root .env Tab                                                     */}
      {/* ================================================================= */}
      {activeTab === 'root' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            {/* View mode toggle */}
            <div className="flex items-center gap-1 rounded-lg bg-white/[0.03] border border-white/5 p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`
                  flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all
                  ${viewMode === 'table'
                    ? 'bg-white/10 text-slate-100 border border-white/10'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }
                `}
              >
                <Eye size={12} />
                Table
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`
                  flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all
                  ${viewMode === 'raw'
                    ? 'bg-white/10 text-slate-100 border border-white/10'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }
                `}
              >
                <Pencil size={12} />
                Editor
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRootValidate}
                disabled={rootValidating || rootLoading}
                className="
                  flex items-center gap-2 rounded-lg px-3.5 py-2
                  text-sm font-medium text-cyan-400
                  bg-cyan-500/10 border border-cyan-500/20
                  hover:bg-cyan-500/20 hover:border-cyan-500/30
                  disabled:opacity-50 transition-all duration-200
                "
              >
                {rootValidating ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                Validate
              </button>
              <button
                onClick={handleRootSave}
                disabled={rootSaving || !rootHasChanges}
                className={`
                  flex items-center gap-2 rounded-lg px-3.5 py-2
                  text-sm font-medium transition-all duration-200
                  ${rootHasChanges
                    ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'text-slate-500 bg-white/5 border border-white/10 cursor-not-allowed'
                  }
                  disabled:opacity-50
                `}
              >
                {rootSaving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {rootSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Validation results */}
          {rootValidation && <ValidationResults result={rootValidation} />}

          {/* Loading */}
          {rootLoading && !rootEnvData && (
            <div className="glass rounded-xl border border-white/5 p-8 text-center">
              <RefreshCw size={20} className="inline animate-spin text-slate-500 mr-2" />
              <span className="text-sm text-slate-500">Loading environment variables...</span>
            </div>
          )}

          {/* Content */}
          {rootEnvData && (
            <div className="glass rounded-xl border border-white/5 overflow-hidden">
              {viewMode === 'table' ? (
                <EnvTable variables={rootEnvData.variables} />
              ) : (
                <div className="p-4">
                  <RawEditor
                    value={rootRaw}
                    onChange={(v) => {
                      setRootRaw(v)
                      setRootValidation(null)
                    }}
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5">
                <span className="text-[11px] text-slate-500 font-mono">
                  {rootEnvData.variables.length} variable{rootEnvData.variables.length !== 1 ? 's' : ''}
                </span>
                {rootHasChanges && (
                  <span className="flex items-center gap-1.5 text-[11px] text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* Stack .env Tab                                                    */}
      {/* ================================================================= */}
      {activeTab === 'stack' && (
        <div className="space-y-4">
          {/* Stack selector + toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <select
                value={selectedStack}
                onChange={(e) => setSelectedStack(e.target.value)}
                disabled={stacksLoading && stacks.length === 0}
                className="
                  w-full appearance-none
                  rounded-lg bg-white/[0.03] border border-white/10
                  px-4 py-2.5 pr-10
                  text-sm text-slate-200
                  font-medium
                  focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20
                  disabled:opacity-50
                  transition-all
                "
              >
                <option value="" className="bg-slate-900 text-slate-400">
                  Select a stack...
                </option>
                {stacks.map((s) => (
                  <option key={s.name} value={s.name} className="bg-slate-900 text-slate-200">
                    {s.name}
                    {!s.has_env ? ' (no .env)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
            </div>

            {/* Actions (when a stack is selected) */}
            {selectedStack && (
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <div className="flex items-center gap-1 rounded-lg bg-white/[0.03] border border-white/5 p-1">
                  <button
                    onClick={() => setStackViewMode('table')}
                    className={`
                      flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all
                      ${stackViewMode === 'table'
                        ? 'bg-white/10 text-slate-100 border border-white/10'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                      }
                    `}
                  >
                    <Eye size={12} />
                    Table
                  </button>
                  <button
                    onClick={() => setStackViewMode('raw')}
                    className={`
                      flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all
                      ${stackViewMode === 'raw'
                        ? 'bg-white/10 text-slate-100 border border-white/10'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                      }
                    `}
                  >
                    <Pencil size={12} />
                    Editor
                  </button>
                </div>

                <button
                  onClick={handleStackSave}
                  disabled={stackSaving || !stackHasChanges}
                  className={`
                    flex items-center gap-2 rounded-lg px-3.5 py-2
                    text-sm font-medium transition-all duration-200
                    ${stackHasChanges
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                      : 'text-slate-500 bg-white/5 border border-white/10 cursor-not-allowed'
                    }
                    disabled:opacity-50
                  `}
                >
                  {stackSaving ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {stackSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {/* No stack selected */}
          {!selectedStack && (
            <div className="glass rounded-xl border border-white/5 p-12 text-center">
              <FileCode size={32} className="text-slate-500 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                Select a stack from the dropdown to view its environment variables
              </p>
            </div>
          )}

          {/* Loading stack env */}
          {selectedStack && stackEnvLoading && (
            <div className="glass rounded-xl border border-white/5 p-8 text-center">
              <RefreshCw size={20} className="inline animate-spin text-slate-500 mr-2" />
              <span className="text-sm text-slate-500">Loading stack environment...</span>
            </div>
          )}

          {/* No .env file */}
          {selectedStack && !stackEnvLoading && stackEnvEmpty && (
            <div className="glass rounded-xl border border-white/5 p-12 text-center">
              <AlertTriangle size={28} className="text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-slate-300 font-medium mb-1">No .env file</p>
              <p className="text-xs text-slate-500">
                This stack does not have an .env file. Switch to the Editor view to create one.
              </p>
            </div>
          )}

          {/* Stack env content */}
          {selectedStack && !stackEnvLoading && stackEnvData && !stackEnvEmpty && (
            <div className="glass rounded-xl border border-white/5 overflow-hidden">
              {stackViewMode === 'table' ? (
                <EnvTable variables={stackEnvData.variables} />
              ) : (
                <div className="p-4">
                  <RawEditor
                    value={stackRaw}
                    onChange={setStackRaw}
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5">
                <span className="text-[11px] text-slate-500 font-mono">
                  {stackEnvData.variables.length} variable{stackEnvData.variables.length !== 1 ? 's' : ''}
                  {' '}&middot; {selectedStack}
                </span>
                {stackHasChanges && (
                  <span className="flex items-center gap-1.5 text-[11px] text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unsaved changes floating bar */}
      {((activeTab === 'root' && rootHasChanges) || (activeTab === 'stack' && stackHasChanges)) && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800/95 backdrop-blur-lg border border-white/10 px-5 py-3 shadow-2xl">
            <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-slate-300">You have unsaved changes</span>
            <button
              onClick={() => {
                if (activeTab === 'root') {
                  setRootRaw(rootOriginal)
                  setRootValidation(null)
                } else {
                  setStackRaw(stackOriginal)
                }
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
            >
              Discard
            </button>
            <button
              onClick={activeTab === 'root' ? handleRootSave : handleStackSave}
              disabled={activeTab === 'root' ? rootSaving : stackSaving}
              className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {(activeTab === 'root' ? rootSaving : stackSaving) ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
