// =============================================================================
// ContainerDetail — Detailed view for a single container with live stats
// =============================================================================

import React, { useEffect, useCallback, useRef, useState } from 'react'
import { ContainerInfo, ContainerDetail as ContainerDetailType, ContainerStats } from '../../../shared/types'
import { useContainerStore } from '../../stores/containerStore'
import { fetchContainer, fetchContainerStats, fetchContainerLogs, startContainer, stopContainer, restartContainer } from '../../api/endpoints'
import {
  ArrowLeft,
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

      {/* ---- Environment variables ---- */}
      {envEntries.length > 0 && (
        <section>
          <SectionHeader icon={<Variable className="h-4 w-4 text-amber-400" />} title="Environment Variables" />
          <div className="glass-subtle mt-3 max-h-64 overflow-y-auto scrollbar-thin divide-y divide-white/[0.04]">
            {envEntries.map((entry, idx) => (
              <div key={idx} className="flex gap-3 px-4 py-2">
                <span className="text-xs font-mono text-emerald-400 w-56 flex-shrink-0 truncate" title={entry.key}>
                  {entry.key}
                </span>
                <span className="text-xs font-mono text-slate-400 truncate" title={entry.value}>
                  {entry.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Mounts ---- */}
      {mounts.length > 0 && (
        <section>
          <SectionHeader icon={<FolderOpen className="h-4 w-4 text-cyan-400" />} title="Mounts" />
          <div className="glass-subtle mt-3 divide-y divide-white/[0.04]">
            {mounts.map((mount, idx) => (
              <div key={idx} className="px-4 py-2.5">
                <span className="text-xs font-mono text-slate-300">{mount}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Networks ---- */}
      {networks.length > 0 && (
        <section>
          <SectionHeader icon={<Globe className="h-4 w-4 text-purple-400" />} title="Networks" />
          <div className="flex flex-wrap gap-2 mt-3">
            {networks.map((net, idx) => (
              <span
                key={idx}
                className="
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/20
                "
              >
                <Layers className="h-3 w-3" />
                {net}
              </span>
            ))}
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
