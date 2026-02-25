// =============================================================================
// ContainerDetail — Detailed view for a single container with live stats
// =============================================================================

import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { ContainerInfo, ContainerDetail as ContainerDetailType, ContainerStats, ContainerProcessesResponse, ContainerProcess } from '../../../shared/types'
import { useContainerStore, selectStatsHistory } from '../../stores/containerStore'
import { useToast } from '../common/Toast'
import { fetchContainer, fetchContainerStats, fetchContainerLogs, startContainer, stopContainer, restartContainer, fetchContainerProcesses, execContainerCommand, renameContainer } from '../../api/endpoints'
import ContainerFileBrowser from './ContainerFileBrowser'
import LiveLogViewer from '../logs/LiveLogViewer'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  ArrowLeft,
  ArrowRight,
  Cpu,
  MemoryStick,
  Network,
  HardDrive,
  Users,
  Box,
  Clock,
  Globe,
  FolderOpen,
  Variable,
  Info,
  Activity,
  Layers,
  Play,
  Square,
  RotateCw,
  ScrollText,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronDown,
  Search,
  Lock,
  Download,
  Terminal,
  Loader2,
  AlertCircle,
  Pencil,
  Check,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  if (seconds <= 0) return '--'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 && days === 0) parts.push(`${secs}s`)

  return parts.join(' ') || '0s'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

/** Parse env string (newline-separated KEY=VALUE) into entries. */
function parseEnvString(envStr: string): Array<{ key: string; value: string }> {
  if (!envStr || envStr === '--') return []
  return envStr
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=')
      return {
        key: line.slice(0, idx).trim(),
        value: line.slice(idx + 1).trim(),
      }
    })
}

/** Parse mounts string (newline or comma-separated). */
function parseMounts(mountStr: string): string[] {
  if (!mountStr || mountStr === '--') return []
  return mountStr
    .split(/[\n,]/)
    .map((m) => m.trim())
    .filter(Boolean)
}

/** Parse networks string (newline or comma-separated). */
function parseNetworks(networkStr: string): string[] {
  if (!networkStr || networkStr === '--') return []
  return networkStr
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter(Boolean)
}

/** Check if an env key name is sensitive (password, secret, token, key). */
function isSensitiveKey(key: string): boolean {
  const upper = key.toUpperCase()
  return ['PASSWORD', 'SECRET', 'TOKEN', 'KEY'].some((s) => upper.includes(s))
}

/** Mask a sensitive value with dots. */
function maskValue(value: string): string {
  if (value.length <= 2) return '\u2022'.repeat(8)
  return value[0] + '\u2022'.repeat(Math.min(value.length - 2, 16)) + value[value.length - 1]
}

/**
 * Parse a ports string like "0.0.0.0:8096->8096/tcp, 443->443/tcp"
 * into structured entries.
 */
interface PortMapping {
  bindAddress?: string
  hostPort: string
  containerPort: string
  protocol: string
  raw: string
}

function parsePortMappings(portsStr: string): PortMapping[] {
  if (!portsStr || portsStr === '--') return []
  return portsStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      // Formats: "0.0.0.0:8096->8096/tcp", "8096->8096/tcp", "8096/tcp"
      let bindAddress: string | undefined
      let hostPort = ''
      let containerPort = ''
      let protocol = 'tcp'

      const arrowIdx = raw.indexOf('->')
      if (arrowIdx === -1) {
        // No mapping, just exposed port like "8096/tcp"
        const slashIdx = raw.indexOf('/')
        if (slashIdx !== -1) {
          containerPort = raw.slice(0, slashIdx)
          protocol = raw.slice(slashIdx + 1)
        } else {
          containerPort = raw
        }
        hostPort = containerPort
      } else {
        const leftSide = raw.slice(0, arrowIdx)
        const rightSide = raw.slice(arrowIdx + 2)

        // Parse right side: "8096/tcp"
        const slashIdx = rightSide.indexOf('/')
        if (slashIdx !== -1) {
          containerPort = rightSide.slice(0, slashIdx)
          protocol = rightSide.slice(slashIdx + 1)
        } else {
          containerPort = rightSide
        }

        // Parse left side: "0.0.0.0:8096" or "8096"
        const lastColon = leftSide.lastIndexOf(':')
        if (lastColon !== -1) {
          const potentialAddr = leftSide.slice(0, lastColon)
          const potentialPort = leftSide.slice(lastColon + 1)
          // Check if the part after last colon is a port number
          if (/^\d+$/.test(potentialPort)) {
            bindAddress = potentialAddr || undefined
            hostPort = potentialPort
          } else {
            hostPort = leftSide
          }
        } else {
          hostPort = leftSide
        }
      }

      return { bindAddress, hostPort, containerPort, protocol, raw }
    })
}

/**
 * Parse a mount entry like "source:destination:mode" into parts.
 */
interface MountEntry {
  source: string
  destination: string
  mode?: string
  raw: string
}

function parseMountEntries(mountStr: string): MountEntry[] {
  if (!mountStr || mountStr === '--') return []
  return mountStr
    .split(/[\n,]/)
    .map((m) => m.trim())
    .filter(Boolean)
    .map((raw) => {
      // Docker mounts: /host/path:/container/path or /host/path:/container/path:ro
      // Named volumes: volume_name:/container/path:rw
      const parts = raw.split(':')
      if (parts.length >= 3) {
        // Could be /host:/container:mode or on Windows C:\path... but we handle unix
        const lastPart = parts[parts.length - 1]
        if (lastPart === 'ro' || lastPart === 'rw' || lastPart === 'z' || lastPart === 'Z') {
          return {
            source: parts.slice(0, -2).join(':') || parts[0],
            destination: parts[parts.length - 2],
            mode: lastPart,
            raw,
          }
        }
        // No mode, just source:destination with colons in path
        return {
          source: parts[0],
          destination: parts.slice(1).join(':'),
          raw,
        }
      }
      if (parts.length === 2) {
        return { source: parts[0], destination: parts[1], raw }
      }
      return { source: raw, destination: raw, raw }
    })
}

/**
 * Parse cpu_percent string like "2.34%" to a number (2.34).
 */
function parseCpuPercent(cpuStr: string): number {
  if (!cpuStr || cpuStr === '--') return 0
  const match = cpuStr.match(/([\d.]+)/)
  return match ? parseFloat(match[1]) : 0
}

/**
 * Parse memory_usage string like "150MiB / 8GiB" to MB number (150).
 * Handles: "150MiB / 8GiB", "1.5GiB / 8GiB", "512KiB / 8GiB"
 */
function parseMemoryToMB(memStr: string): number {
  if (!memStr || memStr === '--') return 0
  // Take the used portion (before the slash)
  const usedPart = memStr.split('/')[0].trim()
  const match = usedPart.match(/([\d.]+)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)?/i)
  if (!match) return 0
  const value = parseFloat(match[1])
  const unit = (match[2] || 'B').toLowerCase()
  switch (unit) {
    case 'tib':
    case 'tb':
      return value * 1024 * 1024
    case 'gib':
    case 'gb':
      return value * 1024
    case 'mib':
    case 'mb':
      return value
    case 'kib':
    case 'kb':
      return value / 1024
    default:
      return value / (1024 * 1024)
  }
}

// Network color palette for badge variety
const NETWORK_COLORS = [
  { bg: 'bg-purple-500/10', text: 'text-purple-300', ring: 'ring-purple-500/20' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-300', ring: 'ring-cyan-500/20' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-300', ring: 'ring-emerald-500/20' },
  { bg: 'bg-amber-500/10', text: 'text-amber-300', ring: 'ring-amber-500/20' },
  { bg: 'bg-rose-500/10', text: 'text-rose-300', ring: 'ring-rose-500/20' },
  { bg: 'bg-blue-500/10', text: 'text-blue-300', ring: 'ring-blue-500/20' },
  { bg: 'bg-pink-500/10', text: 'text-pink-300', ring: 'ring-pink-500/20' },
  { bg: 'bg-indigo-500/10', text: 'text-indigo-300', ring: 'ring-indigo-500/20' },
]

// ---------------------------------------------------------------------------
// Badge subcomponents
// ---------------------------------------------------------------------------

type BadgeVariant = { bg: string; text: string; ring: string; dot: string }

const STATE_VARIANTS: Record<string, BadgeVariant> = {
  running: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  exited: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    ring: 'ring-rose-500/20',
    dot: 'bg-rose-400',
  },
  paused: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-400',
  },
  restarting: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    ring: 'ring-cyan-500/20',
    dot: 'bg-cyan-400',
  },
}

const DEFAULT_VARIANT: BadgeVariant = {
  bg: 'bg-slate-500/10',
  text: 'text-slate-400',
  ring: 'ring-slate-500/20',
  dot: 'bg-slate-400',
}

const HEALTH_VARIANTS: Record<string, BadgeVariant> = {
  healthy: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  unhealthy: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    ring: 'ring-rose-500/20',
    dot: 'bg-rose-400',
  },
  starting: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-400',
  },
}

function StatusBadge({ label, variants }: { label: string; variants: Record<string, BadgeVariant> }) {
  const key = label.toLowerCase()
  const v = variants[key] ?? DEFAULT_VARIANT
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ${v.bg} ${v.text} ${v.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {label || 'none'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContainerDetailProps {
  containerName: string
  /** The basic container info from the list (available immediately). */
  containerInfo: ContainerInfo
  onBack: () => void
  /** Trigger immediate refresh of the containers list after actions. */
  onRefreshList?: () => void
}

const ContainerDetail: React.FC<ContainerDetailProps> = ({
  containerName,
  containerInfo,
  onBack,
  onRefreshList,
}) => {
  const setStats = useContainerStore((s) => s.setStats)
  const pushStatsHistory = useContainerStore((s) => s.pushStatsHistory)
  const storedStats = useContainerStore((s) => s.stats[containerName])
  const statsHistorySelector = useMemo(() => selectStatsHistory(containerName), [containerName])
  const statsHistory = useContainerStore(statsHistorySelector)
  const { addToast } = useToast()

  const [detail, setDetail] = useState<ContainerDetailType | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [stats, setLocalStats] = useState<ContainerStats | null>(storedStats ?? null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [containerLogs, setContainerLogs] = useState<string>('')
  const [showLogs, setShowLogs] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [liveLogsMode, setLiveLogsMode] = useState(false)

  // Process viewer state
  const [showProcesses, setShowProcesses] = useState(false)
  const [processes, setProcesses] = useState<ContainerProcess[]>([])
  const [processesLoading, setProcessesLoading] = useState(false)
  const processIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Command runner state
  const [showExec, setShowExec] = useState(false)
  const [execCommand, setExecCommand] = useState('')
  const [execLoading, setExecLoading] = useState(false)
  const [execOutput, setExecOutput] = useState<{ command: string; output: string; exitCode: number; success: boolean } | null>(null)
  const [execHistory, setExecHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('container-exec-history')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  // Rename state
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(containerName)
  const [renameLoading, setRenameLoading] = useState(false)

  // Enhanced section states
  const [envSearch, setEnvSearch] = useState('')
  const [envCollapsed, setEnvCollapsed] = useState(false)
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set())

  const mountedRef = useRef(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch full container detail (environment, mounts, networks)
  const fetchDetail = useCallback(async () => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const d = await fetchContainer(containerName)
      if (mountedRef.current) {
        setDetail(d)
        setDetailError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : String(err)
        setDetailError(msg || 'Failed to fetch container details')
      }
    } finally {
      if (mountedRef.current) {
        setDetailLoading(false)
      }
    }
  }, [containerName])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const retryDetail = useCallback(() => {
    fetchDetail()
  }, [fetchDetail])

  // Fetch stats on mount and every 10s
  const fetchStats = useCallback(async () => {
    try {
      const s = await fetchContainerStats(containerName)
      if (mountedRef.current) {
        setLocalStats(s)
        setStats(containerName, s)
        setStatsLoading(false)

        // Push to stats history for charts
        const cpuNum = parseCpuPercent(s.cpu_percent)
        const memNum = parseMemoryToMB(s.memory_usage)
        pushStatsHistory(containerName, cpuNum, memNum)
      }
    } catch {
      if (mountedRef.current) setStatsLoading(false)
    }
  }, [containerName, setStats, pushStatsHistory])

  useEffect(() => {
    mountedRef.current = true
    fetchStats()
    intervalRef.current = setInterval(fetchStats, 10000)

    return () => {
      mountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchStats])

  // Container action handler
  const handleAction = useCallback(async (action: 'start' | 'stop' | 'restart') => {
    const pastTense: Record<typeof action, string> = { start: 'started', stop: 'stopped', restart: 'restarted' }
    const gerund: Record<typeof action, string> = { start: 'Starting', stop: 'Stopping', restart: 'Restarting' }

    setActionLoading(action)
    addToast({ type: 'info', message: `${gerund[action]} "${containerName}"...`, duration: 2000 })

    try {
      const actionFn = { start: startContainer, stop: stopContainer, restart: restartContainer }[action]
      const result = await actionFn(containerName)

      if (result.success) {
        addToast({ type: 'success', message: `"${containerName}" ${pastTense[action]} successfully!` })
      } else {
        addToast({ type: 'error', message: `Failed to ${action} "${containerName}": ${result.output || 'Unknown error'}`, duration: 6000 })
      }

      // Refresh stats and container list after action
      setTimeout(() => {
        fetchStats()
        onRefreshList?.()
      }, 1000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast({ type: 'error', message: `Failed to ${action} "${containerName}": ${msg}`, duration: 6000 })
    } finally {
      setActionLoading(null)
    }
  }, [containerName, fetchStats, addToast, onRefreshList])

  // Fetch container logs
  const handleFetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const result = await fetchContainerLogs(containerName)
      setContainerLogs(result.logs)
      setShowLogs(true)
    } catch {
      setContainerLogs('Failed to fetch logs')
    } finally {
      setLogsLoading(false)
    }
  }, [containerName])

  // Download logs as text file
  const handleDownloadLogs = useCallback(() => {
    if (!containerLogs) return
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const filename = `${containerName}-logs-${yyyy}-${mm}-${dd}.txt`
    const blob = new Blob([containerLogs], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [containerLogs, containerName])

  // Handle container rename
  const handleRename = useCallback(async () => {
    const newName = renameValue.trim()
    if (!newName || newName === containerName) {
      setRenaming(false)
      setRenameValue(containerName)
      return
    }
    setRenameLoading(true)
    try {
      const result = await renameContainer(containerName, newName)
      if (result.success) {
        addToast({ type: 'success', message: `Renamed to "${newName}"` })
        onRefreshList?.()
        onBack()
      } else {
        addToast({ type: 'error', message: result.message || 'Rename failed', duration: 5000 })
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Rename failed', duration: 5000 })
    } finally {
      setRenameLoading(false)
      setRenaming(false)
    }
  }, [containerName, renameValue, addToast, onRefreshList, onBack])

  // Fetch container processes
  const handleFetchProcesses = useCallback(async () => {
    setProcessesLoading(true)
    try {
      const result = await fetchContainerProcesses(containerName)
      if (mountedRef.current) {
        setProcesses(result.processes)
      }
    } catch {
      if (mountedRef.current) {
        setProcesses([])
      }
    } finally {
      if (mountedRef.current) {
        setProcessesLoading(false)
      }
    }
  }, [containerName])

  // Toggle process viewer — auto-refresh every 10s while visible
  const handleToggleProcesses = useCallback(() => {
    setShowProcesses((prev) => {
      const next = !prev
      if (next) {
        // Fetch immediately and start interval
        handleFetchProcesses()
        processIntervalRef.current = setInterval(handleFetchProcesses, 10000)
      } else {
        // Clear interval when hiding
        if (processIntervalRef.current) {
          clearInterval(processIntervalRef.current)
          processIntervalRef.current = null
        }
      }
      return next
    })
  }, [handleFetchProcesses])

  // Clean up process interval on unmount
  useEffect(() => {
    return () => {
      if (processIntervalRef.current) {
        clearInterval(processIntervalRef.current)
        processIntervalRef.current = null
      }
    }
  }, [])

  // Command runner
  const handleExecCommand = useCallback(async () => {
    const cmd = execCommand.trim()
    if (!cmd || execLoading) return
    setExecLoading(true)
    setExecOutput(null)
    try {
      const result = await execContainerCommand(containerName, cmd)
      setExecOutput({
        command: cmd,
        output: result.output,
        exitCode: result.exit_code,
        success: result.success,
      })
      // Add to history (dedup, max 10)
      setExecHistory((prev) => {
        const filtered = prev.filter((h) => h !== cmd)
        const next = [cmd, ...filtered].slice(0, 10)
        try { localStorage.setItem('container-exec-history', JSON.stringify(next)) } catch {}
        return next
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Command execution failed'
      setExecOutput({ command: cmd, output: message, exitCode: -1, success: false })
    } finally {
      setExecLoading(false)
    }
  }, [execCommand, execLoading, containerName])

  // Derived data
  const envEntries = detail ? parseEnvString(detail.environment) : []
  const mounts = detail ? parseMounts(detail.mounts) : []
  const networks = detail ? parseNetworks(detail.networks) : []
  const portMappings = parsePortMappings(containerInfo.ports)
  const mountEntries = detail ? parseMountEntries(detail.mounts) : []

  // Filtered env entries based on search
  const filteredEnvEntries = envSearch
    ? envEntries.filter(
        (e) =>
          e.key.toLowerCase().includes(envSearch.toLowerCase()) ||
          e.value.toLowerCase().includes(envSearch.toLowerCase())
      )
    : envEntries

  // Toggle secret reveal
  const toggleSecret = (key: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Prepare chart data from stats history
  const chartData = statsHistory.map((entry, idx) => ({
    idx,
    time: new Date(entry.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    cpu: Math.round(entry.cpu * 100) / 100,
    mem: Math.round(entry.mem * 100) / 100,
  }))

  const isRunning = containerInfo.state === 'running'

  return (
    <div className="flex flex-col gap-5 animate-in">
      {/* ---- Back button + title ---- */}
      <div className="flex flex-col gap-3">
        {/* Top row: back + name + badges */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm flex-shrink-0
              text-slate-400 hover:text-white
              bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]
              transition-all duration-200
            "
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <Box className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          {renaming ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') { setRenaming(false); setRenameValue(containerName) }
                }}
                className="px-2 py-1 text-base md:text-lg font-bold text-white bg-white/10 border border-emerald-500/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/50 min-w-0 flex-1"
              />
              <button onClick={handleRename} disabled={renameLoading} className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded transition-all flex-shrink-0">
                {renameLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button onClick={() => { setRenaming(false); setRenameValue(containerName) }} className="p-1 text-slate-400 hover:bg-white/10 rounded transition-all flex-shrink-0">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-base md:text-xl font-bold text-white truncate">{containerName}</h1>
              <button
                onClick={() => setRenaming(true)}
                title="Rename container"
                className="p-1 text-slate-500 hover:text-slate-300 hover:bg-white/10 rounded transition-all flex-shrink-0"
              >
                <Pencil size={14} />
              </button>
            </>
          )}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <StatusBadge label={containerInfo.state} variants={STATE_VARIANTS} />
            <StatusBadge label={containerInfo.health} variants={HEALTH_VARIANTS} />
          </div>
        </div>

        {/* Action buttons row — wraps on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          {containerInfo.state !== 'running' && (
            <button
              onClick={() => handleAction('start')}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
            >
              {actionLoading === 'start' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Start
            </button>
          )}
          {containerInfo.state === 'running' && (
            <>
              <button
                onClick={() => handleAction('restart')}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-50"
              >
                {actionLoading === 'restart' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                Restart
              </button>
              <button
                onClick={() => handleAction('stop')}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all disabled:opacity-50"
              >
                {actionLoading === 'stop' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                Stop
              </button>
            </>
          )}
          <button
            onClick={handleFetchLogs}
            disabled={logsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
          >
            {logsLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ScrollText className="h-3.5 w-3.5" />}
            Logs
          </button>
          {isRunning && (
            <button
              onClick={handleToggleProcesses}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showProcesses
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                  : 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              Processes
            </button>
          )}
        </div>
      </div>

      {/* ---- Detail loading skeleton ---- */}
      {detailLoading && detail === null && (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 w-3/4 bg-white/[0.06] rounded" />
          <div className="h-4 w-1/2 bg-white/[0.06] rounded" />
          <div className="h-4 w-2/3 bg-white/[0.06] rounded" />
        </div>
      )}

      {/* ---- Detail error banner ---- */}
      {detailError && (
        <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-rose-300">Failed to load container details</p>
            <p className="text-xs text-rose-400/70 mt-0.5">{detailError}</p>
          </div>
          <button
            onClick={retryDetail}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* ---- Stats section ---- */}
      <section>
        <SectionHeader icon={<Activity className="h-4 w-4 text-cyan-400" />} title="Resource Stats" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          <StatCard
            icon={<Cpu className="h-4 w-4 text-cyan-400" />}
            label="CPU"
            value={stats?.cpu_percent ?? '--'}
            loading={statsLoading}
          />
          <StatCard
            icon={<MemoryStick className="h-4 w-4 text-emerald-400" />}
            label="Memory"
            value={stats?.memory_usage ?? '--'}
            subValue={stats?.memory_percent ? `${stats.memory_percent}` : undefined}
            loading={statsLoading}
          />
          <StatCard
            icon={<Network className="h-4 w-4 text-purple-400" />}
            label="Network I/O"
            value={stats?.network_io ?? '--'}
            loading={statsLoading}
          />
          <StatCard
            icon={<HardDrive className="h-4 w-4 text-amber-400" />}
            label="Block I/O"
            value={stats?.block_io ?? '--'}
            loading={statsLoading}
          />
          <StatCard
            icon={<Users className="h-4 w-4 text-rose-400" />}
            label="PIDs"
            value={stats?.pids ?? '--'}
            loading={statsLoading}
          />
          <StatCard
            icon={<Clock className="h-4 w-4 text-slate-400" />}
            label="Uptime"
            value={formatUptime(containerInfo.uptime_seconds)}
            loading={false}
          />
        </div>
      </section>

      {/* ---- 4A: Metrics History Graphs ---- */}
      {chartData.length >= 2 && (
        <section className="animate-fade-in">
          <SectionHeader icon={<Activity className="h-4 w-4 text-amber-400" />} title="Metrics History" />
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-5 mt-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CPU % over time */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CPU Usage (%)</span>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                        tickLine={false}
                        domain={[0, 'auto']}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#e2e8f0',
                        }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(value: number) => [`${value}%`, 'CPU']}
                      />
                      <Area
                        type="monotone"
                        dataKey="cpu"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fill="url(#cpuGradient)"
                        dot={false}
                        activeDot={{ r: 3, fill: '#f59e0b', stroke: '#1e293b', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Memory MB over time */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MemoryStick className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Memory Usage (MB)</span>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                        tickLine={false}
                        domain={[0, 'auto']}
                        tickFormatter={(v: number) => `${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#e2e8f0',
                        }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(value: number) => [`${value} MB`, 'Memory']}
                      />
                      <Area
                        type="monotone"
                        dataKey="mem"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#memGradient)"
                        dot={false}
                        activeDot={{ r: 3, fill: '#10b981', stroke: '#1e293b', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---- Container Logs (right below Metrics History) ---- */}
      {showLogs && (
        <section>
          <div className="flex items-center justify-between">
            <SectionHeader icon={<ScrollText className="h-4 w-4 text-cyan-400" />} title="Container Logs" />
            <div className="flex items-center gap-2">
              {/* Live / Snapshot toggle */}
              <div className="flex rounded-md bg-white/[0.03] border border-white/[0.06] p-0.5">
                <button
                  onClick={() => setLiveLogsMode(false)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${!liveLogsMode ? 'bg-white/[0.08] text-slate-200' : 'text-slate-500 hover:text-slate-400'}`}
                >
                  Snapshot
                </button>
                <button
                  onClick={() => setLiveLogsMode(true)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${liveLogsMode ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-500 hover:text-slate-400'}`}
                >
                  Live
                </button>
              </div>
              {!liveLogsMode && (
                <>
                  <button
                    onClick={handleDownloadLogs}
                    disabled={!containerLogs}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Download logs as text file"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </button>
                  <button
                    onClick={handleFetchLogs}
                    disabled={logsLoading}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${logsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </>
              )}
              <button
                onClick={() => setShowLogs(false)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          {liveLogsMode ? (
            <div className="mt-3 h-80">
              <LiveLogViewer containerName={containerName} initialLines={100} pollInterval={2000} />
            </div>
          ) : (
            <pre
              className="
                glass-subtle mt-3 p-4 max-h-80 overflow-auto
                text-xs leading-relaxed font-mono text-slate-300
                whitespace-pre-wrap break-words scrollbar-thin
              "
            >
              {containerLogs || 'No logs available.'}
            </pre>
          )}
        </section>
      )}

      {/* ---- Info section ---- */}
      <section>
        <SectionHeader icon={<Info className="h-4 w-4 text-emerald-400" />} title="Container Info" />
        <div className="glass-subtle mt-3 divide-y divide-white/[0.04]">
          <InfoRow label="Image" value={containerInfo.image} mono />
          <InfoRow label="Image ID" value={containerInfo.image_id} mono />
          <InfoRow label="Created" value={formatDate(containerInfo.created)} />
          <InfoRow label="Uptime" value={formatUptime(containerInfo.uptime_seconds)} />
          <InfoRow label="Ports" value={containerInfo.ports || '--'} mono />
          <InfoRow
            label="Restart Count"
            value={String(containerInfo.restart_count)}
            highlight={containerInfo.restart_count > 0}
          />
        </div>
      </section>

      {/* ---- 4C: Process Viewer ---- */}
      {showProcesses && isRunning && (
        <section className="animate-fade-in">
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  Running Processes
                </h2>
                {processes.length > 0 && (
                  <span className="text-xs text-slate-600 ml-1">({processes.length})</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFetchProcesses}
                  disabled={processesLoading}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${processesLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={handleToggleProcesses}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {processesLoading && processes.length === 0 ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-8 bg-white/[0.03] rounded animate-pulse" />
                ))}
              </div>
            ) : processes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-600">
                No process information available.
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin rounded-lg border border-white/[0.04]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-slate-500 uppercase tracking-wider font-semibold px-4 py-2.5">PID</th>
                      <th className="text-left text-slate-500 uppercase tracking-wider font-semibold px-4 py-2.5">User</th>
                      <th className="text-left text-slate-500 uppercase tracking-wider font-semibold px-4 py-2.5">CPU%</th>
                      <th className="text-left text-slate-500 uppercase tracking-wider font-semibold px-4 py-2.5">Time</th>
                      <th className="text-left text-slate-500 uppercase tracking-wider font-semibold px-4 py-2.5">Command</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map((proc, idx) => (
                      <tr
                        key={`${proc.pid}-${idx}`}
                        className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                          idx % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'
                        }`}
                      >
                        <td className="px-4 py-2 font-mono text-cyan-400">{proc.pid}</td>
                        <td className="px-4 py-2 text-slate-300">{proc.uid}</td>
                        <td className="px-4 py-2 text-amber-400 font-mono">{proc.cpu}</td>
                        <td className="px-4 py-2 text-slate-400 font-mono">{proc.time}</td>
                        <td className="px-4 py-2 text-slate-300 font-mono truncate max-w-xs" title={proc.cmd}>
                          {proc.cmd}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- Command Runner (Phase 7C) ---- */}
      {isRunning && (
        <section className="animate-fade-in">
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowExec(!showExec)}
              className="flex items-center gap-2 w-full p-5 hover:bg-white/[0.02] transition-colors"
            >
              <Terminal className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Run Command
              </h2>
              <ChevronDown
                className={`h-4 w-4 text-slate-500 ml-auto transition-transform duration-200 ${showExec ? 'rotate-0' : '-rotate-90'}`}
              />
            </button>

            {showExec && (
              <div className="px-5 pb-5 space-y-4">
                {/* Safety warning */}
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2.5">
                  <Lock className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-amber-400/80 leading-relaxed">
                    Commands run as the container's default user. Use caution — some commands may affect container state.
                  </p>
                </div>

                {/* Command input */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 text-xs font-mono select-none">$</span>
                    <input
                      type="text"
                      value={execCommand}
                      onChange={(e) => setExecCommand(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleExecCommand()}
                      placeholder="ls -la /app"
                      className="
                        w-full pl-7 pr-4 py-2.5
                        bg-slate-950 border border-white/[0.08] rounded-lg
                        text-xs text-slate-200 placeholder-slate-600 font-mono
                        focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/15
                        transition-all duration-200
                      "
                    />
                  </div>
                  <button
                    onClick={handleExecCommand}
                    disabled={!execCommand.trim() || execLoading}
                    className="
                      flex items-center gap-1.5 px-4 py-2.5 rounded-lg
                      text-xs font-medium text-white
                      bg-emerald-500 hover:bg-emerald-400
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-all duration-200 shadow-lg shadow-emerald-500/20
                    "
                  >
                    {execLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Execute
                  </button>
                </div>

                {/* Command history chips */}
                {execHistory.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-slate-600 self-center mr-1">History:</span>
                    {execHistory.map((cmd) => (
                      <button
                        key={cmd}
                        onClick={() => setExecCommand(cmd)}
                        className="
                          px-2 py-0.5 rounded text-[10px] font-mono
                          bg-white/[0.03] border border-white/[0.06] text-slate-400
                          hover:bg-white/[0.06] hover:text-slate-200
                          transition-all duration-150 truncate max-w-[200px]
                        "
                        title={cmd}
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                )}

                {/* Output */}
                {execOutput && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">$ {execOutput.command}</span>
                      <span className={`
                        text-[10px] font-mono px-1.5 py-0.5 rounded
                        ${execOutput.exitCode === 0
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                        }
                      `}>
                        exit {execOutput.exitCode}
                      </span>
                    </div>
                    <pre className="
                      bg-slate-950 border border-white/[0.06] rounded-lg p-4
                      text-[11px] text-slate-300 font-mono
                      max-h-[300px] overflow-auto scrollbar-thin
                      whitespace-pre-wrap break-all leading-relaxed
                    ">
                      {execOutput.output || '(no output)'}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- Environment Variables (Enhanced) ---- */}
      {envEntries.length > 0 && (
        <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-5">
            {/* Header with collapse toggle */}
            <button
              onClick={() => setEnvCollapsed(!envCollapsed)}
              className="flex items-center gap-2 w-full group"
            >
              <Variable className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Environment Variables
              </h2>
              <span className="text-xs text-slate-600 ml-1">({envEntries.length})</span>
              <ChevronDown
                className={`h-4 w-4 text-slate-500 ml-auto transition-transform duration-200 ${
                  envCollapsed ? '-rotate-90' : 'rotate-0'
                }`}
              />
            </button>

            {!envCollapsed && (
              <div className="mt-4 space-y-3">
                {/* Search/filter input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter variables..."
                    value={envSearch}
                    onChange={(e) => setEnvSearch(e.target.value)}
                    className="
                      w-full pl-9 pr-4 py-2 rounded-lg text-xs font-mono
                      bg-white/[0.03] border border-white/[0.06]
                      text-slate-300 placeholder-slate-600
                      focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20
                      transition-all duration-200
                    "
                  />
                </div>

                {/* Variable table */}
                <div className="max-h-72 overflow-y-auto scrollbar-thin rounded-lg border border-white/[0.04]">
                  {filteredEnvEntries.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-600">
                      No matching variables found.
                    </div>
                  ) : (
                    filteredEnvEntries.map((entry, idx) => {
                      const sensitive = isSensitiveKey(entry.key)
                      const revealed = revealedSecrets.has(entry.key)
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 px-4 py-2.5 animate-fade-in ${
                            idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'
                          }`}
                          style={{ animationDelay: `${idx * 0.02}s` }}
                        >
                          {sensitive && (
                            <Lock className="h-3 w-3 text-amber-500/60 flex-shrink-0" />
                          )}
                          <span
                            className="text-xs font-mono text-cyan-400 w-32 md:w-56 flex-shrink-0 truncate"
                            title={entry.key}
                          >
                            {entry.key}
                          </span>
                          <span className="text-xs text-slate-600 flex-shrink-0">=</span>
                          <span
                            className="text-xs font-mono text-slate-300 truncate flex-1 min-w-0"
                            title={sensitive && !revealed ? '(hidden)' : entry.value}
                          >
                            {sensitive && !revealed ? maskValue(entry.value) : entry.value}
                          </span>
                          {sensitive && (
                            <button
                              onClick={() => toggleSecret(entry.key)}
                              className="flex-shrink-0 p-1 rounded hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"
                              title={revealed ? 'Hide value' : 'Reveal value'}
                            >
                              {revealed ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- Volume Mounts (Enhanced) ---- */}
      {mountEntries.length > 0 && (
        <section className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Volume Mounts
              </h2>
              <span className="text-xs text-slate-600 ml-1">({mountEntries.length})</span>
            </div>

            <div className="grid gap-2.5">
              {mountEntries.map((mount, idx) => (
                <div
                  key={idx}
                  className="
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    bg-white/[0.02] border border-white/[0.04]
                    hover:bg-white/[0.04] transition-colors duration-200
                    animate-fade-in
                  "
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  {/* Source path */}
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-xs font-mono text-amber-400 truncate block"
                      title={mount.source}
                    >
                      {mount.source}
                    </span>
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="h-4 w-4 text-slate-600 flex-shrink-0" />

                  {/* Destination path */}
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-xs font-mono text-emerald-400 truncate block"
                      title={mount.destination}
                    >
                      {mount.destination}
                    </span>
                  </div>

                  {/* Mode badge */}
                  {mount.mode && (
                    <span
                      className={`
                        flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                        ${mount.mode === 'ro'
                          ? 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                        }
                      `}
                    >
                      {mount.mode}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Port Mappings (Enhanced) ---- */}
      {portMappings.length > 0 && (
        <section className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Port Mappings
              </h2>
              <span className="text-xs text-slate-600 ml-1">({portMappings.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {portMappings.map((port, idx) => (
                <div
                  key={idx}
                  className="
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    bg-white/[0.02] border border-white/[0.04]
                    hover:bg-white/[0.04] transition-colors duration-200
                    animate-fade-in
                  "
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  {/* Host port */}
                  <div className="flex flex-col items-center min-w-0">
                    {port.bindAddress && (
                      <span className="text-[10px] text-slate-600 font-mono truncate max-w-[80px]" title={port.bindAddress}>
                        {port.bindAddress}
                      </span>
                    )}
                    <span className="text-lg font-bold text-white leading-tight">
                      {port.hostPort}
                    </span>
                    <span className="text-[10px] text-slate-600 uppercase">host</span>
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="h-4 w-4 text-cyan-500/50 flex-shrink-0" />

                  {/* Container port */}
                  <div className="flex flex-col items-center min-w-0">
                    <span className="text-lg font-bold text-cyan-400 leading-tight">
                      {port.containerPort}
                    </span>
                    <span className="text-[10px] text-slate-600 uppercase">container</span>
                  </div>

                  {/* Protocol badge */}
                  <span
                    className={`
                      ml-auto flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                      ${port.protocol === 'udp'
                        ? 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20'
                        : 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20'
                      }
                    `}
                  >
                    {port.protocol}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Network Connections (Enhanced) ---- */}
      {networks.length > 0 && (
        <section className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Network className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Networks
              </h2>
              <span className="text-xs text-slate-600 ml-1">({networks.length})</span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {networks.map((net, idx) => {
                const color = NETWORK_COLORS[idx % NETWORK_COLORS.length]
                return (
                  <span
                    key={idx}
                    className={`
                      inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold
                      ring-1 transition-all duration-200 hover:scale-105 cursor-default
                      animate-fade-in
                      ${color.bg} ${color.text} ${color.ring}
                    `}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <Network className="h-3.5 w-3.5" />
                    {net}
                  </span>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ---- File Browser ---- */}
      {detail?.state === 'running' && (
        <ContainerFileBrowser containerName={containerName} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-2">
    {icon}
    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{title}</h2>
  </div>
)

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  subValue?: string
  loading: boolean
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subValue, loading }) => (
  <div className="glass-subtle p-4 flex flex-col gap-2">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    </div>
    {loading ? (
      <div className="h-5 w-20 bg-white/[0.06] rounded animate-pulse" />
    ) : (
      <div>
        <p className="text-sm font-bold text-white truncate" title={value}>
          {value}
        </p>
        {subValue && (
          <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>
        )}
      </div>
    )}
  </div>
)

interface InfoRowProps {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, mono, highlight }) => (
  <div className="flex items-center gap-4 px-4 py-2.5">
    <span className="text-xs text-slate-500 uppercase tracking-wide w-24 md:w-32 flex-shrink-0">
      {label}
    </span>
    <span
      className={`text-sm truncate ${mono ? 'font-mono' : ''} ${
        highlight ? 'text-amber-400' : 'text-slate-300'
      }`}
      title={value}
    >
      {value}
    </span>
  </div>
)

export default ContainerDetail
