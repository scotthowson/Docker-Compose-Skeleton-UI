// =============================================================================
// ContainerDetail — Detailed view for a single container with live stats
// =============================================================================

import React, { useEffect, useCallback, useRef, useState } from 'react'
import { ContainerInfo, ContainerDetail as ContainerDetailType, ContainerStats } from '../../../shared/types'
import { useContainerStore } from '../../stores/containerStore'
import { fetchContainer, fetchContainerStats, fetchContainerLogs, startContainer, stopContainer, restartContainer } from '../../api/endpoints'
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
}

const ContainerDetail: React.FC<ContainerDetailProps> = ({
  containerName,
  containerInfo,
  onBack,
}) => {
  const setStats = useContainerStore((s) => s.setStats)
  const storedStats = useContainerStore((s) => s.stats[containerName])

  const [detail, setDetail] = useState<ContainerDetailType | null>(null)
  const [stats, setLocalStats] = useState<ContainerStats | null>(storedStats ?? null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [containerLogs, setContainerLogs] = useState<string>('')
  const [showLogs, setShowLogs] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)

  // Enhanced section states
  const [envSearch, setEnvSearch] = useState('')
  const [envCollapsed, setEnvCollapsed] = useState(false)
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set())

  const mountedRef = useRef(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch full container detail (environment, mounts, networks)
  useEffect(() => {
    let cancelled = false
    fetchContainer(containerName)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch(() => {
        // detail stays null; we fall back to containerInfo
      })
    return () => {
      cancelled = true
    }
  }, [containerName])

  // Fetch stats on mount and every 10s
  const fetchStats = useCallback(async () => {
    try {
      const s = await fetchContainerStats(containerName)
      if (mountedRef.current) {
        setLocalStats(s)
        setStats(containerName, s)
        setStatsLoading(false)
      }
    } catch {
      if (mountedRef.current) setStatsLoading(false)
    }
  }, [containerName, setStats])

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
    setActionLoading(action)
    try {
      const actionFn = { start: startContainer, stop: stopContainer, restart: restartContainer }[action]
      await actionFn(containerName)
      // Refresh stats after action
      setTimeout(fetchStats, 1000)
    } catch {
      // Error handling could show a toast
    } finally {
      setActionLoading(null)
    }
  }, [containerName, fetchStats])

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

  return (
    <div className="flex flex-col gap-5 animate-in">
      {/* ---- Back button + title ---- */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="
            flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
            text-slate-400 hover:text-white
            bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]
            transition-all duration-200
          "
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Box className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <h1 className="text-xl font-bold text-white truncate">{containerName}</h1>
          <StatusBadge label={containerInfo.state} variants={STATE_VARIANTS} />
          <StatusBadge label={containerInfo.health} variants={HEALTH_VARIANTS} />
        </div>

        {/* Container actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
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
        </div>
      </div>

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
                            className="text-xs font-mono text-cyan-400 w-56 flex-shrink-0 truncate"
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

      {/* ---- Container Logs ---- */}
      {showLogs && (
        <section>
          <div className="flex items-center justify-between">
            <SectionHeader icon={<ScrollText className="h-4 w-4 text-cyan-400" />} title="Container Logs" />
            <div className="flex items-center gap-2">
              <button
                onClick={handleFetchLogs}
                disabled={logsLoading}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${logsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowLogs(false)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          <pre
            className="
              glass-subtle mt-3 p-4 max-h-80 overflow-auto
              text-xs leading-relaxed font-mono text-slate-300
              whitespace-pre-wrap break-words scrollbar-thin
            "
          >
            {containerLogs || 'No logs available.'}
          </pre>
        </section>
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
    <span className="text-xs text-slate-500 uppercase tracking-wide w-32 flex-shrink-0">
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
