// =============================================================================
// Diagnostics — Deep-insight system diagnostics with gauges, matrices & alerts
// =============================================================================

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import {
  Shield, Activity, Cpu, MemoryStick, Box, HardDrive, Network,
  AlertTriangle, CheckCircle, XCircle, BarChart3, RefreshCw,
  Zap, TrendingUp, Server, Play, Square, RotateCw, Wrench, Loader2, Power,
  Lock, Trash2, RotateCcw,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { usePolling } from '../hooks/usePolling'
import {
  fetchServerStatus, fetchHealthReport, fetchContainers,
  fetchImages, fetchNetworks, fetchEvents, fetchSystemInfo,
  batchStackAction, authFactoryReset,
} from '../api/endpoints'
import { apiClient } from '../api/client'
import { useConnectionStore } from '../stores/connectionStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useSettingsStore, DEFAULT_SETTINGS } from '../stores/settingsStore'
import { useAuthStore } from '../stores/authStore'
import type {
  ServerStatus, HealthReport, ContainerInfo, ImageInfo,
  NetworkInfo, EventEntry, SystemInfo,
} from '../../shared/types'

// =============================================================================
// Types
// =============================================================================

interface ContainerListResponse { total: number; containers: ContainerInfo[] }
interface ImageListResponse { total: number; images: ImageInfo[] }
interface NetworkListResponse { total: number; networks: NetworkInfo[] }
interface EventsResponse { total: number; events: EventEntry[] }

// =============================================================================
// Helpers
// =============================================================================

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0
}

function scoreLabel(score: number): { text: string; color: string } {
  if (score >= 90) return { text: 'Excellent', color: 'text-emerald-400' }
  if (score >= 70) return { text: 'Good', color: 'text-cyan-400' }
  if (score >= 50) return { text: 'Fair', color: 'text-amber-400' }
  if (score >= 30) return { text: 'Poor', color: 'text-orange-400' }
  return { text: 'Critical', color: 'text-rose-400' }
}

function scoreGradientId(score: number): string {
  if (score >= 70) return 'gaugeGradientGood'
  if (score >= 40) return 'gaugeGradientWarn'
  return 'gaugeGradientBad'
}

function gaugeColor(pctVal: number): string {
  if (pctVal <= 50) return '#10b981'
  if (pctVal <= 75) return '#f59e0b'
  return '#f43f5e'
}

// =============================================================================
// SVG Health Score Ring
// =============================================================================

function HealthScoreRing({ score }: { score: number }) {
  const radius = 88
  const stroke = 10
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (clamp(score, 0, 100) / 100) * circumference
  const gradId = scoreGradientId(score)
  const label = scoreLabel(score)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={220} height={220} viewBox="0 0 220 220" className="transform -rotate-90">
        <defs>
          <linearGradient id="gaugeGradientGood" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="gaugeGradientWarn" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="gaugeGradientBad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx="110" cy="110" r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke}
        />
        {/* Score arc */}
        <circle
          cx="110" cy="110" r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          filter="url(#glow)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tabular-nums text-slate-100">{score}</span>
        <span className={`text-xs font-semibold uppercase tracking-widest mt-1 ${label.color}`}>
          {label.text}
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Semi-Circular Gauge
// =============================================================================

function SemiGauge({
  label, value, icon, suffix = '%',
}: {
  label: string; value: number; icon: React.ReactNode; suffix?: string
}) {
  const clamped = clamp(value, 0, 100)
  const radius = 52
  const stroke = 8
  // Semi-circle: PI * r
  const halfCircumference = Math.PI * radius
  const dashOffset = halfCircumference - (clamped / 100) * halfCircumference
  const color = gaugeColor(clamped)

  return (
    <div className="flex flex-col items-center bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl px-5 py-5 hover:border-white/[0.1] transition-all duration-300">
      <div className="relative mb-2">
        <svg width={120} height={68} viewBox="0 0 120 68">
          <defs>
            <linearGradient id={`semiGrad-${label.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>
          {/* Track */}
          <path
            d={`M ${60 - radius} 62 A ${radius} ${radius} 0 0 1 ${60 + radius} 62`}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d={`M ${60 - radius} 62 A ${radius} ${radius} 0 0 1 ${60 + radius} 62`}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={halfCircumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease' }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-xl font-bold tabular-nums text-slate-100">
            {Math.round(clamped)}<span className="text-xs text-slate-500 ml-0.5">{suffix}</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-slate-500 opacity-60">{icon}</span>
        <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">{label}</span>
      </div>
    </div>
  )
}

// =============================================================================
// Section Header
// =============================================================================

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="text-slate-500">{icon}</span>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
    </div>
  )
}

// =============================================================================
// Container Health Matrix
// =============================================================================

function ContainerHealthMatrix({ containers }: { containers: ContainerInfo[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (containers.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-600 text-xs">
        No containers detected
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5">
        {containers.map((c, idx) => {
          const state = c.state?.toLowerCase() ?? ''
          const health = c.health?.toLowerCase() ?? ''
          let bg = 'bg-slate-600/40' // stopped
          if (state === 'running') {
            if (health === 'healthy') bg = 'bg-emerald-500'
            else if (health === 'unhealthy') bg = 'bg-rose-500'
            else bg = 'bg-amber-500/80' // starting / no healthcheck
          }

          return (
            <div
              key={c.name}
              className="relative group"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div
                className={`w-5 h-5 rounded-[4px] cursor-pointer transition-all duration-200
                  ${bg} hover:scale-125 hover:ring-2 hover:ring-white/20`}
              />
              {hoveredIdx === idx && (
                <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none animate-fade-in">
                  <div className="bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                    <p className="text-xs font-semibold text-slate-200">{c.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                      {state}{health ? ` / ${health}` : ''}
                    </p>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-slate-900/95 border-r border-b border-white/10 rotate-45 -mt-1" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/[0.04]">
        {[
          { label: 'Healthy', color: 'bg-emerald-500' },
          { label: 'Starting', color: 'bg-amber-500/80' },
          { label: 'Unhealthy', color: 'bg-rose-500' },
          { label: 'Stopped', color: 'bg-slate-600/40' },
        ].map(({ label: l, color }) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            <span className="text-[10px] text-slate-500 font-medium">{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Image Freshness Bar
// =============================================================================

function ImageFreshnessBar({ images }: { images: ImageInfo[] }) {
  const counts = useMemo(() => {
    const c = { current: 0, aging: 0, stale: 0, unknown: 0 }
    for (const img of images) {
      const s = img.staleness ?? 'unknown'
      if (s in c) (c as Record<string, number>)[s]++
      else c.unknown++
    }
    return c
  }, [images])

  const total = images.length
  if (total === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-600 text-xs">
        No images found
      </div>
    )
  }

  const segments = [
    { key: 'current', label: 'Current', count: counts.current, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
    { key: 'aging', label: 'Aging', count: counts.aging, color: 'bg-amber-500', textColor: 'text-amber-400' },
    { key: 'stale', label: 'Stale', count: counts.stale, color: 'bg-rose-500', textColor: 'text-rose-400' },
    { key: 'unknown', label: 'Unknown', count: counts.unknown, color: 'bg-slate-500', textColor: 'text-slate-400' },
  ].filter(s => s.count > 0)

  return (
    <div>
      {/* Bar */}
      <div className="flex h-5 rounded-full overflow-hidden bg-slate-800/60 mb-4">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`${seg.color} transition-all duration-700 ease-out relative group`}
            style={{ width: `${(seg.count / total) * 100}%` }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10" />
          </div>
        ))}
      </div>
      {/* Labels */}
      <div className="flex items-center gap-5 flex-wrap">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${seg.color}`} />
            <span className="text-xs text-slate-400 font-medium">{seg.label}</span>
            <span className={`text-xs font-bold tabular-nums ${seg.textColor}`}>
              {seg.count}
            </span>
            <span className="text-[10px] text-slate-600">
              ({pct(seg.count, total)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Port Allocation Map
// =============================================================================

function PortAllocationMap({ containers }: { containers: ContainerInfo[] }) {
  const portEntries = useMemo(() => {
    const entries: { container: string; host: string; container_port: string; protocol: string }[] = []
    for (const c of containers) {
      if (!c.ports) continue
      // Parse formats like: "0.0.0.0:8080->80/tcp, :::8080->80/tcp"
      const parts = c.ports.split(',').map(p => p.trim()).filter(Boolean)
      for (const part of parts) {
        const match = part.match(/(?:(\S+):)?(\d+)->(\d+)\/(tcp|udp)/i)
        if (match) {
          entries.push({
            container: c.name,
            host: match[2],
            container_port: match[3],
            protocol: match[4].toUpperCase(),
          })
        }
      }
    }
    // Deduplicate by host port + container (0.0.0.0 and ::: map to same)
    const seen = new Set<string>()
    return entries.filter(e => {
      const key = `${e.container}:${e.host}:${e.container_port}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => parseInt(a.host) - parseInt(b.host))
  }, [containers])

  if (portEntries.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-600 text-xs">
        No port mappings detected
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Host Port</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Container Port</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Protocol</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Container</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {portEntries.slice(0, 20).map((entry, idx) => (
            <tr key={idx} className="hover:bg-white/[0.02] transition-colors duration-150">
              <td className="px-3 py-2">
                <span className="inline-flex items-center rounded-md bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-xs font-mono font-medium text-cyan-400">
                  :{entry.host}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-slate-300">{entry.container_port}</td>
              <td className="px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{entry.protocol}</span>
              </td>
              <td className="px-3 py-2 text-xs font-medium text-slate-200 truncate max-w-[200px]">{entry.container}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {portEntries.length > 20 && (
        <div className="text-center py-2 text-[10px] text-slate-600">
          +{portEntries.length - 20} more port mappings
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Event Frequency Chart
// =============================================================================

const EVENT_COLORS: Record<string, string> = {
  start: '#10b981',
  create: '#06b6d4',
  stop: '#f43f5e',
  destroy: '#e11d48',
  die: '#fb7185',
  kill: '#f97316',
  restart: '#f59e0b',
  pull: '#8b5cf6',
  connect: '#22d3ee',
  disconnect: '#94a3b8',
}

function EventFrequencyChart({ events }: { events: EventEntry[] }) {
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of events) {
      counts[e.action] = (counts[e.action] || 0) + 1
    }
    return Object.entries(counts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [events])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-600 text-xs">
        No events to chart
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <XAxis
          dataKey="action"
          tick={{ fontSize: 10, fill: '#64748b' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(15,23,42,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#e2e8f0',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
          labelStyle={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em' }}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {chartData.map((entry) => (
            <Cell key={entry.action} fill={EVENT_COLORS[entry.action] || '#64748b'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// =============================================================================
// Network Topology Summary
// =============================================================================

function NetworkTopology({ networks }: { networks: NetworkInfo[] }) {
  if (networks.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-600 text-xs">
        No networks found
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {networks.map((net, idx) => (
        <div
          key={net.id}
          className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 hover:border-white/[0.1] transition-all duration-300 group animate-fade-in"
          style={{ animationDelay: `${idx * 60}ms` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/15 transition-colors">
              <Network size={14} className="text-cyan-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{net.name}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Driver</span>
              <span className="text-[10px] font-mono text-slate-300">{net.driver}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Scope</span>
              <span className="text-[10px] font-mono text-slate-300">{net.scope}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Containers</span>
              <span className={`text-xs font-bold tabular-nums ${net.containers.length > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {net.containers.length}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Alerts Panel
// =============================================================================

interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
}

function AlertsPanel({
  containers, images, status, cpuCount,
}: {
  containers: ContainerInfo[]
  images: ImageInfo[]
  status: ServerStatus | null
  cpuCount: number
}) {
  const alerts = useMemo<Alert[]>(() => {
    const a: Alert[] = []

    // Containers with restart_count > 0
    for (const c of containers) {
      if (c.restart_count > 0) {
        a.push({
          id: `restart-${c.name}`,
          severity: c.restart_count > 5 ? 'critical' : 'warning',
          title: `Container "${c.name}" has restarted ${c.restart_count} time${c.restart_count !== 1 ? 's' : ''}`,
          detail: 'Check container logs for crash loops or resource issues.',
        })
      }
    }

    // Unhealthy containers
    for (const c of containers) {
      if (c.health?.toLowerCase() === 'unhealthy') {
        a.push({
          id: `unhealthy-${c.name}`,
          severity: 'critical',
          title: `Container "${c.name}" is unhealthy`,
          detail: 'Health check is failing. Inspect the container for errors.',
        })
      }
    }

    // Stale images
    const staleImages = images.filter(i => i.staleness === 'stale')
    if (staleImages.length > 0) {
      a.push({
        id: 'stale-images',
        severity: 'warning',
        title: `${staleImages.length} stale image${staleImages.length !== 1 ? 's' : ''} detected`,
        detail: `Images older than 30 days: ${staleImages.slice(0, 3).map(i => i.repository).join(', ')}${staleImages.length > 3 ? '...' : ''}`,
      })
    }

    // High memory usage
    if (status?.system) {
      const { total, available } = status.system.memory_mb
      const usedPct = total > 0 ? ((total - available) / total) * 100 : 0
      if (usedPct > 90) {
        a.push({
          id: 'memory-critical',
          severity: 'critical',
          title: `Memory usage is critically high (${Math.round(usedPct)}%)`,
          detail: `${Math.round(available)} MB available out of ${Math.round(total)} MB total.`,
        })
      } else if (usedPct > 80) {
        a.push({
          id: 'memory-high',
          severity: 'warning',
          title: `Memory usage is high (${Math.round(usedPct)}%)`,
          detail: `${Math.round(available)} MB available out of ${Math.round(total)} MB total.`,
        })
      }
    }

    // High load average
    if (status?.system && cpuCount > 0) {
      const load = status.system.load_average[0]
      if (load > cpuCount) {
        a.push({
          id: 'load-high',
          severity: load > cpuCount * 2 ? 'critical' : 'warning',
          title: `Load average (${load.toFixed(2)}) exceeds CPU count (${cpuCount})`,
          detail: 'System may be overloaded. Check for CPU-intensive processes.',
        })
      }
    }

    return a
  }, [containers, images, status, cpuCount])

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 py-6 justify-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle size={20} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-400">All Clear</p>
          <p className="text-[11px] text-slate-500">No alerts or issues detected</p>
        </div>
      </div>
    )
  }

  const severityConfig = {
    critical: {
      border: 'border-rose-500/20',
      bg: 'bg-rose-500/[0.06]',
      icon: <XCircle size={16} className="text-rose-400 shrink-0" />,
      titleColor: 'text-rose-300',
    },
    warning: {
      border: 'border-amber-500/20',
      bg: 'bg-amber-500/[0.06]',
      icon: <AlertTriangle size={16} className="text-amber-400 shrink-0" />,
      titleColor: 'text-amber-300',
    },
    info: {
      border: 'border-cyan-500/20',
      bg: 'bg-cyan-500/[0.06]',
      icon: <Zap size={16} className="text-cyan-400 shrink-0" />,
      titleColor: 'text-cyan-300',
    },
  }

  return (
    <div className="space-y-2.5 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
      {alerts.map((alert, idx) => {
        const cfg = severityConfig[alert.severity]
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-xl border p-3.5 ${cfg.border} ${cfg.bg} animate-fade-in`}
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <div className="mt-0.5">{cfg.icon}</div>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-semibold ${cfg.titleColor}`}>{alert.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{alert.detail}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// =============================================================================
// Server Control Card
// =============================================================================

function ServerControlCard() {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [lastResult, setLastResult] = useState<{ action: string; success: boolean; message: string } | null>(null)

  const handleAction = useCallback(async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action)
    setLastResult(null)
    try {
      const result = await batchStackAction(action, 'all')
      const successCount = result.results?.filter((r: { success: boolean }) => r.success).length ?? 0
      const totalCount = result.results?.length ?? 0
      setLastResult({
        action,
        success: successCount === totalCount,
        message: `${action.charAt(0).toUpperCase() + action.slice(1)}: ${successCount}/${totalCount} stacks succeeded`,
      })
    } catch (err) {
      setLastResult({
        action,
        success: false,
        message: `Failed to ${action}: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    } finally {
      setActionLoading(null)
    }
  }, [])

  const toggleMaintenance = useCallback(() => {
    setMaintenanceMode((prev) => !prev)
    setLastResult({
      action: 'maintenance',
      success: true,
      message: maintenanceMode ? 'Maintenance mode disabled' : 'Maintenance mode enabled — new connections will be paused',
    })
  }, [maintenanceMode])

  const actions = [
    {
      id: 'start' as const,
      label: 'Start All',
      icon: Play,
      color: 'emerald',
      bgHover: 'hover:bg-emerald-500/15 hover:border-emerald-500/25',
      iconColor: 'text-emerald-400',
      desc: 'Start all stacks',
    },
    {
      id: 'stop' as const,
      label: 'Stop All',
      icon: Square,
      color: 'rose',
      bgHover: 'hover:bg-rose-500/15 hover:border-rose-500/25',
      iconColor: 'text-rose-400',
      desc: 'Stop all stacks',
    },
    {
      id: 'restart' as const,
      label: 'Restart All',
      icon: RotateCw,
      color: 'amber',
      bgHover: 'hover:bg-amber-500/15 hover:border-amber-500/25',
      iconColor: 'text-amber-400',
      desc: 'Restart all stacks',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Action buttons row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((action) => {
          const Icon = action.icon
          const isLoading = actionLoading === action.id
          const isDisabled = actionLoading !== null

          return (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              disabled={isDisabled}
              className={`
                group relative flex flex-col items-center gap-2.5 rounded-xl p-5
                bg-white/[0.02] border border-white/[0.06]
                ${action.bgHover}
                transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              <div className={`
                w-11 h-11 rounded-xl flex items-center justify-center
                bg-${action.color}-500/10 border border-${action.color}-500/15
                group-hover:bg-${action.color}-500/20 group-hover:scale-110
                transition-all duration-300
              `}>
                {isLoading ? (
                  <Loader2 size={20} className={`${action.iconColor} animate-spin`} />
                ) : (
                  <Icon size={20} className={action.iconColor} />
                )}
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-200">{action.label}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{action.desc}</p>
              </div>
            </button>
          )
        })}

        {/* Maintenance Mode Toggle */}
        <button
          onClick={toggleMaintenance}
          disabled={actionLoading !== null}
          className={`
            group relative flex flex-col items-center gap-2.5 rounded-xl p-5
            border transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed
            ${maintenanceMode
              ? 'bg-violet-500/10 border-violet-500/25 ring-1 ring-violet-500/20'
              : 'bg-white/[0.02] border-white/[0.06] hover:bg-violet-500/10 hover:border-violet-500/25'
            }
          `}
        >
          <div className={`
            w-11 h-11 rounded-xl flex items-center justify-center
            transition-all duration-300
            ${maintenanceMode
              ? 'bg-violet-500/20 border border-violet-500/25 scale-110'
              : 'bg-violet-500/10 border border-violet-500/15 group-hover:bg-violet-500/20 group-hover:scale-110'
            }
          `}>
            <Wrench size={20} className={`text-violet-400 ${maintenanceMode ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-200">Maintenance</p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {maintenanceMode ? 'Mode active' : 'Toggle mode'}
            </p>
          </div>
          {/* Active indicator */}
          {maintenanceMode && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-50" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-400" />
            </span>
          )}
        </button>
      </div>

      {/* Result message */}
      {lastResult && (
        <div className={`
          flex items-center gap-3 rounded-xl px-4 py-3 border animate-fade-in
          ${lastResult.success
            ? 'bg-emerald-500/[0.06] border-emerald-500/20'
            : 'bg-rose-500/[0.06] border-rose-500/20'
          }
        `}>
          {lastResult.success ? (
            <CheckCircle size={15} className="text-emerald-400 shrink-0" />
          ) : (
            <XCircle size={15} className="text-rose-400 shrink-0" />
          )}
          <p className={`text-xs font-medium ${lastResult.success ? 'text-emerald-300' : 'text-rose-300'}`}>
            {lastResult.message}
          </p>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Factory Reset Card — shared password verification + two reset modes
// =============================================================================

/** Verify the current user's password using Web Crypto PBKDF2 / SHA-256 */
async function verifyCurrentPassword(password: string): Promise<{ valid: boolean; error?: string }> {
  const { currentUser } = useAuthStore.getState()
  if (!currentUser) return { valid: false, error: 'Not logged in' }

  const accounts: { username: string; passwordHash: string; salt?: string; hashVersion?: number }[] = await (async () => {
    if (window.electronAPI) {
      const accts = await window.electronAPI.getSetting('userAccounts')
      return (accts as typeof accounts) ?? []
    }
    try {
      const raw = localStorage.getItem('userAccounts')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })()

  const account = accounts.find((a) => a.username.toLowerCase() === currentUser.toLowerCase())
  if (!account) return { valid: false, error: 'Account not found' }

  let valid = false
  if (account.hashVersion === 2 && account.salt) {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
    const saltBytes = new Uint8Array(account.salt.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)))
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      256,
    )
    const derived = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, '0')).join('')
    valid = derived === account.passwordHash
  } else {
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password))
    const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
    valid = hash === account.passwordHash
  }

  return valid ? { valid: true } : { valid: false, error: 'Incorrect password' }
}

/** Perform the client-side reset (clear all local data, return to first-launch) */
async function performClientReset(): Promise<void> {
  // Preserve server URL so we can reconnect to setup wizard after reset
  const currentServerUrl = useSettingsStore.getState().serverUrl

  localStorage.clear()
  sessionStorage.clear()

  if (window.electronAPI) {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      await window.electronAPI.setSetting(key, undefined)
    }
    await window.electronAPI.setSetting('userAccounts', undefined)
  }

  useSettingsStore.setState({ ...DEFAULT_SETTINGS, currentPage: 'dashboard' })

  // Restore server URL so setup wizard can reconnect
  useSettingsStore.getState().updateSetting('serverUrl', currentServerUrl)
  useConnectionStore.getState().setServerUrl(currentServerUrl)
  apiClient.setBaseUrl(currentServerUrl)

  useConnectionStore.getState().disconnect()
  useAuthStore.setState({
    isAuthenticated: false,
    currentUser: null,
    hasAccount: false,
    apiToken: null,
  })
}

/** Perform server-side factory reset via dedicated endpoint */
async function performServerReset(resetCompose: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await authFactoryReset({ confirm: 'FACTORY_RESET', reset_compose: resetCompose })
    return result.success ? { success: true } : { success: false, error: 'Server reset returned failure' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to reach server' }
  }
}

function FactoryResetCard() {
  const [activeMode, setActiveMode] = useState<'none' | 'app' | 'full'>('none')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [serverResetResult, setServerResetResult] = useState<string | null>(null)
  const [resetCompose, setResetCompose] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const confirmKeyword = activeMode === 'full' ? 'WIPE' : 'RESET'
  const canReset = confirmText === confirmKeyword && confirmPassword.length > 0

  const cancelConfirm = useCallback(() => {
    setActiveMode('none')
    setConfirmPassword('')
    setConfirmText('')
    setResetError(null)
    setServerResetResult(null)
    setResetCompose(false)
    setCountdown(null)
  }, [])

  const handleAppReset = useCallback(async () => {
    if (!canReset) return
    setResetting(true)
    setResetError(null)
    const pw = await verifyCurrentPassword(confirmPassword)
    if (!pw.valid) {
      setResetError(pw.error ?? 'Verification failed')
      setResetting(false)
      return
    }
    await performClientReset()
  }, [canReset, confirmPassword])

  const handleFullReset = useCallback(async () => {
    if (!canReset || countdown !== null) return
    // Verify password first, then start countdown
    setResetError(null)
    setServerResetResult(null)
    const pw = await verifyCurrentPassword(confirmPassword)
    if (!pw.valid) {
      setResetError(pw.error ?? 'Verification failed')
      return
    }
    // Start 5-second countdown
    setCountdown(5)
  }, [canReset, confirmPassword, countdown])

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null || countdown < 0) return
    if (countdown === 0) {
      // Execute the reset
      ;(async () => {
        setResetting(true)
        const serverResult = await performServerReset(resetCompose)
        if (!serverResult.success) {
          setResetError(`Server reset failed: ${serverResult.error}`)
          setResetting(false)
          setCountdown(null)
          return
        }
        await performClientReset()
      })()
      return
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, resetCompose])

  // ── Idle state: show both buttons ──
  if (activeMode === 'none') {
    return (
      <div className="space-y-5">
        {/* App-only reset */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/10">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <RefreshCw size={16} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-300">Reset App Settings</p>
            <p className="text-[10px] text-amber-400/60 mt-1 leading-relaxed">
              Clears all local data — saved credentials, sessions, connection profiles, themes, and preferences. Returns the app to its initial setup screen. <span className="text-slate-500">Server-side data (stacks, containers, compose files, server config) is not affected.</span>
            </p>
            <button
              onClick={() => setActiveMode('app')}
              className="
                mt-3 flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-medium
                bg-amber-500/10 border border-amber-500/20 text-amber-400
                hover:bg-amber-500/20 hover:border-amber-500/30
                transition-all duration-200
              "
            >
              <RefreshCw size={13} />
              Reset App
            </button>
          </div>
        </div>

        {/* Full server + app reset */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-rose-500/[0.04] border border-rose-500/10">
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 size={16} className="text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-rose-300">Full Server Reset</p>
            <p className="text-[10px] text-rose-400/60 mt-1 leading-relaxed">
              Everything in App Reset, <span className="text-rose-300 font-medium">plus</span> wipes server-side authentication — all API users, tokens, and the setup-complete flag are removed. The server returns to first-run state and the Setup Wizard will launch on next connection. <span className="text-slate-500">Docker stacks, containers, images, and your .env configuration are preserved.</span>
            </p>
            <button
              onClick={() => setActiveMode('full')}
              className="
                mt-3 flex items-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-medium
                bg-rose-500/10 border border-rose-500/20 text-rose-400
                hover:bg-rose-500/20 hover:border-rose-500/30
                transition-all duration-200
              "
            >
              <Trash2 size={13} />
              Full Reset
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Confirmation state ──
  const isFullReset = activeMode === 'full'

  // Pre-defined class sets to avoid Tailwind purge issues with dynamic class names
  const styles = isFullReset
    ? {
        banner: 'bg-rose-500/[0.06] border-rose-500/15',
        icon: 'text-rose-400',
        title: 'text-rose-300',
        desc: 'text-rose-400/70',
        keyword: 'text-rose-300',
        inputFocus: 'focus:border-rose-500/50 focus:ring-rose-500/25',
        confirmMatch: 'border-rose-500/50 focus:border-rose-500/50 focus:ring-rose-500/25',
        button: 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/20',
      }
    : {
        banner: 'bg-amber-500/[0.06] border-amber-500/15',
        icon: 'text-amber-400',
        title: 'text-amber-300',
        desc: 'text-amber-400/70',
        keyword: 'text-amber-300',
        inputFocus: 'focus:border-amber-500/50 focus:ring-amber-500/25',
        confirmMatch: 'border-amber-500/50 focus:border-amber-500/50 focus:ring-amber-500/25',
        button: 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20',
      }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className={`flex items-start gap-3 rounded-xl ${styles.banner} border px-4 py-3`}>
        <AlertTriangle size={15} className={`${styles.icon} shrink-0 mt-0.5`} />
        <div>
          <p className={`text-xs font-semibold ${styles.title}`}>
            {isFullReset ? 'Confirm Full Server Reset' : 'Confirm App Reset'}
          </p>
          <p className={`text-[10px] ${styles.desc} mt-0.5`}>
            Enter your current password and type{' '}
            <span className={`font-mono font-bold ${styles.keyword}`}>{confirmKeyword}</span> to confirm.
            {isFullReset && (
              <span className="block mt-1 text-rose-400/60">
                This will wipe all server authentication and return to the Setup Wizard.
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-1">Current Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setResetError(null) }}
              placeholder="Enter your password"
              autoComplete="current-password"
              className={`
                w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg
                text-xs text-slate-200 placeholder-slate-600
                focus:outline-none ${styles.inputFocus}
                transition-all
              `}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-1">
            Type {confirmKeyword} to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => { setConfirmText(e.target.value); setResetError(null) }}
            placeholder={confirmKeyword}
            autoComplete="off"
            className={`
              w-full px-3 py-2 bg-white/5 border rounded-lg
              text-xs text-slate-200 placeholder-slate-600 font-mono
              focus:outline-none focus:ring-1 transition-all
              ${confirmText === confirmKeyword
                ? styles.confirmMatch
                : 'border-white/10 focus:border-white/20 focus:ring-white/10'
              }
            `}
          />
        </div>
      </div>

      {/* Compose reset toggle (full reset only) */}
      {isFullReset && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <div>
            <p className="text-[11px] font-medium text-slate-300">Reset Compose Files</p>
            <p className="text-[10px] text-slate-500">Restore compose files and stack categories to defaults</p>
          </div>
          <button
            type="button"
            onClick={() => setResetCompose(!resetCompose)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${resetCompose ? 'bg-rose-500' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${resetCompose ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      )}

      {resetError && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2">
          <XCircle size={13} className="text-rose-400 shrink-0" />
          <p className="text-[11px] text-rose-300">{resetError}</p>
        </div>
      )}

      {serverResetResult && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
          <CheckCircle size={13} className="text-emerald-400 shrink-0" />
          <p className="text-[11px] text-emerald-300">{serverResetResult}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={isFullReset ? handleFullReset : handleAppReset}
          disabled={!canReset || resetting || (countdown !== null && countdown > 0)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold
            ${styles.button} text-white shadow-lg
            transition-all duration-200 press
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
        >
          {resetting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : countdown !== null && countdown > 0 ? (
            <RotateCcw size={14} />
          ) : isFullReset ? (
            <Trash2 size={14} />
          ) : (
            <RefreshCw size={14} />
          )}
          {resetting
            ? 'Resetting...'
            : countdown !== null && countdown > 0
              ? `Confirm in ${countdown}s...`
              : isFullReset
                ? 'Confirm Full Reset'
                : 'Confirm App Reset'
          }
        </button>
        <button
          onClick={cancelConfirm}
          className="px-4 py-2.5 rounded-lg text-xs font-medium text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all press"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Disconnected Hero
// =============================================================================

function DisconnectedHero() {
  const connect = useConnectionStore((s) => s.connect)
  const connectionStatus = useConnectionStore((s) => s.status)
  const isConnecting = connectionStatus === 'connecting'

  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-56 h-56 rounded-full bg-emerald-500/[0.03] blur-3xl animate-breathe" />
        <div className="absolute bottom-1/3 right-1/3 w-64 h-64 rounded-full bg-cyan-500/[0.03] blur-3xl animate-breathe" style={{ animationDelay: '3s' }} />
      </div>
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-slate-800/60 border border-white/[0.06] flex items-center justify-center">
          <Shield size={32} className="text-slate-500" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-2">
        {isConnecting ? 'Connecting...' : 'Diagnostics Unavailable'}
      </h3>
      <p className="text-sm text-slate-500 text-center max-w-xs mb-5">
        Connect to your Docker API to access system diagnostics.
      </p>
      {!isConnecting && (
        <button
          onClick={() => connect()}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Server size={15} />
          Connect
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Main Diagnostics Page
// =============================================================================

export default function Diagnostics() {
  const connectionStatus = useConnectionStore((s) => s.status)
  const isConnected = connectionStatus === 'connected'
  const reportPollSuccess = useConnectionStore((s) => s.reportPollSuccess)
  const reportPollFailure = useConnectionStore((s) => s.reportPollFailure)

  const onPollSuccess = useCallback(() => { reportPollSuccess() }, [reportPollSuccess])
  const onPollError = useCallback(() => { reportPollFailure() }, [reportPollFailure])

  // --- Data polling ---

  const statusPoll = usePolling<ServerStatus>(fetchServerStatus, 5000, {
    enabled: isConnected, onError: onPollError,
  })
  React.useEffect(() => { if (statusPoll.data) onPollSuccess() }, [statusPoll.data, onPollSuccess])

  const healthPoll = usePolling<HealthReport>(fetchHealthReport, 5000, {
    enabled: isConnected, onError: onPollError,
  })
  React.useEffect(() => { if (healthPoll.data) onPollSuccess() }, [healthPoll.data, onPollSuccess])

  const containersPoll = usePolling<ContainerListResponse>(fetchContainers, 10000, {
    enabled: isConnected, onError: onPollError,
  })
  React.useEffect(() => { if (containersPoll.data) onPollSuccess() }, [containersPoll.data, onPollSuccess])

  const imagesPoll = usePolling<ImageListResponse>(fetchImages, 30000, {
    enabled: isConnected, onError: onPollError,
  })
  React.useEffect(() => { if (imagesPoll.data) onPollSuccess() }, [imagesPoll.data, onPollSuccess])

  const networksPoll = usePolling<NetworkListResponse>(fetchNetworks, 30000, {
    enabled: isConnected, onError: onPollError,
  })
  React.useEffect(() => { if (networksPoll.data) onPollSuccess() }, [networksPoll.data, onPollSuccess])

  const eventsPoll = usePolling<EventsResponse>(fetchEvents, 5000, {
    enabled: isConnected, onError: onPollError,
  })
  React.useEffect(() => { if (eventsPoll.data) onPollSuccess() }, [eventsPoll.data, onPollSuccess])

  const systemInfoPoll = usePolling<SystemInfo>(fetchSystemInfo, 60000, {
    enabled: isConnected, onError: onPollError,
  })
  React.useEffect(() => { if (systemInfoPoll.data) onPollSuccess() }, [systemInfoPoll.data, onPollSuccess])

  // --- Extracted data ---

  const status = statusPoll.data
  const health = healthPoll.data
  const containers: ContainerInfo[] = containersPoll.data?.containers ?? []
  const images: ImageInfo[] = imagesPoll.data?.images ?? []
  const networks: NetworkInfo[] = networksPoll.data?.networks ?? []
  const events: EventEntry[] = eventsPoll.data?.events ?? []
  const systemInfo = systemInfoPoll.data
  const cpuCount = systemInfo?.cpu_count ?? 1

  // --- Computed gauges ---

  const memoryUsedPct = useMemo(() => {
    if (!status?.system) return 0
    const { total, available } = status.system.memory_mb
    return total > 0 ? ((total - available) / total) * 100 : 0
  }, [status])

  const cpuLoadPct = useMemo(() => {
    if (!status?.system) return 0
    const load = status.system.load_average[0]
    return clamp((load / cpuCount) * 100, 0, 100)
  }, [status, cpuCount])

  const containerRunPct = useMemo(() => {
    if (!status?.docker) return 0
    const { running, total } = status.docker.containers
    return total > 0 ? (running / total) * 100 : 0
  }, [status])

  const imageHealthPct = useMemo(() => {
    if (images.length === 0) return 100
    const current = images.filter(i => i.staleness === 'current').length
    return (current / images.length) * 100
  }, [images])

  // --- Health score computation ---

  const healthScore = useMemo(() => {
    let score = 100
    let factors = 0

    // 1. Container health ratio (weight: 35)
    if (health) {
      const { total, healthy } = health.summary
      if (total > 0) {
        score -= (1 - (healthy / total)) * 35
      }
      factors++
    }

    // 2. Image freshness (weight: 20)
    if (images.length > 0) {
      const stale = images.filter(i => i.staleness === 'stale').length
      const aging = images.filter(i => i.staleness === 'aging').length
      score -= (stale / images.length) * 20
      score -= (aging / images.length) * 5
      factors++
    }

    // 3. Memory usage (weight: 25)
    if (status?.system) {
      const memPct = memoryUsedPct
      if (memPct > 90) score -= 25
      else if (memPct > 80) score -= 15
      else if (memPct > 70) score -= 8
      factors++
    }

    // 4. Load average (weight: 20)
    if (status?.system && cpuCount > 0) {
      const loadRatio = status.system.load_average[0] / cpuCount
      if (loadRatio > 2) score -= 20
      else if (loadRatio > 1.5) score -= 15
      else if (loadRatio > 1) score -= 10
      else if (loadRatio > 0.8) score -= 5
      factors++
    }

    return factors > 0 ? Math.max(0, Math.round(score)) : 0
  }, [health, images, status, memoryUsedPct, cpuCount])

  // --- Refresh all ---
  const refreshAll = useCallback(() => {
    statusPoll.refresh()
    healthPoll.refresh()
    containersPoll.refresh()
    imagesPoll.refresh()
    networksPoll.refresh()
    eventsPoll.refresh()
    systemInfoPoll.refresh()
  }, [statusPoll, healthPoll, containersPoll, imagesPoll, networksPoll, eventsPoll, systemInfoPoll])

  const isLoading = statusPoll.loading && !status

  // Determine if we should show disconnected state
  const hasNoData = !status && !health && containers.length === 0
  const showDisconnected = !isConnected && hasNoData

  return (
    <div className="space-y-3 md:space-y-6">
      <DisconnectedBanner />
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight">
            <span className="text-gradient">Diagnostics</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Deep-insight system health, resource usage, and alerts
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>
          )}
          {isConnected && (
            <button
              onClick={refreshAll}
              disabled={isLoading}
              className="
                flex items-center gap-1.5 rounded-lg px-3 py-2
                text-xs font-medium text-slate-300
                bg-white/5 border border-white/10
                hover:bg-white/10 hover:border-white/15
                disabled:opacity-50 transition-all duration-200
              "
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              Refresh All
            </button>
          )}
        </div>
      </div>

      {showDisconnected ? (
        <DisconnectedHero />
      ) : (
        <div className="space-y-3 md:space-y-6 stagger-children">

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ROW 1: Health Score + Resource Gauges                     */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6">

            {/* Health Score Ring */}
            <div className="lg:col-span-4">
              <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-6 flex flex-col items-center justify-center h-full relative overflow-hidden">
                {/* Ambient glow behind ring */}
                <div className="absolute inset-0 pointer-events-none">
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-3xl animate-breathe"
                    style={{
                      backgroundColor: healthScore >= 70
                        ? 'rgba(16,185,129,0.06)'
                        : healthScore >= 40
                          ? 'rgba(245,158,11,0.06)'
                          : 'rgba(244,63,94,0.06)',
                    }}
                  />
                </div>
                <SectionHeader icon={<Shield size={14} />} title="System Health Score" />
                <HealthScoreRing score={healthScore} />
                <p className="text-[11px] text-slate-600 mt-4 text-center max-w-[200px]">
                  Calculated from container health, image freshness, memory, and CPU load
                </p>
              </div>
            </div>

            {/* Resource Gauges + Server Control */}
            <div className="lg:col-span-8 flex flex-col gap-3 md:gap-6">
              <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-6">
                <SectionHeader icon={<Activity size={14} />} title="Resource Gauges" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                  <SemiGauge
                    label="CPU Load"
                    value={cpuLoadPct}
                    icon={<Cpu size={12} />}
                  />
                  <SemiGauge
                    label="Memory"
                    value={memoryUsedPct}
                    icon={<MemoryStick size={12} />}
                  />
                  <SemiGauge
                    label="Containers"
                    value={containerRunPct}
                    icon={<Box size={12} />}
                  />
                  <SemiGauge
                    label="Image Health"
                    value={imageHealthPct}
                    icon={<HardDrive size={12} />}
                  />
                </div>
              </div>
              <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-6">
                <SectionHeader icon={<Power size={14} />} title="Server Control" />
                <ServerControlCard />
              </div>
              <div className="bg-slate-900/60 backdrop-blur-md border border-rose-500/10 rounded-xl p-4 md:p-6">
                <SectionHeader icon={<Trash2 size={14} />} title="Factory Reset" />
                <FactoryResetCard />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ROW 2: Container Matrix + Image Freshness                */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">

            {/* Container Health Matrix */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-6">
              <SectionHeader icon={<Box size={14} />} title="Container Health Matrix" />
              <ContainerHealthMatrix containers={containers} />
            </div>

            {/* Image Freshness Breakdown */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-6">
              <SectionHeader icon={<HardDrive size={14} />} title="Image Freshness" />
              <ImageFreshnessBar images={images} />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ROW 3: Port Map + Event Chart                            */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">

            {/* Port Allocation Map */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-6">
              <SectionHeader icon={<TrendingUp size={14} />} title="Port Allocation Map" />
              <PortAllocationMap containers={containers} />
            </div>

            {/* Event Frequency */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-6">
              <SectionHeader icon={<BarChart3 size={14} />} title="Event Frequency" />
              <EventFrequencyChart events={events} />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ROW 4: Network Topology                                  */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-6">
            <SectionHeader icon={<Network size={14} />} title="Network Topology" />
            <NetworkTopology networks={networks} />
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* ROW 5: Alerts Panel                                      */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-4 md:p-6">
            <SectionHeader icon={<AlertTriangle size={14} />} title="Active Alerts" />
            <AlertsPanel
              containers={containers}
              images={images}
              status={status}
              cpuCount={cpuCount}
            />
          </div>

        </div>
      )}
    </div>
  )
}
