// =============================================================================
// System — System info, Docker disk usage, and Maintenance operations
// =============================================================================

import React, { useState, useEffect } from 'react'
import {
  Monitor, Cpu, MemoryStick, HardDrive, Server, RefreshCw,
  Trash2, AlertTriangle, CheckCircle, XCircle, Loader2,
  Gauge, Database, Zap, Wrench, ChevronDown,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { fetchSystemInfo, runDockerPrune, runImagePrune } from '../api/endpoints'
import { useSystemStore } from '../stores/systemStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import type { SystemInfo, DockerDiskUsage } from '../../shared/types'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMb(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`
  }
  return `${mb.toFixed(0)} MB`
}

// ---------------------------------------------------------------------------
// Section Card
// ---------------------------------------------------------------------------

interface SectionCardProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  accentColor?: 'emerald' | 'cyan' | 'amber' | 'rose' | 'violet'
  storageKey?: string
}

const accentBorderMap: Record<string, string> = {
  emerald: 'border-t-emerald-500',
  cyan: 'border-t-cyan-500',
  amber: 'border-t-amber-500',
  rose: 'border-t-rose-500',
  violet: 'border-t-violet-500',
}

function SectionCard({ icon, title, children, accentColor = 'emerald', storageKey }: SectionCardProps) {
  const key = storageKey || `sys-card-${title.toLowerCase().replace(/\s+/g, '-')}`
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(key) === 'true' } catch { return false }
  })
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(key, String(next)) } catch {}
  }

  return (
    <div className={`glass-subtle rounded-xl overflow-hidden border-t-2 ${accentBorderMap[accentColor]}`}>
      <div
        className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-500 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
        />
      </div>
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${collapsed ? 'max-h-0' : 'max-h-[2000px]'}`}>
        <div className="px-5 py-3">{children}</div>
      </div>
    </div>
  )
}

function KvRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-b-0">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-slate-200 font-mono">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Maintenance Panel
// ---------------------------------------------------------------------------

function MaintenancePanel() {
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin'
  const [pruning, setPruning] = useState(false)
  const [imagePruning, setImagePruning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<'prune' | 'image-prune' | null>(null)

  // Hide entire panel for non-admin users
  if (!isAdmin) return null

  const handlePrune = async () => {
    setConfirmAction(null)
    setPruning(true)
    setResult(null)
    try {
      const res = await runDockerPrune()
      setResult({
        success: res.success,
        message: res.success ? 'Docker system prune completed successfully' : (res.output || 'Prune failed'),
      })
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Prune failed' })
    } finally {
      setPruning(false)
    }
  }

  const handleImagePrune = async () => {
    setConfirmAction(null)
    setImagePruning(true)
    setResult(null)
    try {
      const res = await runImagePrune()
      setResult({
        success: res.success,
        message: res.success ? 'Image prune completed successfully' : (res.output || 'Image prune failed'),
      })
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Image prune failed' })
    } finally {
      setImagePruning(false)
    }
  }

  return (
    <SectionCard
      icon={<Wrench size={16} className="text-amber-400" />}
      title="Maintenance"
      accentColor="amber"
    >
      <p className="text-xs text-slate-500 mb-4">
        Clean up unused Docker resources to reclaim disk space.
      </p>

      {/* Result banner */}
      {result && (
        <div className={`
          flex items-center gap-2 rounded-lg p-3 mb-4 text-sm animate-fade-in
          ${result.success
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }
        `}>
          {result.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span>{result.message}</span>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 mb-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                {confirmAction === 'prune' ? 'Run Docker System Prune?' : 'Run Image Prune?'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {confirmAction === 'prune'
                  ? 'This will remove all stopped containers, unused networks, dangling images, and build cache.'
                  : 'This will remove unused Docker images to free disk space.'}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={confirmAction === 'prune' ? handlePrune : handleImagePrune}
                  className="
                    rounded-lg px-3 py-1.5 text-xs font-medium
                    bg-amber-500/20 text-amber-300 border border-amber-500/30
                    hover:bg-amber-500/30 transition-colors
                  "
                >
                  Yes, proceed
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="
                    rounded-lg px-3 py-1.5 text-xs font-medium
                    text-slate-400 border border-white/[0.08]
                    hover:bg-white/[0.04] transition-colors
                  "
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setConfirmAction('prune')}
          disabled={pruning || imagePruning}
          className="
            flex items-center gap-3 rounded-xl p-4
            bg-slate-800/40 border border-white/[0.04]
            hover:bg-slate-800/60 hover:border-white/[0.08]
            disabled:opacity-50 transition-all duration-200
            text-left group
          "
        >
          <div className="rounded-lg p-2.5 bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/15 transition-colors">
            {pruning ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">System Prune</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Remove stopped containers, networks, cache</p>
          </div>
        </button>

        <button
          onClick={() => setConfirmAction('image-prune')}
          disabled={pruning || imagePruning}
          className="
            flex items-center gap-3 rounded-xl p-4
            bg-slate-800/40 border border-white/[0.04]
            hover:bg-slate-800/60 hover:border-white/[0.08]
            disabled:opacity-50 transition-all duration-200
            text-left group
          "
        >
          <div className="rounded-lg p-2.5 bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/15 transition-colors">
            {imagePruning ? <Loader2 size={18} className="animate-spin" /> : <HardDrive size={18} />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">Image Prune</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Remove unused Docker images</p>
          </div>
        </button>
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function System() {
  const setSystem = useSystemStore((s) => s.setSystem)
  const isConnected = useConnectionStore((s) => s.status) === 'connected'

  const { data, loading, error, refresh } = usePolling<SystemInfo>(fetchSystemInfo, 30000, {
    enabled: isConnected,
  })

  useEffect(() => {
    if (data) setSystem(data)
  }, [data, setSystem])

  const info = data
  const diskUsage: DockerDiskUsage[] = info?.docker_disk_usage ?? []

  return (
    <div className="space-y-3 md:space-y-6">
      <DisconnectedBanner />
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base md:text-xl font-bold text-slate-100">System Information</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Server resources, Docker runtime, and maintenance tools
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="
            flex items-center gap-2 rounded-lg px-3.5 py-2
            text-sm font-medium text-slate-300
            bg-white/5 border border-white/10
            hover:bg-white/10 hover:border-white/15
            disabled:opacity-50 transition-all duration-200
          "
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass rounded-xl p-4 border-rose-500/30">
          <p className="text-sm text-rose-400">Failed to fetch system info: {error.message}</p>
        </div>
      )}

      {/* Loading placeholder */}
      {loading && !info && (
        <div className="glass-subtle rounded-xl p-8 text-center">
          <RefreshCw size={20} className="inline animate-spin text-slate-500 mr-2" />
          <span className="text-sm text-slate-500">Loading system information...</span>
        </div>
      )}

      {/* Info cards grid */}
      {info && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Server Info */}
          <SectionCard
            icon={<Server size={16} className="text-emerald-400" />}
            title="Server"
            accentColor="emerald"
          >
            <KvRow label="Hostname" value={info.hostname} />
            <KvRow label="Kernel" value={info.kernel} />
            <KvRow label="Docker Version" value={info.docker_version} />
          </SectionCard>

          {/* CPU & Memory */}
          <SectionCard
            icon={<Cpu size={16} className="text-cyan-400" />}
            title="Hardware"
            accentColor="cyan"
          >
            <KvRow label="CPU Cores" value={info.cpu_count} />
            <KvRow label="Total Memory" value={formatMb(info.memory_total_mb)} />
            <KvRow label="Swap" value={formatMb(info.swap_total_mb)} />
          </SectionCard>
        </div>
      )}

      {/* Docker disk usage table */}
      {diskUsage.length > 0 && (
        <SectionCard
          icon={<Database size={16} className="text-cyan-400" />}
          title="Docker Disk Usage"
          accentColor="cyan"
          storageKey="sys-card-docker-disk"
        >
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Active</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Reclaimable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {diskUsage.map((row) => (
                  <tr key={row.type} className="hover:bg-white/[0.03] transition-colors duration-150">
                    <td className="px-5 py-3 text-slate-200 font-medium text-xs">{row.type}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300 text-xs">{row.total}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300 text-xs">{row.active}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-300 text-xs">{row.size}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        {row.reclaimable}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Maintenance Panel */}
      {isConnected && <MaintenancePanel />}
    </div>
  )
}
