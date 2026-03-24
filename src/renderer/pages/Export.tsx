// =============================================================================
// Export — Server Data Export Center
// =============================================================================
// Exports real data from working API endpoints — bypasses the broken
// /export/:type endpoint which references non-existent internal functions.
// =============================================================================

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  Download, Layers, HeartPulse, Monitor, Settings2, Loader2,
  ShieldAlert, Box, Image, Network, FileText, Zap, Clock,
  CheckCircle2, FileJson, Archive, ChevronDown, ChevronUp,
  HardDrive, AlertTriangle, Trash2,
} from 'lucide-react'
import {
  fetchServerStatus,
  fetchHealthReport,
  fetchStacks,
  fetchStackCompose,
  fetchContainers,
  fetchSystemInfo,
  fetchConfig,
  fetchImages,
  fetchNetworks,
  fetchEvents,
  fetchAuditLog,
  fetchVolumes,
} from '../api/endpoints'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useToast } from '../components/common/Toast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportCardDef {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: 'emerald' | 'cyan' | 'amber' | 'violet' | 'rose' | 'blue'
  fetcher: () => Promise<unknown>
}

interface ExportHistoryEntry {
  id: string
  title: string
  timestamp: number
  sizeBytes: number
  color: string
}

// ---------------------------------------------------------------------------
// Color config
// ---------------------------------------------------------------------------

const colors = {
  emerald: {
    iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-400',
    btnBg: 'bg-emerald-500/15 hover:bg-emerald-500/25', btnText: 'text-emerald-400',
    border: 'border-emerald-500/20', ring: 'ring-emerald-500/20',
    glow: 'shadow-emerald-500/10', dot: 'bg-emerald-400',
  },
  cyan: {
    iconBg: 'bg-cyan-500/15', iconText: 'text-cyan-400',
    btnBg: 'bg-cyan-500/15 hover:bg-cyan-500/25', btnText: 'text-cyan-400',
    border: 'border-cyan-500/20', ring: 'ring-cyan-500/20',
    glow: 'shadow-cyan-500/10', dot: 'bg-cyan-400',
  },
  amber: {
    iconBg: 'bg-amber-500/15', iconText: 'text-amber-400',
    btnBg: 'bg-amber-500/15 hover:bg-amber-500/25', btnText: 'text-amber-400',
    border: 'border-amber-500/20', ring: 'ring-amber-500/20',
    glow: 'shadow-amber-500/10', dot: 'bg-amber-400',
  },
  violet: {
    iconBg: 'bg-violet-500/15', iconText: 'text-violet-400',
    btnBg: 'bg-violet-500/15 hover:bg-violet-500/25', btnText: 'text-violet-400',
    border: 'border-violet-500/20', ring: 'ring-violet-500/20',
    glow: 'shadow-violet-500/10', dot: 'bg-violet-400',
  },
  rose: {
    iconBg: 'bg-rose-500/15', iconText: 'text-rose-400',
    btnBg: 'bg-rose-500/15 hover:bg-rose-500/25', btnText: 'text-rose-400',
    border: 'border-rose-500/20', ring: 'ring-rose-500/20',
    glow: 'shadow-rose-500/10', dot: 'bg-rose-400',
  },
  blue: {
    iconBg: 'bg-blue-500/15', iconText: 'text-blue-400',
    btnBg: 'bg-blue-500/15 hover:bg-blue-500/25', btnText: 'text-blue-400',
    border: 'border-blue-500/20', ring: 'ring-blue-500/20',
    glow: 'shadow-blue-500/10', dot: 'bg-blue-400',
  },
} as const

// ---------------------------------------------------------------------------
// Data fetchers — call real working endpoints
// ---------------------------------------------------------------------------

async function fetchStackConfigs(): Promise<unknown> {
  const stacksRes = await fetchStacks()
  const stacks = stacksRes.stacks ?? []
  const configs: Record<string, { compose?: string; status: string; running_containers: number }> = {}
  // Fetch compose file for each stack (parallel, with graceful failure)
  const results = await Promise.allSettled(
    stacks.map(async (s: { name: string; status: string; running_containers: number }) => {
      try {
        const compose = await fetchStackCompose(s.name)
        return { name: s.name, compose: compose.content ?? compose.compose ?? '', status: s.status, running: s.running_containers }
      } catch {
        return { name: s.name, compose: undefined, status: s.status, running: s.running_containers }
      }
    })
  )
  for (const r of results) {
    if (r.status === 'fulfilled') {
      configs[r.value.name] = {
        compose: r.value.compose,
        status: r.value.status,
        running_containers: r.value.running,
      }
    }
  }
  return { exported_at: new Date().toISOString(), total_stacks: stacks.length, stacks: configs }
}

async function fetchFullReport(): Promise<unknown> {
  const [status, health, stacks, containers, system, images, networks, volumes] = await Promise.allSettled([
    fetchServerStatus(),
    fetchHealthReport(),
    fetchStacks(),
    fetchContainers(),
    fetchSystemInfo(),
    fetchImages(),
    fetchNetworks(),
    fetchVolumes(),
  ])
  return {
    exported_at: new Date().toISOString(),
    report_type: 'full_system_report',
    status: status.status === 'fulfilled' ? status.value : null,
    health: health.status === 'fulfilled' ? health.value : null,
    stacks: stacks.status === 'fulfilled' ? stacks.value : null,
    containers: containers.status === 'fulfilled' ? containers.value : null,
    system: system.status === 'fulfilled' ? system.value : null,
    images: images.status === 'fulfilled' ? images.value : null,
    networks: networks.status === 'fulfilled' ? networks.value : null,
    volumes: volumes.status === 'fulfilled' ? volumes.value : null,
  }
}

// ---------------------------------------------------------------------------
// Export card definitions
// ---------------------------------------------------------------------------

const exportCards: ExportCardDef[] = [
  {
    id: 'stacks',
    title: 'Stack Configurations',
    description: 'All compose files, stack status, and running container counts per stack',
    icon: Layers,
    color: 'emerald',
    fetcher: fetchStackConfigs,
  },
  {
    id: 'health',
    title: 'Health Report',
    description: 'Container health checks, uptime, restart counts, and health summary',
    icon: HeartPulse,
    color: 'cyan',
    fetcher: async () => {
      const data = await fetchHealthReport()
      return { exported_at: new Date().toISOString(), ...data }
    },
  },
  {
    id: 'containers',
    title: 'Container Inventory',
    description: 'Full container list with status, image, ports, networks, and labels',
    icon: Box,
    color: 'blue',
    fetcher: async () => {
      const data = await fetchContainers()
      return { exported_at: new Date().toISOString(), ...data }
    },
  },
  {
    id: 'system',
    title: 'System & Resources',
    description: 'CPU, memory, disk usage, Docker version, kernel, and hostname',
    icon: Monitor,
    color: 'amber',
    fetcher: async () => {
      const data = await fetchSystemInfo()
      return { exported_at: new Date().toISOString(), ...data }
    },
  },
  {
    id: 'images',
    title: 'Image Inventory',
    description: 'All Docker images with size, age, tags, and staleness info',
    icon: Image,
    color: 'violet',
    fetcher: async () => {
      const data = await fetchImages()
      return { exported_at: new Date().toISOString(), ...data }
    },
  },
  {
    id: 'networks',
    title: 'Network Map',
    description: 'Docker networks, subnets, gateways, and connected containers',
    icon: Network,
    color: 'rose',
    fetcher: async () => {
      const data = await fetchNetworks()
      return { exported_at: new Date().toISOString(), ...data }
    },
  },
  {
    id: 'config',
    title: 'Server Configuration',
    description: 'Sanitized server configuration values and feature flags',
    icon: Settings2,
    color: 'emerald',
    fetcher: async () => {
      const data = await fetchConfig()
      return { exported_at: new Date().toISOString(), ...data }
    },
  },
  {
    id: 'events',
    title: 'Event Log',
    description: 'Recent Docker events — container starts, stops, image pulls, and more',
    icon: Clock,
    color: 'cyan',
    fetcher: async () => {
      const data = await fetchEvents()
      return { exported_at: new Date().toISOString(), ...data }
    },
  },
  {
    id: 'audit',
    title: 'Audit Trail',
    description: 'API audit log with user actions, timestamps, and request details',
    icon: FileText,
    color: 'amber',
    fetcher: async () => {
      const data = await fetchAuditLog({ limit: 500 })
      return { exported_at: new Date().toISOString(), ...data }
    },
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
    ' \u00B7 ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function triggerDownload(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const HISTORY_KEY = 'dcs-export-history'

function loadHistory(): ExportHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch { return [] }
}

function saveHistory(entries: ExportHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 20)))
}

// ---------------------------------------------------------------------------
// Export Card Component
// ---------------------------------------------------------------------------

function ExportCard({ card, onExport, isLoading, isConnected, isAdmin }: {
  card: ExportCardDef
  onExport: () => void
  isLoading: boolean
  isConnected: boolean
  isAdmin: boolean
}) {
  const c = colors[card.color]
  const Icon = card.icon

  return (
    <div className={`glass rounded-xl border border-white/5 hover:border-white/10 transition-all duration-200 group`}>
      <div className="p-5">
        <div className="flex items-start gap-3.5">
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${c.iconBg} shrink-0`}>
            <Icon className={`w-5 h-5 ${c.iconText}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white leading-tight">{card.title}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{card.description}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileJson className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">JSON</span>
          </div>
          {isAdmin && (
            <button
              onClick={onExport}
              disabled={isLoading || !isConnected}
              className={`px-3.5 py-1.5 rounded-lg ${c.btnBg} ${c.btnText} text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 press`}
            >
              {isLoading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Export</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export Page
// ---------------------------------------------------------------------------

export default function Export() {
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const userRole = useAuthStore((s) => s.userRole)
  const isAdmin = userRole === 'admin'
  const { addToast } = useToast()

  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
  const [fullReportLoading, setFullReportLoading] = useState(false)
  const [history, setHistory] = useState<ExportHistoryEntry[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)
  const exportCountRef = useRef(0)

  // Persist history
  useEffect(() => { saveHistory(history) }, [history])

  const addHistoryEntry = useCallback((title: string, sizeBytes: number, color: string) => {
    setHistory((prev) => [{
      id: `${Date.now()}-${++exportCountRef.current}`,
      title,
      timestamp: Date.now(),
      sizeBytes,
      color,
    }, ...prev].slice(0, 20))
  }, [])

  const handleExport = useCallback(async (card: ExportCardDef) => {
    setLoadingMap((prev) => ({ ...prev, [card.id]: true }))
    try {
      const data = await card.fetcher()
      const json = JSON.stringify(data, null, 2)
      const date = new Date().toISOString().slice(0, 10)
      triggerDownload(json, `dcs-${card.id}-${date}.json`)
      addHistoryEntry(card.title, new Blob([json]).size, card.color)
      addToast({ type: 'success', message: `${card.title} exported successfully` })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      addToast({ type: 'error', message: `Failed to export ${card.title}: ${message}` })
    } finally {
      setLoadingMap((prev) => ({ ...prev, [card.id]: false }))
    }
  }, [addToast, addHistoryEntry])

  const handleFullReport = useCallback(async () => {
    setFullReportLoading(true)
    try {
      const data = await fetchFullReport()
      const json = JSON.stringify(data, null, 2)
      const date = new Date().toISOString().slice(0, 10)
      const time = new Date().toISOString().slice(11, 16).replace(':', '')
      triggerDownload(json, `dcs-full-report-${date}-${time}.json`)
      addHistoryEntry('Full System Report', new Blob([json]).size, 'cyan')
      addToast({ type: 'success', message: 'Full system report exported successfully' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      addToast({ type: 'error', message: `Full report failed: ${message}` })
    } finally {
      setFullReportLoading(false)
    }
  }, [addToast, addHistoryEntry])

  const toggleCard = useCallback((id: string) => {
    setSelectedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBatchExport = useCallback(async () => {
    if (selectedCards.size === 0) return
    setBatchLoading(true)
    const selected = exportCards.filter((c) => selectedCards.has(c.id))
    let successCount = 0
    for (const card of selected) {
      try {
        setLoadingMap((prev) => ({ ...prev, [card.id]: true }))
        const data = await card.fetcher()
        const json = JSON.stringify(data, null, 2)
        const date = new Date().toISOString().slice(0, 10)
        triggerDownload(json, `dcs-${card.id}-${date}.json`)
        addHistoryEntry(card.title, new Blob([json]).size, card.color)
        successCount++
      } catch {
        addToast({ type: 'error', message: `Failed to export ${card.title}` })
      } finally {
        setLoadingMap((prev) => ({ ...prev, [card.id]: false }))
      }
    }
    if (successCount > 0) {
      addToast({ type: 'success', message: `${successCount} export${successCount > 1 ? 's' : ''} completed` })
    }
    setSelectedCards(new Set())
    setBatchLoading(false)
  }, [selectedCards, addToast, addHistoryEntry])

  const clearHistory = useCallback(() => {
    setHistory([])
    addToast({ type: 'success', message: 'Export history cleared' })
  }, [addToast])

  return (
    <div className="space-y-6 animate-fade-in">
      <DisconnectedBanner />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/5">
            <Download className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold"><span className="text-gradient">Export Center</span></h1>
            <p className="text-sm text-slate-400 mt-0.5">Download server data, reports, and configurations</p>
          </div>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowHistory((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            History ({history.length})
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* ── Non-admin notice ── */}
      {!isAdmin && (
        <div className="glass rounded-xl p-4 border border-amber-500/20 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300/90">
            Admin privileges are required to export server data.
          </p>
        </div>
      )}

      {/* ── Full System Report Hero ── */}
      {isAdmin && (
        <div className="glass rounded-xl border border-cyan-500/10 hover:border-cyan-500/20 transition-all overflow-hidden">
          <div className="p-6 flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-white/5">
                <Archive className="w-7 h-7 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Full System Report</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Comprehensive export — status, health, stacks, containers, system info, images, networks, and volumes in one file
                </p>
              </div>
            </div>
            <button
              onClick={handleFullReport}
              disabled={fullReportLoading || !isConnected}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 text-cyan-400 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 border border-cyan-500/20 press"
            >
              {fullReportLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating</>
              ) : (
                <><Download className="w-4 h-4" /> Generate Report</>
              )}
            </button>
          </div>
          <div className="px-6 pb-4 flex items-center gap-6">
            {[
              { icon: HardDrive, label: 'Status', c: 'text-emerald-400' },
              { icon: HeartPulse, label: 'Health', c: 'text-cyan-400' },
              { icon: Layers, label: 'Stacks', c: 'text-violet-400' },
              { icon: Box, label: 'Containers', c: 'text-blue-400' },
              { icon: Monitor, label: 'System', c: 'text-amber-400' },
              { icon: Image, label: 'Images', c: 'text-rose-400' },
              { icon: Network, label: 'Networks', c: 'text-emerald-400' },
              { icon: HardDrive, label: 'Volumes', c: 'text-cyan-400' },
            ].map(({ icon: I, label, c }) => (
              <div key={label} className="flex items-center gap-1.5">
                <I className={`w-3 h-3 ${c}`} />
                <span className="text-[10px] text-slate-500 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Batch selection toolbar ── */}
      {isAdmin && selectedCards.size > 0 && (
        <div className="glass rounded-xl p-3 border border-violet-500/20 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-slate-300">
              <span className="font-semibold text-violet-400">{selectedCards.size}</span> export{selectedCards.size > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedCards(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleBatchExport}
              disabled={batchLoading || !isConnected}
              className="px-4 py-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5 press"
            >
              {batchLoading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Export Selected</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Export Cards Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Individual Exports</h2>
          {isAdmin && (
            <button
              onClick={() => {
                if (selectedCards.size === exportCards.length) setSelectedCards(new Set())
                else setSelectedCards(new Set(exportCards.map((c) => c.id)))
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300 uppercase tracking-wider transition-colors"
            >
              {selectedCards.size === exportCards.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {exportCards.map((card) => (
            <div key={card.id} className="relative">
              {isAdmin && (
                <button
                  onClick={() => toggleCard(card.id)}
                  className={`absolute top-3 right-3 z-10 w-5 h-5 rounded-md border transition-all flex items-center justify-center ${
                    selectedCards.has(card.id)
                      ? 'bg-violet-500/30 border-violet-500/40 text-violet-400'
                      : 'border-white/10 text-transparent hover:border-white/20'
                  }`}
                >
                  {selectedCards.has(card.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>
              )}
              <ExportCard
                card={card}
                onExport={() => handleExport(card)}
                isLoading={loadingMap[card.id] ?? false}
                isConnected={isConnected}
                isAdmin={isAdmin}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Export History ── */}
      {showHistory && history.length > 0 && (
        <div className="glass rounded-xl border border-white/5 overflow-hidden animate-fade-in">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Export History</h2>
            </div>
            <button
              onClick={clearHistory}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-rose-400 uppercase tracking-wider transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {history.map((entry) => {
              const c = colors[entry.color as keyof typeof colors] ?? colors.cyan
              return (
                <div key={entry.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    <span className="text-sm text-slate-300">{entry.title}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500 tabular-nums font-medium">{formatBytes(entry.sizeBytes)}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{formatTime(entry.timestamp)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Info footer ── */}
      {isAdmin && (
        <div className="flex items-start gap-3 px-1">
          <AlertTriangle className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Exports contain server configuration data. The Configuration export uses the sanitized API endpoint and excludes passwords and secrets. Store exported files securely.
          </p>
        </div>
      )}
    </div>
  )
}
