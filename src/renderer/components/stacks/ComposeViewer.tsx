// =============================================================================
// ComposeViewer — YAML compose file viewer with syntax highlighting and search
// =============================================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { X, Copy, Check, Search, FileCode2 } from 'lucide-react'

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
// ComposeViewer component
// ---------------------------------------------------------------------------

export function ComposeViewer({ stackName, content, onClose }: ComposeViewerProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const codeContainerRef = useRef<HTMLDivElement>(null)

  const [copied, setCopied] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)

  const yaml = content ?? defaultPlaceholder(stackName)
  const lines = useMemo(() => yaml.split('\n'), [yaml])

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
        } else {
          onClose()
        }
        return
      }

      // Ctrl+F / Cmd+F opens search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        // Focus the search input after render
        setTimeout(() => searchInputRef.current?.focus(), 0)
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
    [onClose, searchOpen, totalMatches],
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
      await navigator.clipboard.writeText(yaml)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may fail in some environments — ignore silently
    }
  }, [yaml])

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

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="
        fixed inset-0 z-50
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
              <FileCode2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <h2
                id="compose-viewer-title"
                className="text-sm font-semibold text-slate-100 truncate"
              >
                {formattedName}
              </h2>
              <p className="text-[11px] text-slate-500 font-mono truncate">
                docker-compose.yml
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Search toggle */}
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

            {/* Close button */}
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

        {/* ---- Search bar ---- */}
        {searchOpen && (
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

        {/* ---- Code area ---- */}
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

        {/* ---- Footer ---- */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.06] shrink-0">
          <span className="text-[11px] text-slate-600 font-mono">
            {lines.length} line{lines.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[11px] text-slate-600">
            YAML
          </span>
        </div>
      </div>
    </div>
  )
}
