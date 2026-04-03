// =============================================================================
// EditStackOverlay — Full-screen glass overlay for editing a stack's compose & env
// =============================================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle,
  FileCode2,
  FileText,
  GitCompare,
  Copy,
  Check,
  Search,
  Pencil,
  Tag,
  Shield,
  History,
  RotateCcw,
} from 'lucide-react'
import {
  fetchStackCompose,
  fetchStackEnv,
  validateStackCompose,
  saveStackCompose,
  saveStackEnv,
  fetchComposeHistory,
  rollbackCompose,
} from '../../api/endpoints'
import { useToast } from '../common/Toast'
import { useSettingsStore } from '../../stores/settingsStore'
import { useComposeLinter, useEnvLinter } from '../../hooks/useComposeLinter'
import type { StackInfo, StackAnnotation, ComposeVersion } from '../../../shared/types'

interface Props {
  stack: StackInfo
  onClose: () => void
  onSaved: () => void
}

/** Pretty-print stack category names */
function formatStackName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ---------------------------------------------------------------------------
// Lightweight YAML syntax highlighting (matching ComposeViewer style)
// ---------------------------------------------------------------------------

interface HighlightedSegment {
  text: string
  className: string
}

function highlightYamlLine(line: string): HighlightedSegment[] {
  if (line.trim() === '') {
    return [{ text: line, className: 'text-slate-300' }]
  }

  const commentMatch = line.match(/^(\s*)(#.*)$/)
  if (commentMatch) {
    return [
      { text: commentMatch[1], className: 'text-slate-300' },
      { text: commentMatch[2], className: 'text-slate-500 italic' },
    ]
  }

  const segments: HighlightedSegment[] = []

  const kvMatch = line.match(/^(\s*)([\w./-][\w./ -]*)(:)(.*)$/)
  if (kvMatch) {
    const [, indent, key, colon, rest] = kvMatch
    if (indent) segments.push({ text: indent, className: 'text-slate-300' })
    segments.push({ text: key, className: 'text-cyan-400' })
    segments.push({ text: colon, className: 'text-slate-500' })
    if (rest) highlightValue(rest, segments)
    return segments
  }

  const listMatch = line.match(/^(\s*)(-)(\s)(.*)$/)
  if (listMatch) {
    const [, indent, dash, space, value] = listMatch
    if (indent) segments.push({ text: indent, className: 'text-slate-300' })
    segments.push({ text: dash, className: 'text-slate-500' })
    segments.push({ text: space, className: 'text-slate-300' })

    const nestedKv = value.match(/^([\w./-][\w./ -]*)(:)(.*)$/)
    if (nestedKv) {
      const [, nKey, nColon, nRest] = nestedKv
      segments.push({ text: nKey, className: 'text-cyan-400' })
      segments.push({ text: nColon, className: 'text-slate-500' })
      if (nRest) highlightValue(nRest, segments)
    } else {
      highlightValue(' ' + value, segments, true)
    }
    return segments
  }

  segments.push({ text: line, className: 'text-slate-300' })
  return segments
}

function highlightValue(raw: string, segments: HighlightedSegment[], stripLeadingSpace = false): void {
  const commentIdx = raw.indexOf(' #')
  let value = commentIdx >= 0 ? raw.slice(0, commentIdx) : raw
  const comment = commentIdx >= 0 ? raw.slice(commentIdx) : ''

  const leadingMatch = value.match(/^(\s+)(.*)$/)
  let leading = ''
  if (leadingMatch) {
    leading = leadingMatch[1]
    value = leadingMatch[2]
  }

  if (leading && !stripLeadingSpace) {
    segments.push({ text: leading, className: 'text-slate-300' })
  } else if (leading && stripLeadingSpace) {
    segments.push({ text: leading.slice(1), className: 'text-slate-300' })
  }

  if (value === '') {
    // nothing
  } else if (/^(true|false|yes|no|on|off)$/i.test(value)) {
    segments.push({ text: value, className: 'text-rose-400' })
  } else if (/^-?\d[\d_.]*$/.test(value)) {
    segments.push({ text: value, className: 'text-amber-400' })
  } else if (/^null$/i.test(value)) {
    segments.push({ text: value, className: 'text-slate-500 italic' })
  } else if (/^['"].*['"]$/.test(value)) {
    segments.push({ text: value, className: 'text-emerald-400' })
  } else if (value.startsWith('${') || value.includes('${')) {
    segments.push({ text: value, className: 'text-emerald-400' })
  } else {
    segments.push({ text: value, className: 'text-emerald-400' })
  }

  if (comment) {
    segments.push({ text: comment, className: 'text-slate-500 italic' })
  }
}

// ---------------------------------------------------------------------------
// Simple line-by-line diff
// ---------------------------------------------------------------------------

interface DiffLine {
  type: 'same' | 'added' | 'removed'
  content: string
  lineNumber: number | null
}

function computeDiff(original: string, edited: string): { left: DiffLine[]; right: DiffLine[] } {
  // Trim trailing empty lines to avoid phantom empty diffs at the bottom
  const trimTrailing = (lines: string[]) => {
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    return lines
  }
  const origLines = trimTrailing(original.split('\n'))
  const editLines = trimTrailing(edited.split('\n'))
  const left: DiffLine[] = []
  const right: DiffLine[] = []

  const m = origLines.length
  const n = editLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origLines[i - 1] === editLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const diffOps: Array<{ type: 'same' | 'removed' | 'added'; origIdx?: number; editIdx?: number }> = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === editLines[j - 1]) {
      diffOps.unshift({ type: 'same', origIdx: i - 1, editIdx: j - 1 })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffOps.unshift({ type: 'added', editIdx: j - 1 })
      j--
    } else {
      diffOps.unshift({ type: 'removed', origIdx: i - 1 })
      i--
    }
  }

  // Collect raw removed/added sequences, then collapse them side-by-side
  // so changed lines appear on one row instead of two (removed + placeholder, placeholder + added)
  const rawLeft: DiffLine[] = []
  const rawRight: DiffLine[] = []
  for (const op of diffOps) {
    if (op.type === 'same') {
      rawLeft.push({ type: 'same', content: origLines[op.origIdx!], lineNumber: op.origIdx! + 1 })
      rawRight.push({ type: 'same', content: editLines[op.editIdx!], lineNumber: op.editIdx! + 1 })
    } else if (op.type === 'removed') {
      rawLeft.push({ type: 'removed', content: origLines[op.origIdx!], lineNumber: op.origIdx! + 1 })
      rawRight.push({ type: 'removed', content: '', lineNumber: null })
    } else {
      rawLeft.push({ type: 'added', content: '', lineNumber: null })
      rawRight.push({ type: 'added', content: editLines[op.editIdx!], lineNumber: op.editIdx! + 1 })
    }
  }

  // Collapse: merge adjacent removed+added placeholder pairs into single changed rows
  // Before: row A = [removed "old", placeholder ""]  row B = [placeholder "", added "new"]
  // After:  row A = [removed "old", added "new"]  (row B eliminated)
  let idx = 0
  while (idx < rawLeft.length) {
    // Check for a removed row followed by an added row
    if (
      idx + 1 < rawLeft.length &&
      rawLeft[idx].type === 'removed' && rawRight[idx].lineNumber === null &&
      rawLeft[idx + 1].lineNumber === null && rawRight[idx + 1].type === 'added'
    ) {
      // Collapse: take the removed content on the left, added content on the right
      left.push(rawLeft[idx])  // removed line with content
      right.push(rawRight[idx + 1])  // added line with content
      idx += 2 // skip both rows
    } else {
      left.push(rawLeft[idx])
      right.push(rawRight[idx])
      idx++
    }
  }

  return { left, right }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EditStackOverlay({ stack, onClose, onSaved }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const { addToast } = useToast()

  const isRunning = stack.status === 'running'

  // Annotation state
  const stackAnnotations = useSettingsStore((s) => s.stackAnnotations) ?? {}
  const annotation: StackAnnotation = stackAnnotations[stack.name] ?? {}
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const [annoLabel, setAnnoLabel] = useState(annotation.label ?? '')
  const [annoPriority, setAnnoPriority] = useState(annotation.priority ?? 'normal')
  const [annoNotes, setAnnoNotes] = useState(annotation.notes ?? '')

  // Loading states
  const [composeLoading, setComposeLoading] = useState(true)
  const [envLoading, setEnvLoading] = useState(false)
  const [envLoaded, setEnvLoaded] = useState(false)

  // Content states
  const [originalCompose, setOriginalCompose] = useState('')
  const [composeContent, setComposeContent] = useState('')
  const [originalEnv, setOriginalEnv] = useState('')
  const [envContent, setEnvContent] = useState('')

  // Edit mode states
  const [composeEditMode, setComposeEditMode] = useState(false)
  const [envEditMode, setEnvEditMode] = useState(false)
  const [showDiff, setShowDiff] = useState(false)

  // Validation and save states
  const [validationResult, setValidationResult] = useState<{ valid: boolean; output: string; hasLintWarnings?: boolean } | null>(null)
  const [validating, setValidating] = useState(false)
  const [savingCompose, setSavingCompose] = useState(false)
  const [savingEnv, setSavingEnv] = useState(false)

  // Real-time linting
  const { diagnostics: composeDiagnostics, counts: composeCounts } = useComposeLinter(composeContent || undefined, envContent || undefined)
  const { diagnostics: envDiagnostics, counts: envCounts } = useEnvLinter(envContent || undefined, composeContent || undefined)

  // Build line -> diagnostics maps for gutter markers
  const composeLintMap = useMemo(() => {
    const map = new Map<number, typeof composeDiagnostics>()
    for (const d of composeDiagnostics) {
      const arr = map.get(d.line) || []
      arr.push(d)
      map.set(d.line, arr)
    }
    return map
  }, [composeDiagnostics])

  const envLintMap = useMemo(() => {
    const map = new Map<number, typeof envDiagnostics>()
    for (const d of envDiagnostics) {
      const arr = map.get(d.line) || []
      arr.push(d)
      map.set(d.line, arr)
    }
    return map
  }, [envDiagnostics])

  // Compose history
  const [composeVersions, setComposeVersions] = useState<ComposeVersion[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [rollingBack, setRollingBack] = useState<string | null>(null)

  // Tab
  const [activeTab, setActiveTab] = useState<'compose' | 'env' | 'annotations' | 'history'>('compose')

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const codeContainerRef = useRef<HTMLDivElement>(null)

  // Copy
  const [copied, setCopied] = useState(false)

  // Error
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load compose content on mount
  useEffect(() => {
    setComposeLoading(true)
    fetchStackCompose(stack.name)
      .then((res) => {
        setOriginalCompose(res.content)
        setComposeContent(res.content)
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load compose file'
        setLoadError(msg)
        setOriginalCompose('')
        setComposeContent('')
      })
      .finally(() => setComposeLoading(false))
  }, [stack.name])

  // Load env content when switching to env tab
  useEffect(() => {
    if (activeTab === 'env' && !envLoading && !envLoaded) {
      setEnvLoading(true)
      fetchStackEnv(stack.name)
        .then((res) => {
          setOriginalEnv(res.raw)
          setEnvContent(res.raw)
          setEnvLoaded(true)
        })
        .catch(() => {
          setOriginalEnv('')
          setEnvContent('')
          setEnvLoaded(true)
        })
        .finally(() => setEnvLoading(false))
    }
  }, [activeTab, stack.name, envLoading, envLoaded])

  // Load compose history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history' && !historyLoading && !historyLoaded) {
      setHistoryLoading(true)
      fetchComposeHistory(stack.name)
        .then((res) => {
          setComposeVersions(res.versions || [])
          setHistoryLoaded(true)
        })
        .catch(() => {
          setComposeVersions([])
          setHistoryLoaded(true)
        })
        .finally(() => setHistoryLoading(false))
    }
  }, [activeTab, stack.name, historyLoading, historyLoaded])

  // Rollback handler
  const handleRollback = useCallback(async (versionId: string) => {
    setRollingBack(versionId)
    try {
      await rollbackCompose(stack.name, versionId)
      addToast({ type: 'success', message: `Rolled back to ${versionId}` })
      // Reload compose content
      const res = await fetchStackCompose(stack.name)
      setOriginalCompose(res.content)
      setComposeContent(res.content)
      setHistoryLoaded(false) // Force reload history
      onSaved()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rollback failed'
      addToast({ type: 'error', message: msg })
    } finally {
      setRollingBack(null)
    }
  }, [stack.name, addToast, onSaved])

  // Reset validation when compose content changes
  useEffect(() => {
    if (composeEditMode) {
      setValidationResult(null)
    }
  }, [composeContent])

  // Lines for syntax highlighting (view mode)
  const composeLines = useMemo(() => composeContent.split('\n'), [composeContent])

  // Search logic (compose view mode only)
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || composeEditMode) return new Map<number, { start: number; end: number }[]>()
    const query = searchQuery.toLowerCase()
    const result = new Map<number, { start: number; end: number }[]>()
    composeLines.forEach((line, lineIdx) => {
      const lower = line.toLowerCase()
      const ranges: { start: number; end: number }[] = []
      let pos = 0
      while (pos < lower.length) {
        const idx = lower.indexOf(query, pos)
        if (idx === -1) break
        ranges.push({ start: idx, end: idx + query.length })
        pos = idx + 1
      }
      if (ranges.length > 0) result.set(lineIdx, ranges)
    })
    return result
  }, [composeLines, searchQuery, composeEditMode])

  const allMatches = useMemo(() => {
    const flat: { line: number; rangeIdx: number }[] = []
    searchMatches.forEach((ranges, lineIdx) => {
      ranges.forEach((_, rangeIdx) => flat.push({ line: lineIdx, rangeIdx }))
    })
    flat.sort((a, b) => a.line - b.line || a.rangeIdx - b.rangeIdx)
    return flat
  }, [searchMatches])

  const totalMatches = allMatches.length

  useEffect(() => {
    setActiveMatchIndex(0)
  }, [searchQuery])

  // Scroll to active match
  useEffect(() => {
    if (totalMatches === 0 || !codeContainerRef.current) return
    const activeLine = allMatches[activeMatchIndex]?.line
    if (activeLine == null) return
    const el = codeContainerRef.current.querySelector(`[data-line-index="${activeLine}"]`)
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeMatchIndex, allMatches, totalMatches])

  // Diff computation
  const diff = useMemo(() => {
    if (!showDiff || !composeEditMode) return null
    return computeDiff(originalCompose, composeContent)
  }, [showDiff, composeEditMode, originalCompose, composeContent])

  // Change detection + safe close (must be above keyboard handler)
  const hasComposeChanges = composeContent !== originalCompose
  const hasEnvChanges = envContent !== originalEnv
  const hasAnyChanges = hasComposeChanges || hasEnvChanges

  const safeClose = useCallback(() => {
    if (hasAnyChanges) {
      if (!window.confirm('You have unsaved changes. Close without saving?')) return
    }
    onClose()
  }, [hasAnyChanges, onClose])

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (searchOpen) {
          setSearchOpen(false)
          setSearchQuery('')
        } else if (composeEditMode) {
          setComposeEditMode(false)
          setShowDiff(false)
          setValidationResult(null)
        } else if (envEditMode) {
          setEnvEditMode(false)
        } else {
          safeClose()
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !composeEditMode && activeTab === 'compose') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (composeEditMode && validationResult?.valid) handleSaveCompose()
        else if (envEditMode && activeTab === 'env') handleSaveEnv()
        else if (activeTab === 'annotations') handleSaveAnnotations()
        return
      }
      if (searchOpen && e.key === 'Enter' && totalMatches > 0) {
        e.preventDefault()
        if (e.shiftKey) {
          setActiveMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches)
        } else {
          setActiveMatchIndex((prev) => (prev + 1) % totalMatches)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [safeClose, searchOpen, totalMatches, composeEditMode, envEditMode, activeTab, validationResult])

  // Backdrop click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) safeClose()
    },
    [safeClose],
  )

  // Copy
  const handleCopy = useCallback(async () => {
    const text = activeTab === 'compose' ? composeContent : envContent
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [activeTab, composeContent, envContent])

  // Validate compose
  const handleValidate = useCallback(async () => {
    setValidating(true)
    try {
      const res = await validateStackCompose(stack.name, composeContent)

      // Also run client-side lint for port conflicts and other warnings
      const lintIssues = composeDiagnostics.filter(d => d.severity === 'error' || d.severity === 'warning')
      const portConflicts = composeDiagnostics.filter(d => d.rule === 'port-conflict')
      const lintErrors = composeDiagnostics.filter(d => d.severity === 'error')

      if (res.valid && lintErrors.length > 0) {
        // Syntax is valid but lint found errors (port conflicts, etc)
        const lintSummary = lintErrors.map(d => `Line ${d.line}: ${d.message}`).join('\n')
        setValidationResult({
          valid: true,
          output: `Syntax valid — ${lintErrors.length} lint error${lintErrors.length !== 1 ? 's' : ''} detected:\n${lintSummary}`,
          hasLintWarnings: true
        })
        addToast({ type: 'warning', message: `Compose syntax OK but ${lintErrors.length} lint issue${lintErrors.length !== 1 ? 's' : ''} found` })
      } else if (res.valid) {
        setValidationResult({ valid: true, output: res.output, hasLintWarnings: lintIssues.length > 0 })
        addToast({ type: 'success', message: lintIssues.length > 0 ? `Valid — ${lintIssues.length} lint warning${lintIssues.length !== 1 ? 's' : ''}` : 'Compose file is valid' })
      } else {
        setValidationResult({ valid: false, output: res.output })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Validation failed'
      setValidationResult({ valid: false, output: msg })
    } finally {
      setValidating(false)
    }
  }, [stack.name, composeContent, composeDiagnostics, addToast])

  // Save compose
  const handleSaveCompose = useCallback(async () => {
    if (!validationResult?.valid) return

    // Warn about lint errors before saving
    const errors = composeDiagnostics.filter(d => d.severity === 'error')
    if (errors.length > 0) {
      if (!window.confirm(`${errors.length} lint error${errors.length !== 1 ? 's' : ''} detected (port conflicts, etc). Save anyway?`)) return
    }

    setSavingCompose(true)
    try {
      await saveStackCompose(stack.name, composeContent)
      setOriginalCompose(composeContent)
      addToast({ type: 'success', message: `Compose file saved for ${stack.name}` })
      setComposeEditMode(false)
      setShowDiff(false)
      setValidationResult(null)
      onSaved()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      addToast({ type: 'error', message: msg })
    } finally {
      setSavingCompose(false)
    }
  }, [stack.name, composeContent, validationResult, composeDiagnostics, addToast, onSaved])

  // Save env
  const handleSaveEnv = useCallback(async () => {
    setSavingEnv(true)
    try {
      await saveStackEnv(stack.name, envContent)
      setOriginalEnv(envContent)
      addToast({ type: 'success', message: `.env saved for ${stack.name}` })
      setEnvEditMode(false)
      onSaved()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      addToast({ type: 'error', message: msg })
    } finally {
      setSavingEnv(false)
    }
  }, [stack.name, envContent, addToast, onSaved])

  // Save annotations
  const handleSaveAnnotations = useCallback(() => {
    const newAnnotations = { ...stackAnnotations }
    const anno: StackAnnotation = {}
    if (annoLabel.trim()) anno.label = annoLabel.trim()
    if (annoPriority !== 'normal') anno.priority = annoPriority
    if (annoNotes.trim()) anno.notes = annoNotes.trim()

    if (Object.keys(anno).length > 0) {
      newAnnotations[stack.name] = anno
    } else {
      delete newAnnotations[stack.name]
    }
    updateSetting('stackAnnotations', newAnnotations)
    addToast({ type: 'success', message: 'Annotations saved' })
  }, [stack.name, annoLabel, annoPriority, annoNotes, stackAnnotations, updateSetting, addToast])

  // Switch tab and reset edit states
  const switchTab = useCallback((tab: typeof activeTab) => {
    if (tab === activeTab) return
    // If currently editing, auto-enable edit mode on the target tab too
    const wasEditing = (activeTab === 'compose' && composeEditMode) || (activeTab === 'env' && envEditMode)
    if (wasEditing) {
      if (tab === 'compose' && !composeEditMode) setComposeEditMode(true)
      if (tab === 'env' && !envEditMode) setEnvEditMode(true)
    }
    setSearchOpen(false)
    setSearchQuery('')
    setShowDiff(false)
    setActiveTab(tab)
  }, [activeTab, composeEditMode, envEditMode])

  const formattedName = annotation.label || formatStackName(stack.name)
  const activeMatchLine = totalMatches > 0 ? allMatches[activeMatchIndex]?.line : -1
  const matchedLineSet = useMemo(() => {
    const s = new Set<number>()
    searchMatches.forEach((_, lineIdx) => s.add(lineIdx))
    return s
  }, [searchMatches])


  // Priority config
  const priorityOptions = [
    { value: 'critical', label: 'Critical', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: Shield },
    { value: 'high', label: 'High', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: AlertTriangle },
    { value: 'normal', label: 'Normal', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', icon: Tag },
    { value: 'low', label: 'Low', color: 'text-slate-500', bg: 'bg-slate-500/10 border-slate-500/20', icon: Tag },
  ]

  // ---- Render highlighted YAML line ----
  function renderLine(line: string, lineIdx: number) {
    const highlighted = highlightYamlLine(line)
    const lineMatches = searchMatches.get(lineIdx)

    if (!lineMatches || lineMatches.length === 0) {
      return (
        <span>
          {highlighted.map((seg, i) => (
            <span key={i} className={seg.className}>{seg.text}</span>
          ))}
        </span>
      )
    }

    const charHighlights = new Array<{ active: boolean; match: boolean }>(line.length)
    for (let ci = 0; ci < line.length; ci++) {
      charHighlights[ci] = { active: false, match: false }
    }

    const isActiveMatchLine = lineIdx === activeMatchLine
    let activeRangeOnLine = -1
    if (isActiveMatchLine) activeRangeOnLine = allMatches[activeMatchIndex]?.rangeIdx ?? -1

    lineMatches.forEach((range, rangeIdx) => {
      for (let ci = range.start; ci < range.end; ci++) {
        charHighlights[ci] = {
          match: true,
          active: isActiveMatchLine && rangeIdx === activeRangeOnLine,
        }
      }
    })

    let charPos = 0
    return (
      <span>
        {highlighted.map((seg, segIdx) => {
          const segStart = charPos
          charPos += seg.text.length
          let hasMatch = false
          for (let ci = segStart; ci < charPos; ci++) {
            if (charHighlights[ci]?.match) { hasMatch = true; break }
          }

          if (!hasMatch) {
            return <span key={segIdx} className={seg.className}>{seg.text}</span>
          }

          const subSpans: { text: string; match: boolean; active: boolean }[] = []
          let cur = { text: '', match: charHighlights[segStart]?.match ?? false, active: charHighlights[segStart]?.active ?? false }

          for (let ci = segStart; ci < segStart + seg.text.length; ci++) {
            const ch = charHighlights[ci] ?? { match: false, active: false }
            if (ch.match === cur.match && ch.active === cur.active) {
              cur.text += seg.text[ci - segStart]
            } else {
              if (cur.text) subSpans.push({ ...cur })
              cur = { text: seg.text[ci - segStart], match: ch.match, active: ch.active }
            }
          }
          if (cur.text) subSpans.push(cur)

          return (
            <span key={segIdx}>
              {subSpans.map((sub, si) => {
                if (sub.match) {
                  return (
                    <span
                      key={si}
                      className={`rounded-sm px-[1px] -mx-[1px] ${
                        sub.active
                          ? 'bg-amber-400/30 ring-1 ring-amber-400/60 text-white'
                          : 'bg-amber-400/15 text-white'
                      }`}
                    >
                      {sub.text}
                    </span>
                  )
                }
                return <span key={si} className={seg.className}>{sub.text}</span>
              })}
            </span>
          )
        })}
      </span>
    )
  }

  // ---- Render compose tab ----
  function renderComposeTab() {
    if (composeLoading) {
      return (
        <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading compose file...
          </div>
        </div>
      )
    }

    if (loadError) {
      return (
        <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle size={16} />
            {loadError}
          </div>
        </div>
      )
    }

    // Diff view — row-synchronized: each row renders both columns at equal height
    if (composeEditMode && showDiff && diff) {
      return (
        <div className="overflow-y-auto flex-1 scrollbar-thin bg-slate-950">
          {/* Header row */}
          <div className="grid grid-cols-2 sticky top-0 z-10 border-b border-white/5">
            <div className="px-4 py-2 text-[10px] uppercase tracking-wider bg-slate-900/90 backdrop-blur-sm font-sans font-semibold flex items-center gap-2 border-r border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400/60" />
              <span className="text-slate-400">Original</span>
            </div>
            <div className="px-4 py-2 text-[10px] uppercase tracking-wider bg-slate-900/90 backdrop-blur-sm font-sans font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
              <span className="text-slate-400">Edited</span>
            </div>
          </div>
          {/* Diff rows — each row is a grid so both sides always match height */}
          <div className="font-mono text-[13px] leading-6">
            {diff.left.map((dl, idx) => {
              const dr = diff.right[idx]
              if (!dr) return null
              const leftIsChange = dl.type === 'removed'
              const rightIsChange = dr.type === 'added'
              const leftIsPlaceholder = dl.type === 'added'
              const rightIsPlaceholder = dr.type === 'removed'
              return (
                <div key={idx} className="grid grid-cols-2">
                  {/* Left cell */}
                  <div className={`flex border-r border-white/5 min-h-6 ${
                    leftIsChange ? 'bg-rose-500/[0.08]' : leftIsPlaceholder ? 'bg-slate-900/40' : ''
                  }`}>
                    <span className={`inline-block w-10 shrink-0 text-right pr-3 pl-2 text-xs leading-6 select-none tabular-nums ${
                      leftIsChange ? 'text-rose-400/60' : 'text-slate-700'
                    }`}>
                      {dl.lineNumber ?? ''}
                    </span>
                    <span className={`flex-1 whitespace-pre leading-6 pr-2 ${
                      leftIsChange ? 'text-rose-300' : leftIsPlaceholder ? '' : 'text-slate-400'
                    }`}>
                      {dl.content}
                    </span>
                  </div>
                  {/* Right cell */}
                  <div className={`flex min-h-6 ${
                    rightIsChange ? 'bg-emerald-500/[0.08]' : rightIsPlaceholder ? 'bg-slate-900/40' : ''
                  }`}>
                    <span className={`inline-block w-10 shrink-0 text-right pr-3 pl-2 text-xs leading-6 select-none tabular-nums ${
                      rightIsChange ? 'text-emerald-400/60' : 'text-slate-700'
                    }`}>
                      {dr.lineNumber ?? ''}
                    </span>
                    <span className={`flex-1 whitespace-pre leading-6 pr-2 ${
                      rightIsChange ? 'text-emerald-300' : rightIsPlaceholder ? '' : 'text-slate-400'
                    }`}>
                      {dr.content}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // Edit mode
    if (composeEditMode) {
      return (
        <div className="overflow-y-auto flex-1 scrollbar-thin">
          <textarea
            value={composeContent}
            onChange={(e) => setComposeContent(e.target.value)}
            className="w-full h-full bg-slate-950 text-slate-200 font-mono text-sm p-5 resize-none focus:outline-none"
            style={{ minHeight: '70vh' }}
            spellCheck={false}
          />
        </div>
      )
    }

    // View mode with syntax highlighting
    return (
      <div ref={codeContainerRef} className="overflow-y-auto flex-1 scrollbar-thin">
        <div className="bg-slate-950 font-mono text-sm leading-relaxed">
          {composeLines.map((line, idx) => {
            const isMatchedLine = matchedLineSet.has(idx)
            const isActiveLine = idx === activeMatchLine
            const diags = composeLintMap.get(idx + 1)
            const sev = diags?.[0]?.severity
            return (
              <div
                key={idx}
                data-line-index={idx}
                className={`flex px-5 transition-colors duration-100 ${
                  isActiveLine ? 'bg-amber-400/[0.06]'
                    : isMatchedLine ? 'bg-amber-400/[0.03]'
                    : diags
                      ? sev === 'error'
                        ? 'border-l-2 border-l-rose-400 bg-rose-500/[0.04]'
                        : sev === 'warning'
                          ? 'border-l-2 border-l-amber-400 bg-amber-500/[0.03]'
                          : 'border-l-2 border-l-cyan-400/50 hover:bg-white/[0.03]'
                      : 'hover:bg-white/[0.03]'
                }`}
              >
                <span className={`inline-block w-12 shrink-0 text-right pr-3 pl-3 select-none tabular-nums text-xs leading-relaxed relative ${
                  diags
                    ? sev === 'error' ? 'text-rose-400' : sev === 'warning' ? 'text-amber-400' : 'text-cyan-400'
                    : 'text-slate-500'
                }`}>
                  {diags ? (
                    <span className="group/diag cursor-help">
                      {idx + 1}
                      <div className="absolute left-full top-0 ml-2 z-50 hidden group-hover/diag:block animate-fade-in pointer-events-none" style={{ width: '300px' }}>
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl shadow-black/40 p-2.5 space-y-1.5">
                          {diags.map((d, di) => (
                            <div key={di} className="flex items-start gap-2">
                              <span className={`shrink-0 mt-0.5 ${d.severity === 'error' ? 'text-rose-400' : d.severity === 'warning' ? 'text-amber-400' : 'text-cyan-400'}`}>
                                {d.severity === 'error' ? '\u25CF' : d.severity === 'warning' ? '\u25B2' : '\u2139'}
                              </span>
                              <div>
                                <p className="text-[11px] text-slate-200 leading-snug">{d.message}</p>
                                {d.fix && <p className="text-[10px] text-slate-500 mt-0.5">Fix: {d.fix}</p>}
                                <span className="text-[9px] text-slate-500 font-mono">{d.rule}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </span>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </span>
                <span className="flex-1 py-[1px] whitespace-pre overflow-x-auto">
                  {renderLine(line, idx)}
                </span>
              </div>
            )
          })}
          <div className="h-4" />
        </div>
      </div>
    )
  }

  // ---- Render env tab ----
  function renderEnvTab() {
    if (envLoading) {
      return (
        <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading .env...
          </div>
        </div>
      )
    }

    if (envEditMode) {
      return (
        <div className="overflow-y-auto flex-1 scrollbar-thin">
          <textarea
            value={envContent}
            onChange={(e) => setEnvContent(e.target.value)}
            className="w-full h-full bg-slate-950 text-slate-200 font-mono text-sm p-5 resize-none focus:outline-none"
            style={{ minHeight: '70vh' }}
            spellCheck={false}
          />
        </div>
      )
    }

    // Read-only view
    const envLines = envContent.split('\n')
    return (
      <div className="overflow-y-auto flex-1 scrollbar-thin">
        <div className="bg-slate-950 font-mono text-sm leading-relaxed">
          {envLines.map((line, idx) => {
            const isComment = line.trimStart().startsWith('#')
            const isEmpty = line.trim() === ''

            let rendered: React.ReactNode
            if (isEmpty) {
              rendered = <span className="text-slate-300">{line}</span>
            } else if (isComment) {
              rendered = <span className="text-slate-500 italic">{line}</span>
            } else {
              const eqIdx = line.indexOf('=')
              if (eqIdx > 0) {
                rendered = (
                  <span>
                    <span className="text-cyan-400">{line.slice(0, eqIdx)}</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-emerald-400">{line.slice(eqIdx + 1)}</span>
                  </span>
                )
              } else {
                rendered = <span className="text-slate-300">{line}</span>
              }
            }

            return (
              <div key={idx} className="flex px-5 hover:bg-white/[0.03]">
                <span className="inline-block w-10 shrink-0 text-right pr-4 py-[1px] text-slate-500 select-none tabular-nums text-xs leading-relaxed">
                  {idx + 1}
                </span>
                <span className="flex-1 py-[1px] whitespace-pre overflow-x-auto">
                  {rendered}
                </span>
              </div>
            )
          })}
          <div className="h-4" />
        </div>
      </div>
    )
  }

  // ---- Render annotations tab ----
  function renderAnnotationsTab() {
    return (
      <div className="overflow-y-auto flex-1 scrollbar-thin p-6 space-y-5">
        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl bg-cyan-500/[0.05] border border-cyan-500/10 px-4 py-3">
          <Tag size={14} className="text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-cyan-300 font-medium">Stack Annotations</p>
            <p className="text-[10px] text-cyan-400/60 mt-0.5 leading-relaxed">
              Local metadata for organizing your stacks. Labels override display names, priority controls sort order and visual emphasis, and notes are for your reference. These are stored locally and don't affect the server.
            </p>
          </div>
        </div>

        {/* Custom label */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Custom Label
          </label>
          <input
            type="text"
            value={annoLabel}
            onChange={(e) => setAnnoLabel(e.target.value)}
            placeholder="Custom display name..."
            className="
              w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
              text-sm text-slate-200 placeholder-slate-600
              focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20
              transition-all duration-200
            "
          />
          <p className="text-[10px] text-slate-500 mt-1.5">
            Overrides the display name in the stack grid
          </p>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Priority
          </label>
          <p className="text-[10px] text-slate-500 mb-2">
            Controls stack sort order and visual emphasis. Critical stacks sort first and get highlighted borders.
          </p>
          <div className="flex items-center gap-2">
            {priorityOptions.map((p) => {
              const isActive = annoPriority === p.value
              const Icon = p.icon
              return (
                <button
                  key={p.value}
                  onClick={() => setAnnoPriority(p.value as StackAnnotation['priority'])}
                  className={`
                    flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-xs font-medium border transition-all duration-200
                    ${isActive
                      ? `${p.bg} ${p.color} ring-1 ring-current/20`
                      : 'border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/[0.15] hover:bg-white/5'
                    }
                  `}
                >
                  <Icon size={12} />
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Notes
          </label>
          <p className="text-[10px] text-slate-500 mb-2">
            Private notes about this stack — configuration details, maintenance reminders, or team context.
          </p>
          <textarea
            value={annoNotes}
            onChange={(e) => setAnnoNotes(e.target.value)}
            placeholder="Add notes about this stack..."
            rows={4}
            className="
              w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
              text-sm text-slate-200 placeholder-slate-600
              focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20
              transition-all duration-200 resize-none
            "
          />
        </div>

        {/* Save annotations button */}
        <div className="pt-2">
          <button
            onClick={handleSaveAnnotations}
            className="
              flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg
              bg-emerald-500 text-white hover:bg-emerald-400
              shadow-lg shadow-emerald-500/20 transition-all duration-200
            "
          >
            <Check size={15} />
            Save Annotations
          </button>
        </div>
      </div>
    )
  }

  // ---- Render history tab ----
  function renderHistoryTab() {
    if (historyLoading) {
      return (
        <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading version history...
          </div>
        </div>
      )
    }

    if (composeVersions.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <History size={32} className="mb-3 opacity-30" />
          <p className="text-sm">No version history yet</p>
          <p className="text-xs text-slate-500 mt-1">Versions are saved automatically when you edit the compose file</p>
        </div>
      )
    }

    return (
      <div className="overflow-y-auto flex-1 scrollbar-thin p-6 space-y-2">
        <p className="text-xs text-slate-500 mb-4">{composeVersions.length} saved version{composeVersions.length !== 1 ? 's' : ''}</p>
        {[...composeVersions].reverse().map((v) => {
          const date = new Date(v.timestamp)
          const isRolling = rollingBack === v.version_id
          return (
            <div
              key={v.version_id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-mono text-slate-300 truncate">{v.version_id}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {date.toLocaleDateString()} {date.toLocaleTimeString()} — {v.size > 0 ? `${(v.size / 1024).toFixed(1)} KB` : ''}
                </p>
              </div>
              <button
                onClick={() => handleRollback(v.version_id)}
                disabled={isRolling}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-colors shrink-0 disabled:opacity-50"
                title="Rollback to this version"
              >
                {isRolling ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RotateCcw size={12} />
                )}
                Rollback
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[4vh] animate-fade-in"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="
          relative w-full max-w-[95vw] xl:max-w-[1400px] mx-4
          bg-slate-900/95 backdrop-blur-2xl
          border border-white/10 rounded-2xl
          shadow-2xl shadow-black/40
          overflow-hidden animate-scale-in
          flex flex-col
          max-h-[95vh]
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-stack-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20 shrink-0">
              <Pencil className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h2 id="edit-stack-title" className="text-base font-semibold text-slate-100 truncate">
                  {formattedName}
                </h2>
                <span
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0
                    ${isRunning
                      ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
                      : 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25'
                    }
                  `}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                    }`}
                  />
                  {isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">{stack.name}</p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/5 rounded-lg p-0.5 shrink-0 ml-2">
              <button
                onClick={() => switchTab('compose')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150
                  ${activeTab === 'compose'
                    ? 'bg-white/[0.08] text-slate-200 ring-1 ring-white/[0.1]'
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                <FileCode2 size={12} />
                Compose
                {composeCounts.errors > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-rose-500/20 text-[9px] font-bold text-rose-400 tabular-nums">{composeCounts.errors}</span>
                )}
                {composeCounts.errors === 0 && composeCounts.warnings > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-400 tabular-nums">{composeCounts.warnings}</span>
                )}
              </button>
              <button
                onClick={() => switchTab('env')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150
                  ${activeTab === 'env'
                    ? 'bg-white/[0.08] text-slate-200 ring-1 ring-white/[0.1]'
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                <FileText size={12} />
                .env
                {envCounts.errors > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-rose-500/20 text-[9px] font-bold text-rose-400 tabular-nums">{envCounts.errors}</span>
                )}
                {envCounts.errors === 0 && envCounts.warnings > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-400 tabular-nums">{envCounts.warnings}</span>
                )}
              </button>
              <button
                onClick={() => switchTab('annotations')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150
                  ${activeTab === 'annotations'
                    ? 'bg-white/[0.08] text-slate-200 ring-1 ring-white/[0.1]'
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                <Tag size={12} />
                Labels
              </button>
              <button
                onClick={() => switchTab('history')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150
                  ${activeTab === 'history'
                    ? 'bg-white/[0.08] text-slate-200 ring-1 ring-white/[0.1]'
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                <History size={12} />
                History
              </button>
            </div>
          </div>

          {/* Header buttons */}
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            {/* Compose tab buttons */}
            {activeTab === 'compose' && !composeLoading && !loadError && (
              <>
                <button
                  onClick={() => {
                    if (composeEditMode) {
                      setComposeEditMode(false)
                      setShowDiff(false)
                      setValidationResult(null)
                    } else {
                      setComposeEditMode(true)
                      setSearchOpen(false)
                      setSearchQuery('')
                    }
                  }}
                  className={`
                    flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors duration-150
                    ${composeEditMode
                      ? 'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }
                  `}
                  title={composeEditMode ? 'Switch to view mode' : 'Switch to edit mode'}
                >
                  <Pencil size={13} />
                  <span>{composeEditMode ? 'Editing' : 'Edit'}</span>
                </button>

                {composeEditMode && (
                  <button
                    onClick={() => setShowDiff((prev) => !prev)}
                    className={`
                      flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors duration-150
                      ${showDiff
                        ? 'text-violet-400 bg-violet-500/10 ring-1 ring-violet-500/20'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                      }
                    `}
                    title="Toggle diff view"
                  >
                    <GitCompare size={13} />
                    <span>Diff</span>
                  </button>
                )}

                {composeEditMode && (
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className={`
                      flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors duration-150
                      ${validating
                        ? 'text-slate-500 cursor-not-allowed'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                      }
                    `}
                    title="Validate compose file"
                  >
                    {validating ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
                    ) : (
                      <CheckCircle size={13} />
                    )}
                    <span>Validate</span>
                  </button>
                )}

                {composeEditMode && (
                  <button
                    onClick={handleSaveCompose}
                    disabled={!validationResult?.valid || savingCompose}
                    className={`
                      flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors duration-150
                      ${!validationResult?.valid || savingCompose
                        ? 'text-slate-500 cursor-not-allowed'
                        : 'text-emerald-400 hover:bg-emerald-500/10'
                      }
                    `}
                    title={!validationResult?.valid ? 'Validate first before saving' : 'Save compose file'}
                  >
                    {savingCompose ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    <span>Save</span>
                  </button>
                )}

                {!composeEditMode && (
                  <button
                    onClick={() => {
                      setSearchOpen((prev) => !prev)
                      if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 0)
                      else setSearchQuery('')
                    }}
                    className={`
                      flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150
                      ${searchOpen
                        ? 'text-cyan-400 bg-cyan-500/10'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                      }
                    `}
                    title="Search (Ctrl+F)"
                  >
                    <Search size={15} />
                  </button>
                )}

                <button
                  onClick={handleCopy}
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150
                    ${copied
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }
                  `}
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </>
            )}

            {/* Env tab buttons */}
            {activeTab === 'env' && !envLoading && (
              <>
                <button
                  onClick={() => {
                    if (envEditMode) setEnvEditMode(false)
                    else { setEnvEditMode(true); setEnvContent(envContent || '') }
                  }}
                  className={`
                    flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors duration-150
                    ${envEditMode
                      ? 'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }
                  `}
                  title={envEditMode ? 'Switch to view mode' : 'Switch to edit mode'}
                >
                  <Pencil size={13} />
                  <span>{envEditMode ? 'Editing' : 'Edit'}</span>
                </button>

                {envEditMode && (
                  <button
                    onClick={handleSaveEnv}
                    disabled={savingEnv}
                    className={`
                      flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors duration-150
                      ${savingEnv
                        ? 'text-slate-500 cursor-not-allowed'
                        : 'text-emerald-400 hover:bg-emerald-500/10'
                      }
                    `}
                    title="Save .env file"
                  >
                    {savingEnv ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    <span>Save</span>
                  </button>
                )}
              </>
            )}

            {/* Close */}
            <button
              onClick={safeClose}
              className="
                flex items-center justify-center w-9 h-9 rounded-lg
                text-slate-500 hover:text-slate-200 hover:bg-white/5
                transition-colors duration-150 ml-1
              "
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Validation result bar — compact status, scrollable only for errors */}
        {activeTab === 'compose' && composeEditMode && validationResult && (
          <div className={`
            flex items-start gap-2 px-6 py-2 border-b border-white/5 shrink-0 text-xs
            ${!validationResult.valid
              ? 'bg-rose-500/[0.06] text-rose-400'
              : validationResult.hasLintWarnings
                ? 'bg-amber-500/[0.06] text-amber-400'
                : 'bg-emerald-500/[0.06] text-emerald-400'
            }
          `}>
            {!validationResult.valid ? (
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            ) : validationResult.hasLintWarnings ? (
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            ) : (
              <CheckCircle size={14} className="shrink-0 mt-0.5" />
            )}
            {!validationResult.valid ? (
              <pre className="flex-1 whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto scrollbar-thin">
                {validationResult.output}
              </pre>
            ) : (
              <span className="text-xs font-medium">
                {validationResult.hasLintWarnings
                  ? 'Valid compose — review lint warnings below'
                  : 'Valid compose file'}
              </span>
            )}
          </div>
        )}

        {/* Search bar (compose view mode only) */}
        {activeTab === 'compose' && !composeEditMode && searchOpen && (
          <div className="flex items-center gap-2 px-6 py-2.5 border-b border-white/5 bg-slate-900/50 shrink-0">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
            />
            {searchQuery && (
              <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                {totalMatches > 0 ? `${activeMatchIndex + 1} / ${totalMatches}` : 'No results'}
              </span>
            )}
            {totalMatches > 1 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setActiveMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches)}
                  className="flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 text-xs transition-colors"
                >
                  &#x2191;
                </button>
                <button
                  onClick={() => setActiveMatchIndex((prev) => (prev + 1) % totalMatches)}
                  className="flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 text-xs transition-colors"
                >
                  &#x2193;
                </button>
              </div>
            )}
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery('') }}
              className="flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === 'compose' && renderComposeTab()}
          {activeTab === 'env' && renderEnvTab()}
          {activeTab === 'annotations' && renderAnnotationsTab()}
          {activeTab === 'history' && renderHistoryTab()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-2.5 border-t border-white/5 shrink-0 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 font-mono">
              {activeTab === 'compose' && (
                <>{(composeEditMode ? composeContent : originalCompose).split('\n').length} lines</>
              )}
              {activeTab === 'env' && (
                <>{(envEditMode ? envContent : originalEnv).split('\n').length} lines</>
              )}
              {activeTab === 'annotations' && (
                <>Labels &amp; metadata</>
              )}
            </span>
            {/* Lint counts — hoverable with full diagnostic list */}
            {(() => {
              const diags = activeTab === 'compose' ? composeDiagnostics : activeTab === 'env' ? envDiagnostics : []
              const counts = activeTab === 'compose' ? composeCounts : envCounts
              const content = activeTab === 'compose' ? composeContent : envContent
              if (!content) return null
              return (
                <span className="relative group/lint cursor-default flex items-center gap-2">
                  {diags.length === 0 ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Lint OK</span>
                  ) : (
                    <>
                      {counts.errors > 0 && <span className="flex items-center gap-1 text-[10px] font-medium text-rose-400"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />{counts.errors} error{counts.errors !== 1 ? 's' : ''}</span>}
                      {counts.warnings > 0 && <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{counts.warnings} warning{counts.warnings !== 1 ? 's' : ''}</span>}
                      {counts.info > 0 && <span className="flex items-center gap-1 text-[10px] font-medium text-cyan-400"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />{counts.info} info</span>}
                    </>
                  )}
                  {/* Hover tooltip with full diagnostic list */}
                  {diags.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover/lint:block z-50 animate-fade-in pointer-events-none" style={{ width: '400px', maxHeight: '300px' }}>
                      <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40 p-3 overflow-y-auto max-h-[300px] scrollbar-thin">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
                          {activeTab === 'compose' ? 'Compose' : '.env'} Diagnostics ({diags.length})
                        </p>
                        <div className="space-y-1.5">
                          {diags.slice(0, 20).map((d, di) => (
                            <div key={di} className="flex items-start gap-2 text-[11px]">
                              <span className={`shrink-0 mt-0.5 ${d.severity === 'error' ? 'text-rose-400' : d.severity === 'warning' ? 'text-amber-400' : 'text-cyan-400'}`}>
                                {d.severity === 'error' ? '●' : d.severity === 'warning' ? '▲' : 'ℹ'}
                              </span>
                              <span className="text-slate-500 tabular-nums shrink-0">L{d.line}</span>
                              <span className="text-slate-300">{d.message}</span>
                            </div>
                          ))}
                          {diags.length > 20 && <p className="text-[10px] text-slate-500">+{diags.length - 20} more...</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </span>
              )
            })()}
            {activeTab === 'compose' && hasComposeChanges && composeEditMode && (
              <span className="text-[10px] text-amber-400/70 font-medium px-2 py-0.5 rounded bg-amber-500/10">
                UNSAVED CHANGES
              </span>
            )}
            {activeTab === 'env' && hasEnvChanges && envEditMode && (
              <span className="text-[10px] text-amber-400/70 font-medium px-2 py-0.5 rounded bg-amber-500/10">
                UNSAVED CHANGES
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {(composeEditMode || envEditMode) && (
              <span className="text-[11px] text-amber-500/70 font-medium">EDITING</span>
            )}
            <span className="text-[11px] text-slate-500">
              {activeTab === 'compose' ? 'YAML' : activeTab === 'env' ? 'ENV' : 'META'}
            </span>
            <span className="text-[10px] text-slate-700">
              Press <kbd className="px-1 py-0.5 rounded bg-white/[0.06] border border-white/10 text-slate-500 font-mono text-[9px]">Esc</kbd> to close
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
