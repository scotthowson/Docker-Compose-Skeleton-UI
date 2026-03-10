// =============================================================================
// ComposeViewer — Dual-mode YAML compose editor with syntax highlighting,
// in-file search, validation, diff view, and stack .env tab
// =============================================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Copy,
  Check,
  Search,
  FileCode2,
  Pencil,
  Save,
  CheckCircle,
  AlertTriangle,
  GitCompare,
  FileText,
} from 'lucide-react'
import {
  validateStackCompose,
  saveStackCompose,
  fetchStackEnv,
  saveStackEnv,
} from '../../api/endpoints'
import { useToast } from '../common/Toast'
import type { ComposeValidateResponse, StackEnvResponse } from '../../../shared/types'

interface ComposeViewerProps {
  stackName: string
  content?: string
  onClose: () => void
}

/** Default placeholder when no content is supplied */
function defaultPlaceholder(stackName: string): string {
  return `# docker-compose.yml \u2014 ${stackName}
# Compose file viewer coming soon
# This feature requires the /stacks/:name/compose API endpoint
version: '3'
services:
  # Stack services will appear here`
}

// ---------------------------------------------------------------------------
// YAML syntax highlighting
// ---------------------------------------------------------------------------

interface HighlightedSegment {
  text: string
  className: string
}

/** Tokenize a single YAML line into highlighted segments */
function highlightYamlLine(line: string): HighlightedSegment[] {
  // Empty or whitespace-only line
  if (line.trim() === '') {
    return [{ text: line, className: 'text-slate-300' }]
  }

  // Full-line comment (possibly indented)
  const commentMatch = line.match(/^(\s*)(#.*)$/)
  if (commentMatch) {
    return [
      { text: commentMatch[1], className: 'text-slate-300' },
      { text: commentMatch[2], className: 'text-slate-500 italic' },
    ]
  }

  const segments: HighlightedSegment[] = []

  // Key-value line: `  key: value` or `  key:`
  const kvMatch = line.match(/^(\s*)([\w./-][\w./ -]*)(:)(.*)$/)
  if (kvMatch) {
    const [, indent, key, colon, rest] = kvMatch
    if (indent) segments.push({ text: indent, className: 'text-slate-300' })
    segments.push({ text: key, className: 'text-cyan-400' })
    segments.push({ text: colon, className: 'text-slate-500' })

    if (rest) {
      highlightValue(rest, segments)
    }
    return segments
  }

  // List item line: `  - value`
  const listMatch = line.match(/^(\s*)(-)(\s)(.*)$/)
  if (listMatch) {
    const [, indent, dash, space, value] = listMatch
    if (indent) segments.push({ text: indent, className: 'text-slate-300' })
    segments.push({ text: dash, className: 'text-slate-500' })
    segments.push({ text: space, className: 'text-slate-300' })

    // List item might itself be a key: value
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

  // Fallback: treat entire line as plain text
  segments.push({ text: line, className: 'text-slate-300' })
  return segments
}

/** Highlight a YAML value portion (after the colon, or a list item value) */
function highlightValue(
  raw: string,
  segments: HighlightedSegment[],
  stripLeadingSpace = false,
): void {
  // Inline comment
  const commentIdx = raw.indexOf(' #')
  let value = commentIdx >= 0 ? raw.slice(0, commentIdx) : raw
  const comment = commentIdx >= 0 ? raw.slice(commentIdx) : ''

  // Leading space before value
  const leadingMatch = value.match(/^(\s+)(.*)$/)
  let leading = ''
  if (leadingMatch) {
    leading = leadingMatch[1]
    value = leadingMatch[2]
  }

  if (leading && !stripLeadingSpace) {
    segments.push({ text: leading, className: 'text-slate-300' })
  } else if (leading && stripLeadingSpace) {
    // We added a space prefix in the list-item branch; strip it
    segments.push({ text: leading.slice(1), className: 'text-slate-300' })
  }

  if (value === '') {
    // Nothing after colon
  } else if (/^(true|false|yes|no|on|off)$/i.test(value)) {
    // Boolean
    segments.push({ text: value, className: 'text-rose-400' })
  } else if (/^-?\d[\d_.]*$/.test(value)) {
    // Number
    segments.push({ text: value, className: 'text-amber-400' })
  } else if (/^null$/i.test(value)) {
    // Null
    segments.push({ text: value, className: 'text-slate-500 italic' })
  } else if (/^['"].*['"]$/.test(value)) {
    // Quoted string
    segments.push({ text: value, className: 'text-emerald-400' })
  } else if (value.startsWith('${') || value.includes('${')) {
    // Variable interpolation — highlight the whole thing as a string
    segments.push({ text: value, className: 'text-emerald-400' })
  } else {
    // Unquoted string value
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

interface DiffResult {
  left: DiffLine[]
  right: DiffLine[]
}

/** Simple line-by-line comparison producing side-by-side diff */
function computeDiff(original: string, edited: string): DiffResult {
  const origLines = original.split('\n')
  const editLines = edited.split('\n')

  const left: DiffLine[] = []
  const right: DiffLine[] = []

  // Use longest common subsequence (LCS) approach for better diffs
  const m = origLines.length
  const n = editLines.length

  // Build LCS table
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

  // Backtrack to build diff
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

  // Convert ops to side-by-side lines
  for (const op of diffOps) {
    if (op.type === 'same') {
      left.push({ type: 'same', content: origLines[op.origIdx!], lineNumber: op.origIdx! + 1 })
      right.push({ type: 'same', content: editLines[op.editIdx!], lineNumber: op.editIdx! + 1 })
    } else if (op.type === 'removed') {
      left.push({ type: 'removed', content: origLines[op.origIdx!], lineNumber: op.origIdx! + 1 })
      right.push({ type: 'removed', content: '', lineNumber: null })
    } else {
      left.push({ type: 'added', content: '', lineNumber: null })
      right.push({ type: 'added', content: editLines[op.editIdx!], lineNumber: op.editIdx! + 1 })
    }
  }

  return { left, right }
}

// ---------------------------------------------------------------------------
// ComposeViewer component
// ---------------------------------------------------------------------------

export function ComposeViewer({ stackName, content, onClose }: ComposeViewerProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const codeContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { addToast } = useToast()

  // Existing state
  const [copied, setCopied] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [validationResult, setValidationResult] = useState<{ valid: boolean; output: string } | null>(null)
  const [validating, setValidating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDiff, setShowDiff] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState<'compose' | 'env'>('compose')

  // Env state
  const [envContent, setEnvContent] = useState<string | null>(null)
  const [envLoading, setEnvLoading] = useState(false)
  const [envEditContent, setEnvEditContent] = useState('')
  const [envSaving, setEnvSaving] = useState(false)
  const [envEditMode, setEnvEditMode] = useState(false)
  const [envError, setEnvError] = useState<string | null>(null)

  const yaml = content ?? defaultPlaceholder(stackName)
  const lines = useMemo(() => yaml.split('\n'), [yaml])

  // ---- Load .env when tab switches ----
  useEffect(() => {
    if (activeTab === 'env' && envContent === null && !envLoading) {
      setEnvLoading(true)
      setEnvError(null)
      fetchStackEnv(stackName)
        .then((res: StackEnvResponse) => {
          setEnvContent(res.raw)
          setEnvEditContent(res.raw)
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to load .env'
          setEnvError(msg)
          setEnvContent('')
          setEnvEditContent('')
        })
        .finally(() => setEnvLoading(false))
    }
  }, [activeTab, stackName, envContent, envLoading])

  // ---- Initialize edit content when entering edit mode ----
  useEffect(() => {
    if (editMode) {
      setEditContent(yaml)
      setValidationResult(null)
      setShowDiff(false)
    }
  }, [editMode, yaml])

  // ---- Search logic ----
  /** Map of line index -> array of match ranges for the current search query */
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return new Map<number, { start: number; end: number }[]>()

    const query = searchQuery.toLowerCase()
    const result = new Map<number, { start: number; end: number }[]>()

    lines.forEach((line, lineIdx) => {
      const lower = line.toLowerCase()
      const ranges: { start: number; end: number }[] = []
      let pos = 0
      while (pos < lower.length) {
        const idx = lower.indexOf(query, pos)
        if (idx === -1) break
        ranges.push({ start: idx, end: idx + query.length })
        pos = idx + 1
      }
      if (ranges.length > 0) {
        result.set(lineIdx, ranges)
      }
    })

    return result
  }, [lines, searchQuery])

  /** Flat list of all match positions: [lineIdx, rangeIdx] */
  const allMatches = useMemo(() => {
    const flat: { line: number; rangeIdx: number }[] = []
    searchMatches.forEach((ranges, lineIdx) => {
      ranges.forEach((_, rangeIdx) => {
        flat.push({ line: lineIdx, rangeIdx })
      })
    })
    flat.sort((a, b) => a.line - b.line || a.rangeIdx - b.rangeIdx)
    return flat
  }, [searchMatches])

  const totalMatches = allMatches.length

  // Reset active match when query changes
  useEffect(() => {
    setActiveMatchIndex(0)
  }, [searchQuery])

  // Scroll active match into view
  useEffect(() => {
    if (totalMatches === 0 || !codeContainerRef.current) return
    const activeLine = allMatches[activeMatchIndex]?.line
    if (activeLine == null) return

    const lineEl = codeContainerRef.current.querySelector(
      `[data-line-index="${activeLine}"]`,
    )
    if (lineEl) {
      lineEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeMatchIndex, allMatches, totalMatches])

  // ---- Keyboard handlers ----
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false)
          setSearchQuery('')
        } else if (editMode) {
          setEditMode(false)
          setShowDiff(false)
          setValidationResult(null)
        } else {
          onClose()
        }
        return
      }

      // Ctrl+F / Cmd+F opens search (only in view mode for compose tab)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !editMode) {
        e.preventDefault()
        setSearchOpen(true)
        // Focus the search input after render
        setTimeout(() => searchInputRef.current?.focus(), 0)
        return
      }

      // Ctrl+S / Cmd+S to save in edit mode
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (editMode && validationResult?.valid) {
          e.preventDefault()
          handleSave()
        } else if (envEditMode && activeTab === 'env') {
          e.preventDefault()
          handleEnvSave()
        }
        return
      }

      // Enter/Shift+Enter to navigate matches
      if (searchOpen && e.key === 'Enter' && totalMatches > 0) {
        e.preventDefault()
        if (e.shiftKey) {
          setActiveMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches)
        } else {
          setActiveMatchIndex((prev) => (prev + 1) % totalMatches)
        }
      }
    },
    [onClose, searchOpen, totalMatches, editMode, validationResult, envEditMode, activeTab],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ---- Backdrop click ----
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose],
  )

  // ---- Copy to clipboard ----
  const handleCopy = useCallback(async () => {
    try {
      const textToCopy = editMode ? editContent : yaml
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may fail in some environments — ignore silently
    }
  }, [yaml, editMode, editContent])

  // ---- Validate compose ----
  const handleValidate = useCallback(async () => {
    setValidating(true)
    try {
      const res: ComposeValidateResponse = await validateStackCompose(stackName, editContent)
      setValidationResult({ valid: res.valid, output: res.output })
      if (res.valid) {
        addToast({ type: 'success', message: 'Compose file is valid' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Validation failed'
      setValidationResult({ valid: false, output: msg })
    } finally {
      setValidating(false)
    }
  }, [stackName, editContent, addToast])

  // ---- Save compose ----
  const handleSave = useCallback(async () => {
    if (!validationResult?.valid) return
    setSaving(true)
    try {
      await saveStackCompose(stackName, editContent)
      addToast({ type: 'success', message: `Compose file saved for ${stackName}` })
      setEditMode(false)
      setShowDiff(false)
      setValidationResult(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      addToast({ type: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }, [stackName, editContent, validationResult, addToast])

  // ---- Save env ----
  const handleEnvSave = useCallback(async () => {
    setEnvSaving(true)
    try {
      await saveStackEnv(stackName, envEditContent)
      setEnvContent(envEditContent)
      addToast({ type: 'success', message: `.env saved for ${stackName}` })
      setEnvEditMode(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      addToast({ type: 'error', message: msg })
    } finally {
      setEnvSaving(false)
    }
  }, [stackName, envEditContent, addToast])

  // ---- Diff computation ----
  const diff = useMemo(() => {
    if (!showDiff) return null
    return computeDiff(yaml, editContent)
  }, [showDiff, yaml, editContent])

  // ---- Pretty stack name ----
  const formattedName = stackName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  // ---- Determine which line the active match is on ----
  const activeMatchLine = totalMatches > 0 ? allMatches[activeMatchIndex]?.line : -1

  // Build a set of lines that have *any* match for the highlight background
  const matchedLineSet = useMemo(() => {
    const s = new Set<number>()
    searchMatches.forEach((_, lineIdx) => s.add(lineIdx))
    return s
  }, [searchMatches])

  // ---- Clear edit/validation state when switching tabs ----
  const switchTab = useCallback((tab: 'compose' | 'env') => {
    if (tab === activeTab) return
    // Exit edit modes when switching
    if (editMode) {
      setEditMode(false)
      setShowDiff(false)
      setValidationResult(null)
    }
    if (envEditMode) {
      setEnvEditMode(false)
    }
    setSearchOpen(false)
    setSearchQuery('')
    setActiveTab(tab)
  }, [activeTab, editMode, envEditMode])

  // ---- Reset validation when edit content changes ----
  useEffect(() => {
    if (editMode) {
      setValidationResult(null)
    }
  }, [editContent])

  // ---- Render highlighted line with search overlays ----
  function renderLine(line: string, lineIdx: number) {
    const highlighted = highlightYamlLine(line)
    const lineMatches = searchMatches.get(lineIdx)
    const isActiveMatchLine = lineIdx === activeMatchLine

    // If no search matches on this line, render normally
    if (!lineMatches || lineMatches.length === 0) {
      return (
        <span>
          {highlighted.map((seg, i) => (
            <span key={i} className={seg.className}>
              {seg.text}
            </span>
          ))}
        </span>
      )
    }

    // Build character-level highlight map for search matches on this line
    // We render the syntax-highlighted segments but wrap matched characters in a highlight span
    const charHighlights = new Array<{ active: boolean; match: boolean }>(line.length)
    for (let i = 0; i < line.length; i++) {
      charHighlights[i] = { active: false, match: false }
    }

    // Determine which range is the "active" one on this line
    let activeRangeOnLine = -1
    if (isActiveMatchLine) {
      activeRangeOnLine = allMatches[activeMatchIndex]?.rangeIdx ?? -1
    }

    lineMatches.forEach((range, rangeIdx) => {
      for (let i = range.start; i < range.end; i++) {
        charHighlights[i] = {
          match: true,
          active: isActiveMatchLine && rangeIdx === activeRangeOnLine,
        }
      }
    })

    // Re-render syntax segments with match overlays
    let charPos = 0
    return (
      <span>
        {highlighted.map((seg, segIdx) => {
          const segStart = charPos
          charPos += seg.text.length

          // Check if any character in this segment has a match
          let hasMatch = false
          for (let i = segStart; i < charPos; i++) {
            if (charHighlights[i]?.match) {
              hasMatch = true
              break
            }
          }

          if (!hasMatch) {
            return (
              <span key={segIdx} className={seg.className}>
                {seg.text}
              </span>
            )
          }

          // Split segment into sub-spans for matched / unmatched characters
          const subSpans: { text: string; match: boolean; active: boolean }[] = []
          let cur = { text: '', match: charHighlights[segStart]?.match ?? false, active: charHighlights[segStart]?.active ?? false }

          for (let i = segStart; i < segStart + seg.text.length; i++) {
            const ch = charHighlights[i] ?? { match: false, active: false }
            if (ch.match === cur.match && ch.active === cur.active) {
              cur.text += seg.text[i - segStart]
            } else {
              if (cur.text) subSpans.push({ ...cur })
              cur = { text: seg.text[i - segStart], match: ch.match, active: ch.active }
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
                      className={`
                        rounded-sm px-[1px] -mx-[1px]
                        ${sub.active
                          ? 'bg-amber-400/30 ring-1 ring-amber-400/60 text-white'
                          : 'bg-amber-400/15 text-white'
                        }
                      `}
                    >
                      {sub.text}
                    </span>
                  )
                }
                return (
                  <span key={si} className={seg.className}>
                    {sub.text}
                  </span>
                )
              })}
            </span>
          )
        })}
      </span>
    )
  }

  // ---- Render diff view ----
  function renderDiffView() {
    if (!diff) return null

    return (
      <div className="overflow-y-auto max-h-[70vh] scrollbar-thin">
        <div className="flex font-mono text-sm leading-relaxed">
          {/* Left side — original */}
          <div className="flex-1 border-r border-white/[0.06]">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/[0.06] bg-slate-900/50 font-sans font-medium">
              Original
            </div>
            <div className="bg-slate-950">
              {diff.left.map((dl, idx) => (
                <div
                  key={idx}
                  className={`
                    flex px-3 min-h-[1.625rem]
                    ${dl.type === 'removed'
                      ? 'bg-rose-500/10'
                      : dl.type === 'added'
                        ? 'bg-transparent'
                        : 'hover:bg-white/[0.02]'
                    }
                  `}
                >
                  <span className="inline-block w-8 shrink-0 text-right pr-3 py-[1px] text-slate-600 select-none tabular-nums text-xs leading-relaxed">
                    {dl.lineNumber ?? ''}
                  </span>
                  <span className={`flex-1 py-[1px] whitespace-pre overflow-x-auto ${
                    dl.type === 'removed' ? 'text-rose-300' : 'text-slate-300'
                  }`}>
                    {dl.content}
                  </span>
                </div>
              ))}
              <div className="h-4" />
            </div>
          </div>

          {/* Right side — edited */}
          <div className="flex-1">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/[0.06] bg-slate-900/50 font-sans font-medium">
              Edited
            </div>
            <div className="bg-slate-950">
              {diff.right.map((dl, idx) => (
                <div
                  key={idx}
                  className={`
                    flex px-3 min-h-[1.625rem]
                    ${dl.type === 'added'
                      ? 'bg-emerald-500/10'
                      : dl.type === 'removed'
                        ? 'bg-transparent'
                        : 'hover:bg-white/[0.02]'
                    }
                  `}
                >
                  <span className="inline-block w-8 shrink-0 text-right pr-3 py-[1px] text-slate-600 select-none tabular-nums text-xs leading-relaxed">
                    {dl.lineNumber ?? ''}
                  </span>
                  <span className={`flex-1 py-[1px] whitespace-pre overflow-x-auto ${
                    dl.type === 'added' ? 'text-emerald-300' : 'text-slate-300'
                  }`}>
                    {dl.content}
                  </span>
                </div>
              ))}
              <div className="h-4" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- Render .env tab content ----
  function renderEnvTab() {
    if (envLoading) {
      return (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
            Loading .env...
          </div>
        </div>
      )
    }

    if (envError) {
      return (
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle size={16} />
            {envError}
          </div>
        </div>
      )
    }

    if (envEditMode) {
      return (
        <div className="overflow-y-auto max-h-[70vh] scrollbar-thin">
          <textarea
            value={envEditContent}
            onChange={(e) => setEnvEditContent(e.target.value)}
            className="w-full h-full bg-slate-950 text-slate-200 font-mono text-sm p-5 resize-none focus:outline-none"
            style={{ minHeight: '60vh' }}
            spellCheck={false}
          />
        </div>
      )
    }

    // Read-only view of .env with basic highlighting
    const envLines = (envContent ?? '').split('\n')
    return (
      <div className="overflow-y-auto max-h-[70vh] scrollbar-thin">
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
              // Try to split on first =
              const eqIdx = line.indexOf('=')
              if (eqIdx > 0) {
                const key = line.slice(0, eqIdx)
                const val = line.slice(eqIdx)
                rendered = (
                  <span>
                    <span className="text-cyan-400">{key}</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-emerald-400">{val.slice(1)}</span>
                  </span>
                )
              } else {
                rendered = <span className="text-slate-300">{line}</span>
              }
            }

            return (
              <div
                key={idx}
                className="flex px-5 hover:bg-white/[0.02]"
              >
                <span className="inline-block w-10 shrink-0 text-right pr-4 py-[1px] text-slate-600 select-none tabular-nums text-xs leading-relaxed">
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

  // ---- Render compose tab content ----
  function renderComposeTab() {
    // Diff view
    if (editMode && showDiff) {
      return renderDiffView()
    }

    // Edit mode — textarea
    if (editMode) {
      return (
        <div className="overflow-y-auto max-h-[70vh] scrollbar-thin">
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full bg-slate-950 text-slate-200 font-mono text-sm p-5 resize-none focus:outline-none"
            style={{ minHeight: '60vh' }}
            spellCheck={false}
          />
        </div>
      )
    }

    // View mode — syntax-highlighted read-only view
    return (
      <div
        ref={codeContainerRef}
        className="overflow-y-auto max-h-[70vh] scrollbar-thin"
      >
        <div className="bg-slate-950 font-mono text-sm leading-relaxed">
          {lines.map((line, idx) => {
            const isMatchedLine = matchedLineSet.has(idx)
            const isActiveLine = idx === activeMatchLine

            return (
              <div
                key={idx}
                data-line-index={idx}
                className={`
                  flex px-5 transition-colors duration-100
                  ${isActiveLine
                    ? 'bg-amber-400/[0.06]'
                    : isMatchedLine
                      ? 'bg-amber-400/[0.03]'
                      : 'hover:bg-white/[0.02]'
                  }
                `}
              >
                {/* Line number */}
                <span className="inline-block w-10 shrink-0 text-right pr-4 py-[1px] text-slate-600 select-none tabular-nums text-xs leading-relaxed">
                  {idx + 1}
                </span>

                {/* Line content */}
                <span className="flex-1 py-[1px] whitespace-pre overflow-x-auto">
                  {renderLine(line, idx)}
                </span>
              </div>
            )
          })}

          {/* Bottom padding for comfortable scrolling */}
          <div className="h-4" />
        </div>
      </div>
    )
  }

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="
        fixed inset-0 z-[9999]
        flex items-center justify-center
        bg-black/60 backdrop-blur-sm
        animate-fade-in
      "
    >
      <div
        className="
          relative
          w-full max-w-4xl mx-4
          bg-slate-950/95 backdrop-blur-xl
          border border-white/[0.06] rounded-2xl
          shadow-2xl shadow-black/50
          animate-fade-in
          flex flex-col
          max-h-[85vh]
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-viewer-title"
      >
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/20 shrink-0">
              {activeTab === 'compose' ? (
                <FileCode2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <FileText className="w-4 h-4 text-cyan-400" />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="compose-viewer-title"
                className="text-sm font-semibold text-slate-100 truncate"
              >
                {formattedName}
              </h2>
              <p className="text-[11px] text-slate-500 font-mono truncate">
                {activeTab === 'compose' ? 'docker-compose.yml' : '.env'}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-0.5 ml-3 bg-slate-900/60 rounded-lg p-0.5">
              <button
                onClick={() => switchTab('compose')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150
                  ${activeTab === 'compose'
                    ? 'bg-white/[0.08] text-slate-200'
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                <FileCode2 size={12} />
                Compose
              </button>
              <button
                onClick={() => switchTab('env')}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150
                  ${activeTab === 'env'
                    ? 'bg-white/[0.08] text-slate-200'
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                <FileText size={12} />
                .env
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* ---- Compose tab buttons ---- */}
            {activeTab === 'compose' && (
              <>
                {/* Edit / View toggle */}
                <button
                  onClick={() => {
                    if (editMode) {
                      setEditMode(false)
                      setShowDiff(false)
                      setValidationResult(null)
                    } else {
                      setEditMode(true)
                      setSearchOpen(false)
                      setSearchQuery('')
                    }
                  }}
                  className={`
                    flex items-center justify-center gap-1
                    h-8 px-2.5 rounded-lg
                    text-xs font-medium
                    transition-colors duration-150
                    ${editMode
                      ? 'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                    }
                  `}
                  title={editMode ? 'Switch to view mode' : 'Switch to edit mode'}
                  aria-label={editMode ? 'Switch to view mode' : 'Switch to edit mode'}
                >
                  <Pencil size={13} strokeWidth={2} />
                  <span>{editMode ? 'Editing' : 'Edit'}</span>
                </button>

                {/* Diff toggle (edit mode only) */}
                {editMode && (
                  <button
                    onClick={() => setShowDiff((prev) => !prev)}
                    className={`
                      flex items-center justify-center gap-1
                      h-8 px-2.5 rounded-lg
                      text-xs font-medium
                      transition-colors duration-150
                      ${showDiff
                        ? 'text-violet-400 bg-violet-500/10 ring-1 ring-violet-500/20'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                      }
                    `}
                    title="Toggle diff view"
                    aria-label="Toggle diff view"
                  >
                    <GitCompare size={13} strokeWidth={2} />
                    <span>Diff</span>
                  </button>
                )}

                {/* Validate (edit mode only) */}
                {editMode && (
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className={`
                      flex items-center justify-center gap-1
                      h-8 px-2.5 rounded-lg
                      text-xs font-medium
                      transition-colors duration-150
                      ${validating
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                      }
                    `}
                    title="Validate compose file"
                    aria-label="Validate compose file"
                  >
                    {validating ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin" />
                    ) : (
                      <CheckCircle size={13} strokeWidth={2} />
                    )}
                    <span>Validate</span>
                  </button>
                )}

                {/* Save (edit mode only, disabled until validated) */}
                {editMode && (
                  <button
                    onClick={handleSave}
                    disabled={!validationResult?.valid || saving}
                    className={`
                      flex items-center justify-center gap-1
                      h-8 px-2.5 rounded-lg
                      text-xs font-medium
                      transition-colors duration-150
                      ${!validationResult?.valid || saving
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-emerald-400 hover:bg-emerald-500/10'
                      }
                    `}
                    title={!validationResult?.valid ? 'Validate first before saving' : 'Save compose file'}
                    aria-label="Save compose file"
                  >
                    {saving ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
                    ) : (
                      <Save size={13} strokeWidth={2} />
                    )}
                    <span>Save</span>
                  </button>
                )}

                {/* Search toggle (view mode only) */}
                {!editMode && (
                  <button
                    onClick={() => {
                      setSearchOpen((prev) => !prev)
                      if (!searchOpen) {
                        setTimeout(() => searchInputRef.current?.focus(), 0)
                      } else {
                        setSearchQuery('')
                      }
                    }}
                    className={`
                      flex items-center justify-center
                      w-8 h-8 rounded-lg
                      transition-colors duration-150
                      ${searchOpen
                        ? 'text-cyan-400 bg-cyan-500/10'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                      }
                    `}
                    title="Search (Ctrl+F)"
                    aria-label="Search within file"
                  >
                    <Search size={15} strokeWidth={2} />
                  </button>
                )}

                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  className={`
                    flex items-center justify-center
                    w-8 h-8 rounded-lg
                    transition-colors duration-150
                    ${copied
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                    }
                  `}
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                  aria-label="Copy to clipboard"
                >
                  {copied ? (
                    <Check size={15} strokeWidth={2} />
                  ) : (
                    <Copy size={15} strokeWidth={2} />
                  )}
                </button>
              </>
            )}

            {/* ---- .env tab buttons ---- */}
            {activeTab === 'env' && (
              <>
                {/* Edit / View toggle */}
                <button
                  onClick={() => {
                    if (envEditMode) {
                      setEnvEditMode(false)
                    } else {
                      setEnvEditMode(true)
                      setEnvEditContent(envContent ?? '')
                    }
                  }}
                  disabled={envLoading || envError !== null}
                  className={`
                    flex items-center justify-center gap-1
                    h-8 px-2.5 rounded-lg
                    text-xs font-medium
                    transition-colors duration-150
                    ${envLoading || envError !== null
                      ? 'text-slate-600 cursor-not-allowed'
                      : envEditMode
                        ? 'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                    }
                  `}
                  title={envEditMode ? 'Switch to view mode' : 'Switch to edit mode'}
                  aria-label={envEditMode ? 'Switch to view mode' : 'Switch to edit mode'}
                >
                  <Pencil size={13} strokeWidth={2} />
                  <span>{envEditMode ? 'Editing' : 'Edit'}</span>
                </button>

                {/* Save (edit mode only) */}
                {envEditMode && (
                  <button
                    onClick={handleEnvSave}
                    disabled={envSaving}
                    className={`
                      flex items-center justify-center gap-1
                      h-8 px-2.5 rounded-lg
                      text-xs font-medium
                      transition-colors duration-150
                      ${envSaving
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-emerald-400 hover:bg-emerald-500/10'
                      }
                    `}
                    title="Save .env file"
                    aria-label="Save .env file"
                  >
                    {envSaving ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
                    ) : (
                      <Save size={13} strokeWidth={2} />
                    )}
                    <span>Save</span>
                  </button>
                )}
              </>
            )}

            {/* Close button (always visible) */}
            <button
              onClick={onClose}
              className="
                flex items-center justify-center
                w-8 h-8 rounded-lg
                text-slate-500 hover:text-slate-300
                hover:bg-white/[0.06]
                transition-colors duration-150
              "
              aria-label="Close viewer"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ---- Validation result bar ---- */}
        {activeTab === 'compose' && editMode && validationResult && (
          <div className={`
            flex items-start gap-2 px-5 py-2.5 border-b border-white/[0.06] shrink-0 text-xs
            ${validationResult.valid
              ? 'bg-emerald-500/[0.06] text-emerald-400'
              : 'bg-rose-500/[0.06] text-rose-400'
            }
          `}>
            {validationResult.valid ? (
              <CheckCircle size={14} className="shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            )}
            <pre className="flex-1 whitespace-pre-wrap font-mono leading-relaxed">
              {validationResult.valid ? 'Valid compose file' : validationResult.output}
            </pre>
          </div>
        )}

        {/* ---- Search bar (compose view mode only) ---- */}
        {activeTab === 'compose' && !editMode && searchOpen && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.06] bg-slate-900/50 shrink-0">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="
                flex-1 bg-transparent text-sm text-slate-200
                placeholder-slate-600
                focus:outline-none
              "
            />
            {searchQuery && (
              <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                {totalMatches > 0
                  ? `${activeMatchIndex + 1} / ${totalMatches}`
                  : 'No results'
                }
              </span>
            )}
            {totalMatches > 1 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() =>
                    setActiveMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches)
                  }
                  className="
                    flex items-center justify-center w-6 h-6 rounded
                    text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]
                    text-xs transition-colors
                  "
                  aria-label="Previous match"
                >
                  &#x2191;
                </button>
                <button
                  onClick={() =>
                    setActiveMatchIndex((prev) => (prev + 1) % totalMatches)
                  }
                  className="
                    flex items-center justify-center w-6 h-6 rounded
                    text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]
                    text-xs transition-colors
                  "
                  aria-label="Next match"
                >
                  &#x2193;
                </button>
              </div>
            )}
            <button
              onClick={() => {
                setSearchOpen(false)
                setSearchQuery('')
              }}
              className="
                flex items-center justify-center w-6 h-6 rounded
                text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]
                transition-colors shrink-0
              "
              aria-label="Close search"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ---- Content area ---- */}
        {activeTab === 'compose' ? renderComposeTab() : renderEnvTab()}

        {/* ---- Footer ---- */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.06] shrink-0">
          <span className="text-[11px] text-slate-600 font-mono">
            {activeTab === 'compose'
              ? `${editMode ? editContent.split('\n').length : lines.length} line${(editMode ? editContent.split('\n').length : lines.length) !== 1 ? 's' : ''}`
              : envContent !== null
                ? `${(envEditMode ? envEditContent : envContent).split('\n').length} line${(envEditMode ? envEditContent : envContent).split('\n').length !== 1 ? 's' : ''}`
                : ''
            }
          </span>
          <div className="flex items-center gap-3">
            {activeTab === 'compose' && editMode && (
              <span className="text-[11px] text-amber-500/70 font-medium">
                EDITING
              </span>
            )}
            {activeTab === 'env' && envEditMode && (
              <span className="text-[11px] text-amber-500/70 font-medium">
                EDITING
              </span>
            )}
            <span className="text-[11px] text-slate-600">
              {activeTab === 'compose' ? 'YAML' : 'ENV'}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
