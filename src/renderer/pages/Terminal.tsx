// =============================================================================
// Terminal — Host-level shell access with Linux authentication gate,
// command history, command queuing, quick commands, and auto-scrolling output
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  TerminalSquare, AlertTriangle, Play, Trash2, RefreshCw,
  Clock, Copy, Check, Shield, Lock, Loader2,
} from 'lucide-react'
import { execTerminalCommandAuth, terminalAuthVerify, terminalLogout } from '../api/endpoints'
import { useConnectionStore } from '../stores/connectionStore'
import { useSystemStore } from '../stores/systemStore'
import TerminalAuthGate from '../components/terminal/TerminalAuthGate'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandEntry {
  command: string
  cwd: string
  output: string
  exitCode: number
  success: boolean
  timestamp: string
}

// ---------------------------------------------------------------------------
// ANSI color parser — converts basic ANSI escape codes to styled spans
// ---------------------------------------------------------------------------

const ANSI_COLORS: Record<string, string> = {
  '30': 'color:#64748b', '31': 'color:#f87171', '32': 'color:#4ade80',
  '33': 'color:#fbbf24', '34': 'color:#60a5fa', '35': 'color:#c084fc',
  '36': 'color:#22d3ee', '37': 'color:#e2e8f0',
  '90': 'color:#94a3b8', '91': 'color:#fca5a5', '92': 'color:#86efac',
  '93': 'color:#fde68a', '94': 'color:#93c5fd', '95': 'color:#d8b4fe',
  '96': 'color:#67e8f9', '97': 'color:#f8fafc',
  '1': 'font-weight:bold', '2': 'opacity:0.7', '4': 'text-decoration:underline',
}

/** Escape HTML entities to prevent XSS from command output */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseAnsi(text: string): string {
  // SECURITY: Escape HTML FIRST to prevent XSS, then apply ANSI color spans
  const safe = escapeHtml(text)
  // eslint-disable-next-line no-control-regex
  return safe.replace(/\x1b\[([0-9;]*)m/g, (_match, codes: string) => {
    if (!codes || codes === '0') return '</span>'
    const styles = codes.split(';').map((c: string) => ANSI_COLORS[c]).filter(Boolean).join(';')
    return styles ? `<span style="${styles}">` : ''
  })
}

// ---------------------------------------------------------------------------
// Helper — shorten home directory in CWD to ~
// ---------------------------------------------------------------------------

function shortenCwd(fullCwd: string, user: string): string {
  const homePrefix = `/home/${user}`
  if (fullCwd === homePrefix) return '~'
  if (fullCwd.startsWith(homePrefix + '/')) return '~' + fullCwd.slice(homePrefix.length)
  if (fullCwd === '/root') return '~'
  if (fullCwd.startsWith('/root/')) return '~' + fullCwd.slice(5)
  return fullCwd
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Terminal() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const hostname = useSystemStore((s) => s.status?.hostname) || 'host'

  // Auth state
  const [authenticated, setAuthenticated] = useState(false)
  const [terminalToken, setTerminalToken] = useState('')
  const [terminalUser, setTerminalUser] = useState('')
  const [authChecking, setAuthChecking] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Terminal state
  const [commandInput, setCommandInput] = useState('')
  const [cwd, setCwd] = useState('~')
  const [entries, setEntries] = useState<CommandEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('terminal-history') || '[]') } catch { return [] }
  })
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [queueLength, setQueueLength] = useState(0)

  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<string[]>([])
  const loadingRef = useRef(false)

  // Keep loadingRef in sync
  useEffect(() => { loadingRef.current = loading }, [loading])

  // Auto-scroll to bottom on new output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [entries])

  // Check for saved terminal session on mount
  useEffect(() => {
    if (!isConnected) {
      setAuthChecking(false)
      return
    }

    const saved = sessionStorage.getItem('terminal-session')
    if (saved) {
      try {
        const { token, username } = JSON.parse(saved)
        if (token) {
          terminalAuthVerify(token).then((res) => {
            if (res.valid) {
              setTerminalToken(token)
              setTerminalUser(username || res.username)
              setAuthenticated(true)
            } else {
              sessionStorage.removeItem('terminal-session')
            }
          }).catch(() => {
            sessionStorage.removeItem('terminal-session')
          }).finally(() => setAuthChecking(false))
          return
        }
      } catch {
        sessionStorage.removeItem('terminal-session')
      }
    }
    setAuthChecking(false)
  }, [isConnected])

  // Focus input when authenticated
  useEffect(() => {
    if (authenticated) inputRef.current?.focus()
  }, [authenticated])

  // Fetch initial CWD on auth
  useEffect(() => {
    if (!authenticated || !terminalToken || !isConnected) return
    execTerminalCommandAuth('pwd', terminalToken).then((res) => {
      if (res.success && res.output.trim()) {
        setCwd(res.output.trim())
      }
    }).catch(() => {})
  }, [authenticated, terminalToken, isConnected])

  // ---------------------------------------------------------------------------
  // Auth handlers
  // ---------------------------------------------------------------------------

  const handleAuthenticated = (token: string, username: string) => {
    setTerminalToken(token)
    setTerminalUser(username)
    setAuthenticated(true)
    setSessionExpired(false)
  }

  const handleLock = async () => {
    if (terminalToken) {
      try { await terminalLogout(terminalToken) } catch { /* ignore */ }
    }
    sessionStorage.removeItem('terminal-session')
    setAuthenticated(false)
    setTerminalToken('')
    setTerminalUser('')
    setEntries([])
    setCwd('~')
    queueRef.current = []
    setQueueLength(0)
  }

  // ---------------------------------------------------------------------------
  // Execute command (with queuing support)
  // ---------------------------------------------------------------------------

  const executeCommand = useCallback(async (cmd?: string) => {
    const command = (cmd ?? commandInput).trim()
    if (!command) return

    // If already executing, queue the command instead of dropping it
    if (loadingRef.current) {
      queueRef.current.push(command)
      setQueueLength(queueRef.current.length)
      setCommandInput('')
      setHistoryIndex(-1)
      // Add to history
      setHistory(prev => {
        const filtered = prev.filter(h => h !== command)
        const next = [command, ...filtered].slice(0, 50)
        localStorage.setItem('terminal-history', JSON.stringify(next))
        return next
      })
      return
    }

    setLoading(true)
    setCommandInput('')
    setHistoryIndex(-1)

    // Add to history (dedup and cap at 50)
    setHistory(prev => {
      const filtered = prev.filter(h => h !== command)
      const next = [command, ...filtered].slice(0, 50)
      localStorage.setItem('terminal-history', JSON.stringify(next))
      return next
    })

    // Handle local "clear" command
    if (command === 'clear' || command === 'cls') {
      setEntries([])
      setLoading(false)
      inputRef.current?.focus()
      return
    }

    try {
      const result = await execTerminalCommandAuth(command, terminalToken, cwd === '~' ? undefined : cwd)
      const entry: CommandEntry = {
        command,
        cwd: result.cwd || cwd,
        output: result.output,
        exitCode: result.exit_code,
        success: result.success,
        timestamp: result.timestamp,
      }
      setEntries(prev => [...prev, entry])

      // Track CWD changes
      if (result.cwd) {
        setCwd(result.cwd)
      }
    } catch (err: unknown) {
      // Check for session expiry
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401) {
        setSessionExpired(true)
        setAuthenticated(false)
        sessionStorage.removeItem('terminal-session')
        return
      }

      setEntries(prev => [...prev, {
        command,
        cwd,
        output: err instanceof Error ? err.message : 'Command execution failed',
        exitCode: -1,
        success: false,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()

      // Process next queued command if any
      if (queueRef.current.length > 0) {
        const nextCmd = queueRef.current.shift()!
        setQueueLength(queueRef.current.length)
        setTimeout(() => executeCommand(nextCmd), 0)
      }
    }
  }, [commandInput, cwd, terminalToken])

  // ---------------------------------------------------------------------------
  // Keyboard handling
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      executeCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(newIndex)
        setCommandInput(history[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCommandInput(history[newIndex])
      } else {
        setHistoryIndex(-1)
        setCommandInput('')
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setEntries([])
    }
  }, [executeCommand, history, historyIndex])

  // ---------------------------------------------------------------------------
  // Copy output
  // ---------------------------------------------------------------------------

  const handleCopyOutput = (index: number) => {
    const entry = entries[index]
    if (entry) {
      navigator.clipboard.writeText(entry.output)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
  }

  // ---------------------------------------------------------------------------
  // Quick commands
  // ---------------------------------------------------------------------------

  const quickCommands = [
    { label: 'docker ps', cmd: 'docker ps', tip: 'List running containers' },
    { label: 'docker stats', cmd: 'docker stats --no-stream', tip: 'One-shot container resource usage' },
    { label: 'df -h', cmd: 'df -h', tip: 'Disk space usage (human-readable)' },
    { label: 'free -m', cmd: 'free -m', tip: 'Memory usage in megabytes' },
    { label: 'top (snapshot)', cmd: 'top -bn1 | head -20', tip: 'One-shot CPU/memory snapshot (top 20 lines)' },
    { label: 'uptime', cmd: 'uptime', tip: 'System uptime and load averages' },
    { label: 'whoami', cmd: 'whoami', tip: 'Current logged-in user' },
    { label: 'ls -la', cmd: 'ls -la', tip: 'Detailed directory listing' },
  ]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800/60 border border-white/5">
          <TerminalSquare size={28} className="text-slate-500" />
        </div>
        <p className="text-sm text-slate-500">Connect to a server to use the terminal</p>
      </div>
    )
  }

  // Checking auth
  if (authChecking) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-3">
        <RefreshCw size={20} className="text-slate-500 animate-spin" />
        <p className="text-xs text-slate-500">Verifying terminal session...</p>
      </div>
    )
  }

  // Not authenticated — show auth gate
  if (!authenticated) {
    return (
      <div>
        {sessionExpired && (
          <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15 max-w-md mx-auto">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300">Terminal session expired. Please re-authenticate.</span>
          </div>
        )}
        <TerminalAuthGate onAuthenticated={handleAuthenticated} />
      </div>
    )
  }

  const displayCwd = shortenCwd(cwd, terminalUser)

  // Authenticated — show terminal
  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] gap-3">
      <DisconnectedBanner />
      {/* Security banner with auth info */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 shrink-0">
          <Shield size={16} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-emerald-300">Authenticated terminal session</p>
          <p className="text-[11px] text-emerald-400/60">
            Authenticated as <span className="font-mono font-semibold text-emerald-300">{terminalUser}</span> via Linux system credentials
          </p>
        </div>
        <button
          onClick={handleLock}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
            bg-slate-800/60 border border-white/5
            text-slate-400 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-500/5
            transition-all duration-150
          "
          title="Lock terminal (end session)"
        >
          <Lock size={12} />
          Lock
        </button>
      </div>

      {/* Quick command buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mr-1">Quick:</span>
        {quickCommands.map((qc) => (
          <button
            key={qc.cmd}
            onClick={() => executeCommand(qc.cmd)}
            title={qc.tip}
            className="
              px-2.5 py-1 rounded-lg text-[11px] font-mono
              bg-slate-800/60 border border-white/5
              text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 hover:bg-emerald-500/5
              transition-all duration-150
            "
          >
            {qc.label}
          </button>
        ))}

        {/* Clear screen button */}
        <button
          onClick={() => setEntries([])}
          className="
            ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px]
            bg-slate-800/60 border border-white/5
            text-slate-500 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-500/5
            transition-all duration-150
          "
          title="Clear screen (Ctrl+L)"
        >
          <Trash2 size={11} />
          Clear
        </button>
      </div>

      {/* Terminal output area */}
      <div
        ref={outputRef}
        onClick={() => inputRef.current?.focus()}
        className="
          flex-1 overflow-y-auto rounded-xl
          bg-slate-950 border border-white/5
          shadow-[inset_0_1px_0_0_rgba(16,185,129,0.06)]
          font-mono text-sm
          scrollbar-thin
          cursor-text
        "
      >
        {/* Welcome message when empty */}
        {entries.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <TerminalSquare size={32} strokeWidth={1.2} />
            <p className="text-xs">Terminal ready. Type a command or use a quick button above.</p>
            <p className="text-[10px] text-slate-800">
              Use <kbd className="px-1.5 py-0.5 rounded border border-white/5 bg-white/[0.03] text-[9px] text-slate-500">Up</kbd> / <kbd className="px-1.5 py-0.5 rounded border border-white/5 bg-white/[0.03] text-[9px] text-slate-500">Down</kbd> for history
              &nbsp;&middot;&nbsp;
              <kbd className="px-1.5 py-0.5 rounded border border-white/5 bg-white/[0.03] text-[9px] text-slate-500">Ctrl+L</kbd> to clear
            </p>
          </div>
        )}

        {/* Command entries */}
        <div className="p-3 space-y-0">
          {entries.map((entry) => (
            <div key={`${entry.timestamp}-${entry.command}`} className="group animate-fade-in border-b border-white/[0.02] pb-1 mb-1">
              {/* Prompt + command */}
              <div className="flex items-start gap-0">
                <span className="text-emerald-500 select-none shrink-0">
                  {terminalUser}@{hostname}
                </span>
                <span className="text-slate-500 select-none">:</span>
                <span className="text-cyan-400 select-none">{shortenCwd(entry.cwd, terminalUser)}</span>
                <span className="text-slate-500 select-none mx-1">$</span>
                <span className="text-slate-200">{entry.command}</span>

                {/* Exit code + copy button */}
                <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {/* Timestamp */}
                  <span className="text-[9px] text-slate-500 flex items-center gap-1">
                    <Clock size={8} />
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>

                  {/* Exit code badge */}
                  <span className={`
                    text-[9px] px-1.5 py-0.5 rounded font-semibold tabular-nums
                    ${entry.exitCode === 0
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-rose-500/15 text-rose-400'
                    }
                  `}>
                    exit {entry.exitCode}
                  </span>

                  {/* Copy button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyOutput(idx) }}
                    className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
                    title="Copy output"
                  >
                    {copiedIndex === idx
                      ? <Check size={11} className="text-emerald-400" />
                      : <Copy size={11} />
                    }
                  </button>
                </div>
              </div>

              {/* Output */}
              {entry.output && (
                <pre
                  className={`
                    mt-0.5 whitespace-pre-wrap break-all text-[13px] leading-relaxed
                    ${entry.success ? 'text-slate-400' : 'text-rose-300/80'}
                  `}
                  dangerouslySetInnerHTML={{ __html: parseAnsi(entry.output) }}
                />
              )}
            </div>
          ))}

          {/* Loading indicator — blinking cursor block */}
          {loading && (
            <div className="flex items-center gap-0 py-1">
              <span className="text-emerald-500 select-none shrink-0">
                {terminalUser}@{hostname}
              </span>
              <span className="text-slate-500 select-none">:</span>
              <span className="text-cyan-400 select-none">{displayCwd}</span>
              <span className="text-slate-500 select-none mx-1">$</span>
              <span className="text-emerald-400 animate-pulse">&#9610;</span>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className={`
        flex items-center gap-0 rounded-xl bg-slate-950 border px-3 py-2.5 font-mono text-sm
        transition-colors duration-200
        ${loading ? 'border-emerald-500/20 shadow-[0_0_8px_0_rgba(16,185,129,0.06)]' : 'border-white/5 focus-within:border-emerald-500/30'}
      `}>
        {/* Prompt prefix */}
        <span className="text-emerald-500 select-none shrink-0">
          {terminalUser}@{hostname}
        </span>
        <span className="text-slate-500 select-none">:</span>
        <span className="text-cyan-400 select-none">{displayCwd}</span>
        <span className="text-slate-500 select-none mx-1">$</span>

        {/* Input — never disabled */}
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={(e) => { setCommandInput(e.target.value); setHistoryIndex(-1) }}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Type next command (queued)...' : 'Type a command...'}
          className="flex-1 bg-transparent text-slate-100 placeholder-slate-700 focus:outline-none"
          autoComplete="off"
          spellCheck={false}
        />

        {/* Queue indicator */}
        {queueLength > 0 && (
          <span className="text-[10px] text-amber-400/70 mr-2 select-none whitespace-nowrap">
            ({queueLength} queued)
          </span>
        )}

        {/* Execute button — spinner when loading */}
        <button
          onClick={() => executeCommand()}
          disabled={!commandInput.trim()}
          className="
            flex items-center justify-center w-7 h-7 rounded-lg ml-2
            bg-emerald-500/15 text-emerald-400
            hover:bg-emerald-500/25 hover:text-emerald-300
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-150
          "
          title={loading ? 'Running... (command will be queued)' : 'Execute (Enter)'}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        </button>
      </div>

      {/* History count footer */}
      {history.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-slate-500">
            {history.length} command{history.length !== 1 ? 's' : ''} in history
          </span>
          <button
            onClick={() => { setHistory([]); localStorage.removeItem('terminal-history') }}
            className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors"
          >
            Clear history
          </button>
        </div>
      )}
    </div>
  )
}
