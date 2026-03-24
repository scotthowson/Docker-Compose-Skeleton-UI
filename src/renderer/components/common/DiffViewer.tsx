// =============================================================================
// DiffViewer — Reusable unified/split diff viewer with LCS-based comparison
// =============================================================================

import React, { useMemo, useState } from 'react'

interface DiffViewerProps {
  oldText: string
  newText: string
  oldLabel?: string
  newLabel?: string
  language?: string
}

type DiffLineType = 'add' | 'del' | 'same'

interface DiffLine {
  type: DiffLineType
  oldNum: number | null
  newNum: number | null
  content: string
}

// ---------------------------------------------------------------------------
// LCS-based diff algorithm
// ---------------------------------------------------------------------------

function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp
}

function buildDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const dp = computeLCS(oldLines, newLines)
  const result: DiffLine[] = []

  let i = oldLines.length
  let j = newLines.length

  // Backtrack through the LCS table
  const stack: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: 'same', oldNum: i, newNum: j, content: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', oldNum: null, newNum: j, content: newLines[j - 1] })
      j--
    } else {
      stack.push({ type: 'del', oldNum: i, newNum: null, content: oldLines[i - 1] })
      i--
    }
  }

  // Reverse since we built it backwards
  for (let k = stack.length - 1; k >= 0; k--) {
    result.push(stack[k])
  }

  return result
}

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

const lineStyles: Record<DiffLineType, string> = {
  add: 'bg-emerald-500/10 border-l-2 border-emerald-500',
  del: 'bg-rose-500/10 border-l-2 border-rose-500',
  same: 'border-l-2 border-transparent',
}

const markerMap: Record<DiffLineType, string> = {
  add: '+',
  del: '-',
  same: ' ',
}

const markerColor: Record<DiffLineType, string> = {
  add: 'text-emerald-400',
  del: 'text-rose-400',
  same: 'text-slate-500',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DiffViewer({
  oldText,
  newText,
  oldLabel = 'Before',
  newLabel = 'After',
  language,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')

  const { lines, additions, deletions } = useMemo(() => {
    const oldLines = oldText.split('\n')
    const newLines = newText.split('\n')
    const diffLines = buildDiff(oldLines, newLines)

    let adds = 0
    let dels = 0
    for (const line of diffLines) {
      if (line.type === 'add') adds++
      if (line.type === 'del') dels++
    }

    return { lines: diffLines, additions: adds, deletions: dels }
  }, [oldText, newText])

  // Build split-view data: pair deletions with additions where possible
  const splitData = useMemo(() => {
    const left: (DiffLine | null)[] = []
    const right: (DiffLine | null)[] = []

    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (line.type === 'same') {
        left.push(line)
        right.push(line)
        i++
      } else {
        // Collect consecutive del/add runs
        const dels: DiffLine[] = []
        const adds: DiffLine[] = []
        while (i < lines.length && lines[i].type === 'del') {
          dels.push(lines[i])
          i++
        }
        while (i < lines.length && lines[i].type === 'add') {
          adds.push(lines[i])
          i++
        }

        const maxLen = Math.max(dels.length, adds.length)
        for (let k = 0; k < maxLen; k++) {
          left.push(k < dels.length ? dels[k] : null)
          right.push(k < adds.length ? adds[k] : null)
        }
      }
    }

    return { left, right }
  }, [lines])

  return (
    <div className="glass rounded-xl overflow-hidden border border-white/5">
      {/* Header */}
      <div className="bg-slate-800/60 px-4 py-2 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-300">
            {oldLabel} → {newLabel}
          </span>
          {language && (
            <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
              {language}
            </span>
          )}
          <span className="text-xs text-slate-500">
            <span className="text-emerald-400">{additions} addition{additions !== 1 ? 's' : ''}</span>
            {', '}
            <span className="text-rose-400">{deletions} deletion{deletions !== 1 ? 's' : ''}</span>
          </span>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-slate-700/40 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('unified')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === 'unified'
                ? 'bg-slate-600/80 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              viewMode === 'split'
                ? 'bg-slate-600/80 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Split
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-auto max-h-[32rem] scrollbar-thin">
        {viewMode === 'unified' ? (
          <table className="w-full font-mono text-sm border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className={lineStyles[line.type]}>
                  <td className="text-slate-500 text-xs w-10 text-right pr-1 select-none align-top py-px">
                    {line.oldNum ?? ''}
                  </td>
                  <td className="text-slate-500 text-xs w-10 text-right pr-2 select-none align-top py-px">
                    {line.newNum ?? ''}
                  </td>
                  <td className={`w-4 text-center select-none align-top py-px ${markerColor[line.type]}`}>
                    {markerMap[line.type]}
                  </td>
                  <td className="text-slate-200 whitespace-pre py-px pr-4">
                    {line.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex">
            {/* Left (old) */}
            <div className="w-1/2 border-r border-white/5">
              <table className="w-full font-mono text-sm border-collapse">
                <tbody>
                  {splitData.left.map((line, idx) => (
                    <tr
                      key={idx}
                      className={line ? lineStyles[line.type === 'add' ? 'same' : line.type] : ''}
                    >
                      <td className="text-slate-500 text-xs w-10 text-right pr-2 select-none align-top py-px">
                        {line?.oldNum ?? ''}
                      </td>
                      <td className="text-slate-200 whitespace-pre py-px pr-4">
                        {line?.type === 'del' || line?.type === 'same' ? line.content : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Right (new) */}
            <div className="w-1/2">
              <table className="w-full font-mono text-sm border-collapse">
                <tbody>
                  {splitData.right.map((line, idx) => (
                    <tr
                      key={idx}
                      className={line ? lineStyles[line.type === 'del' ? 'same' : line.type] : ''}
                    >
                      <td className="text-slate-500 text-xs w-10 text-right pr-2 select-none align-top py-px">
                        {line?.newNum ?? ''}
                      </td>
                      <td className="text-slate-200 whitespace-pre py-px pr-4">
                        {line?.type === 'add' || line?.type === 'same' ? line.content : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
