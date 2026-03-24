// =============================================================================
// Topology — Hierarchical Network Map: Stacks → Containers → Networks
// Beautiful 3-tier tree layout with gradient wires and glassmorphism cards
// =============================================================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Network, RefreshCw, Loader2, ZoomIn, ZoomOut, Maximize2,
  Box, X, Layers, ExternalLink,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { useConnectionStore } from '../stores/connectionStore'
import { useSystemStore } from '../stores/systemStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { fetchTopology } from '../api/endpoints'
import type {
  TopologyResponse, TopologyNode, TopologyNetwork,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NETWORK_COLORS = [
  '#10b981', '#06b6d4', '#f59e0b', '#8b5cf6',
  '#ec4899', '#f97316', '#14b8a6', '#6366f1',
]

// Node dimensions
const STACK_H = 48
const STACK_RX = 12
const CONTAINER_W = 172
const CONTAINER_H = 44
const CONTAINER_RX = 10
const NETWORK_W = 168
const NETWORK_H = 38
const NETWORK_RX = 19

// Spacing
const LEVEL_GAP = 130
const NODE_GAP = 26
const STACK_GROUP_GAP = 56
const PAD = 40
const TIER_LABEL_OFFSET = 18   // vertical space above each tier for the label
const HEALTH_R = 4

// Zoom
const MIN_ZOOM = 0.15
const MAX_ZOOM = 3
const ZOOM_STEP = 0.15

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function healthColor(state: string, health: string): string {
  const s = state.toLowerCase()
  const h = health.toLowerCase()
  if (s === 'running' && h === 'healthy') return '#10b981'
  if (s === 'running' && (h === 'none' || !h || h === 'n/a')) return '#06b6d4'
  if (s === 'running' && h === 'unhealthy') return '#f59e0b'
  if (s === 'exited' || s === 'stopped' || s === 'dead') return '#ef4444'
  return '#64748b'
}

function netColor(name: string, allNames: string[]): string {
  const idx = allNames.indexOf(name)
  return NETWORK_COLORS[idx >= 0 ? idx % NETWORK_COLORS.length : 0]
}

function trunc(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '\u2026'
}

// ---------------------------------------------------------------------------
// Layout types
// ---------------------------------------------------------------------------

interface StackL {
  name: string
  x: number      // center
  y: number      // top
  width: number
  count: number
}

interface ContainerL {
  node: TopologyNode
  x: number      // center
  y: number      // top
  stack: string
}

interface NetworkL {
  network: TopologyNetwork
  x: number      // center
  y: number      // top
  color: string
}

interface Layout {
  stacks: StackL[]
  containers: ContainerL[]
  networks: NetworkL[]
  unusedNetworkY: number | null  // Y position of unused network row (null if none)
  connectedNetworkY: number      // Y position of connected network row
  w: number
  h: number
}

// ---------------------------------------------------------------------------
// Hierarchical layout algorithm
// ---------------------------------------------------------------------------

function computeLayout(data: TopologyResponse, netNames: string[]): Layout {
  // Group containers by stack
  const groups = new Map<string, TopologyNode[]>()
  for (const n of data.nodes) {
    const key = n.stack || 'Standalone'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(n)
  }

  // Sort: largest stacks first, Standalone always last
  const entries = [...groups.entries()].sort((a, b) => {
    if (a[0] === 'Standalone') return 1
    if (b[0] === 'Standalone') return -1
    return b[1].length - a[1].length
  })

  // Position stacks (top tier) and containers (middle tier)
  // Leave room for tier labels above each row
  const stackY = PAD + TIER_LABEL_OFFSET
  const containerY = stackY + STACK_H + LEVEL_GAP

  const stacks: StackL[] = []
  const containers: ContainerL[] = []
  let cx = PAD

  for (const [name, nodes] of entries) {
    const fanW = nodes.length * (CONTAINER_W + NODE_GAP) - NODE_GAP
    const stackW = Math.max(240, fanW + 32)
    const center = cx + stackW / 2

    stacks.push({ name, x: center, y: stackY, width: stackW, count: nodes.length })

    const fanStart = center - fanW / 2 + CONTAINER_W / 2
    nodes.forEach((node, i) => {
      containers.push({
        node,
        x: fanStart + i * (CONTAINER_W + NODE_GAP),
        y: containerY,
        stack: name,
      })
    })

    cx += stackW + STACK_GROUP_GAP
  }

  // Separate connected vs unused networks
  const connectedNets: TopologyNetwork[] = []
  const unusedNets: TopologyNetwork[] = []
  for (const net of data.networks) {
    const hasConnection = containers.some((c) => c.node.networks.includes(net.name))
    if (hasConnection) {
      connectedNets.push(net)
    } else {
      unusedNets.push(net)
    }
  }

  // Position connected networks (bottom tier) — aligned beneath their connected containers
  const networkY = containerY + CONTAINER_H + LEVEL_GAP

  type NP = { net: TopologyNetwork; idealX: number; color: string }
  const netPos: NP[] = connectedNets.map((net) => {
    const connected = containers.filter((c) => c.node.networks.includes(net.name))
    const idealX = connected.reduce((s, c) => s + c.x, 0) / connected.length
    return { net, idealX, color: netColor(net.name, netNames) }
  })

  // Sort by position to reduce crossing wires
  netPos.sort((a, b) => a.idealX - b.idealX)

  const networks: NetworkL[] = []
  let nx = PAD + NETWORK_W / 2
  for (const p of netPos) {
    const finalX = Math.max(nx, p.idealX)
    networks.push({ network: p.net, x: finalX, y: networkY, color: p.color })
    nx = finalX + NETWORK_W + NODE_GAP + 8
  }

  // Position unused networks in a separate row below connected ones
  const unusedY = networks.length > 0
    ? networkY + NETWORK_H + 60
    : networkY
  let ux = PAD + NETWORK_W / 2
  for (const net of unusedNets) {
    networks.push({
      network: net,
      x: ux,
      y: unusedY,
      color: netColor(net.name, netNames),
    })
    ux += NETWORK_W + NODE_GAP + 8
  }

  const maxNetX = Math.max(nx, ux) + NETWORK_W / 2
  const totalW = Math.max(cx, maxNetX) + PAD
  const bottomY = unusedNets.length > 0 ? unusedY : networkY
  const totalH = bottomY + NETWORK_H + PAD * 2

  return {
    stacks,
    containers,
    networks,
    connectedNetworkY: networkY,
    unusedNetworkY: unusedNets.length > 0 ? unusedY : null,
    w: totalW,
    h: totalH,
  }
}

// ---------------------------------------------------------------------------
// Wire path builders (bezier curves)
// ---------------------------------------------------------------------------

function stackToContainerPath(s: StackL, c: ContainerL): string {
  const y1 = s.y + STACK_H
  const y2 = c.y
  const my = (y1 + y2) / 2
  return `M ${s.x} ${y1} C ${s.x} ${my}, ${c.x} ${my}, ${c.x} ${y2}`
}

function containerToNetworkPath(c: ContainerL, n: NetworkL): string {
  const y1 = c.y + CONTAINER_H
  const y2 = n.y
  const my = (y1 + y2) / 2
  return `M ${c.x} ${y1} C ${c.x} ${my}, ${n.x} ${my}, ${n.x} ${y2}`
}

// ---------------------------------------------------------------------------
// Detail panel (portal)
// ---------------------------------------------------------------------------

function parsePortLink(portStr: string, hostname: string | undefined): { label: string; href: string } | null {
  // Match "0.0.0.0:8080->80/tcp" or ":::8080->80/tcp"
  const m = portStr.match(/(?:[\d.]+|:::?):(\d+)->/)
  if (!m) return null
  const hostPort = m[1]
  const host = hostname || 'localhost'
  return { label: `Open :${hostPort}`, href: `http://${host}:${hostPort}` }
}

function DetailPanel({
  node,
  netNames,
  onClose,
}: {
  node: TopologyNode
  netNames: string[]
  onClose: () => void
}) {
  const stroke = healthColor(node.state, node.health)
  const hostname = useSystemStore((s) => s.status?.hostname)

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end md:items-center md:justify-end bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full md:w-96 md:h-full md:max-h-screen bg-slate-900/95 backdrop-blur-2xl border-t md:border-t-0 md:border-l border-white/10 shadow-2xl shadow-black/40 animate-slide-up md:animate-fade-in overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl ring-1 shrink-0"
              style={{ backgroundColor: `${stroke}15`, borderColor: `${stroke}30` }}
            >
              <Box size={16} style={{ color: stroke }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-100 truncate font-mono">
                {node.id}
              </h3>
              <p className="text-[10px] text-slate-500">Container Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">State</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stroke }} />
                <span className="text-sm font-medium text-slate-200 capitalize">{node.state}</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Health</p>
              <span className="text-sm font-medium text-slate-200 capitalize">{node.health || 'N/A'}</span>
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Image</p>
            <p className="text-xs text-slate-300 font-mono break-all">{node.image}</p>
          </div>

          {node.stack && (
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Stack</p>
              <p className="text-sm text-slate-200">{node.stack}</p>
            </div>
          )}

          {node.ports && (
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Ports</p>
              <div className="space-y-1.5">
                {node.ports.split(' ').filter(Boolean).map((p, i) => {
                  const link = parsePortLink(p, hostname)
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-mono break-all">{p}</span>
                      {link && (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-md text-[10px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors shrink-0"
                        >
                          <ExternalLink size={10} />
                          {link.label}
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {node.ip_addresses && node.ip_addresses.length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                IP Addresses ({node.ip_addresses.length})
              </p>
              <div className="space-y-1">
                {node.ip_addresses.map((entry) => {
                  const c = netColor(entry.network, netNames)
                  return (
                    <div key={entry.network} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
                        {entry.network}
                      </span>
                      <span className="text-xs text-cyan-400 font-mono">{entry.ip}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
              Networks ({node.networks.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {node.networks.map((net) => {
                const c = netColor(net, netNames)
                return (
                  <span
                    key={net}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-mono border"
                    style={{ backgroundColor: `${c}12`, borderColor: `${c}25`, color: c }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
                    {net}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Main Topology component
// ---------------------------------------------------------------------------

export default function Topology() {
  const isConnected = useConnectionStore((s) => s.status) === 'connected'

  const { data: topoData, loading, refresh } = usePolling<TopologyResponse>(
    fetchTopology, 15000, { enabled: isConnected },
  )

  // Zoom & pan
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const lastPinchDist = useRef<number | null>(null)

  // Selection / hover
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null)
  const [hoveredStack, setHoveredStack] = useState<string | null>(null)
  const [hoveredContainer, setHoveredContainer] = useState<string | null>(null)
  const [hoveredNetwork, setHoveredNetwork] = useState<string | null>(null)

  // Escape key closes detail panel
  useEffect(() => {
    if (!selectedNode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      setSelectedNode(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedNode])

  // Stable network name list for coloring
  const netNames = useMemo(
    () => (topoData?.networks ?? []).map((n) => n.name),
    [topoData],
  )

  // Compute hierarchical layout
  const layout = useMemo(() => {
    if (!topoData || topoData.nodes.length === 0) return null
    return computeLayout(topoData, netNames)
  }, [topoData, netNames])

  // Stats
  const totalContainers = topoData?.nodes.length ?? 0
  const totalNetworks = topoData?.networks.length ?? 0
  const totalEdges = topoData?.edges.length ?? 0

  // --- Auto-fit on first layout ---
  const didAutoFit = useRef(false)
  useEffect(() => {
    if (!layout || !containerRef.current || didAutoFit.current) return
    didAutoFit.current = true
    const rect = containerRef.current.getBoundingClientRect()
    const sx = rect.width / layout.w
    const sy = rect.height / layout.h
    const fitZoom = Math.min(sx, sy, 1.2) * 0.88
    setZoom(fitZoom)
    setPan({
      x: (rect.width - layout.w * fitZoom) / 2,
      y: (rect.height - layout.h * fitZoom) / 2,
    })
  }, [layout])

  // --- Zoom handlers ---
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM)), [])
  const handleReset = useCallback(() => {
    if (!layout || !containerRef.current) { setZoom(1); setPan({ x: 0, y: 0 }); return }
    const rect = containerRef.current.getBoundingClientRect()
    const sx = rect.width / layout.w
    const sy = rect.height / layout.h
    const fitZoom = Math.min(sx, sy, 1.2) * 0.88
    setZoom(fitZoom)
    setPan({ x: (rect.width - layout.w * fitZoom) / 2, y: (rect.height - layout.h * fitZoom) / 2 })
  }, [layout])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const d = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    setZoom((z) => Math.min(Math.max(z + d, MIN_ZOOM), MAX_ZOOM))
  }, [])

  // --- Pan handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.x),
      y: panStart.current.py + (e.clientY - panStart.current.y),
    })
  }, [isPanning])

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsPanning(true)
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pan.x, py: pan.y }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinchDist.current = Math.hypot(dx, dy)
    }
  }, [pan])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning) {
      setPan({
        x: panStart.current.px + (e.touches[0].clientX - panStart.current.x),
        y: panStart.current.py + (e.touches[0].clientY - panStart.current.y),
      })
    } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      setZoom((z) => Math.min(Math.max(z * (dist / lastPinchDist.current!), MIN_ZOOM), MAX_ZOOM))
      lastPinchDist.current = dist
    }
  }, [isPanning])

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false)
    lastPinchDist.current = null
  }, [])

  useEffect(() => {
    const up = () => setIsPanning(false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // --- Highlight logic ---
  // Which stacks, containers & networks are highlighted?
  const highlightedStacks = useMemo(() => {
    const set = new Set<string>()
    if (hoveredStack) set.add(hoveredStack)
    if (hoveredContainer) {
      const cl = layout?.containers.find((c) => c.node.id === hoveredContainer)
      if (cl) set.add(cl.stack)
    }
    return set
  }, [hoveredStack, hoveredContainer, layout])

  const highlightedContainers = useMemo(() => {
    const set = new Set<string>()
    if (hoveredContainer) {
      set.add(hoveredContainer)
    }
    if (hoveredStack) {
      for (const c of layout?.containers ?? []) {
        if (c.stack === hoveredStack) set.add(c.node.id)
      }
    }
    if (hoveredNetwork) {
      for (const c of layout?.containers ?? []) {
        if (c.node.networks.includes(hoveredNetwork)) set.add(c.node.id)
      }
    }
    return set
  }, [hoveredStack, hoveredContainer, hoveredNetwork, layout])

  const highlightedNetworks = useMemo(() => {
    const set = new Set<string>()
    if (hoveredNetwork) {
      set.add(hoveredNetwork)
    }
    if (hoveredContainer) {
      const node = topoData?.nodes.find((n) => n.id === hoveredContainer)
      if (node) node.networks.forEach((n) => set.add(n))
    }
    if (hoveredStack) {
      for (const c of layout?.containers ?? []) {
        if (c.stack === hoveredStack) {
          c.node.networks.forEach((n) => set.add(n))
        }
      }
    }
    return set
  }, [hoveredStack, hoveredContainer, hoveredNetwork, topoData, layout])

  const hasHighlight = highlightedStacks.size > 0 || highlightedContainers.size > 0 || highlightedNetworks.size > 0

  // --- Disconnected ---
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
          <Network size={24} className="text-slate-500" />
        </div>
        <p className="text-sm text-slate-500">Connect to a server to view network topology</p>
      </div>
    )
  }

  // --- Render ---
  const isEmpty = !topoData || topoData.nodes.length === 0

  return (
    <div className="space-y-3 md:space-y-6 animate-fade-in">
      <DisconnectedBanner />
      {/* Detail panel */}
      {selectedNode && (
        <DetailPanel node={selectedNode} netNames={netNames} onClose={() => setSelectedNode(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Network size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold"><span className="text-gradient">Network Topology</span></h2>
            <p className="text-xs text-slate-500">
              Hierarchical view of stacks, containers, and network connections
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 transition-all duration-200 disabled:opacity-50 press"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
        {[
          { icon: Layers, label: 'Stacks', value: layout?.stacks.length ?? 0, color: 'text-violet-400' },
          { icon: Box, label: 'Containers', value: totalContainers, color: 'text-emerald-400' },
          { icon: Network, label: 'Networks', value: totalNetworks, color: 'text-cyan-400' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-3 md:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon size={13} className={s.color} />
              <span className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-lg md:text-2xl font-bold text-slate-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Canvas card */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-3 md:p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            <Network size={15} className="text-cyan-400" />
            <h3 className="text-xs md:text-sm font-semibold text-slate-300">Topology Map</h3>
            <span className="text-[10px] text-slate-500 ml-1">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-0.5">
            {[
              { fn: handleZoomIn, icon: ZoomIn, title: 'Zoom in' },
              { fn: handleZoomOut, icon: ZoomOut, title: 'Zoom out' },
              { fn: handleReset, icon: Maximize2, title: 'Fit to view' },
            ].map((btn) => (
              <button
                key={btn.title}
                onClick={btn.fn}
                className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
                title={btn.title}
              >
                <btn.icon size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        {loading && !topoData ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-slate-500" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <Network size={40} className="text-slate-500 mb-4" />
            <p className="text-sm text-slate-400 mb-1">No containers running</p>
            <p className="text-xs text-slate-500">Start some stacks to see the network topology.</p>
          </div>
        ) : layout ? (
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg border border-white/[0.03] bg-slate-950/50"
            style={{
              height: 'clamp(300px, 55vh, 640px)',
              cursor: isPanning ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <svg width="100%" height="100%" className="select-none" style={{ overflow: 'visible' }}>
              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

                {/* =========== SVG DEFS =========== */}
                <defs>
                  {/* Dot grid pattern */}
                  <pattern id="dotGrid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <circle cx="14" cy="14" r="0.6" fill="white" opacity="0.035" />
                  </pattern>

                  {/* Network color gradients (for wires) */}
                  {NETWORK_COLORS.map((color, i) => (
                    <linearGradient key={`ng${i}`} id={`netGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.8} />
                    </linearGradient>
                  ))}

                  {/* Structural wire gradient (stack → container) */}
                  <linearGradient id="structGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  </linearGradient>

                  {/* Glow filter for highlighted wires */}
                  <filter id="wireGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Subtle card shadow */}
                  <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="black" floodOpacity="0.3" />
                  </filter>
                </defs>

                {/* Background grid */}
                <rect x={0} y={0} width={layout.w} height={layout.h} fill="url(#dotGrid)" rx={8} />

                {/* =========== TIER 1: Stack → Container wires =========== */}
                {layout.containers.map((c) => {
                  const stack = layout.stacks.find((s) => s.name === c.stack)
                  if (!stack) return null
                  const path = stackToContainerPath(stack, c)
                  const isHigh = highlightedContainers.has(c.node.id)
                  const dim = hasHighlight && !isHigh
                  const wireColor = stack.name === 'Standalone' ? '#475569' : '#8b5cf6'

                  return (
                    <g key={`sw-${c.node.id}`}>
                      {/* Glow layer when highlighted */}
                      {isHigh && (
                        <path
                          d={path}
                          fill="none"
                          stroke={wireColor}
                          strokeWidth={5}
                          strokeOpacity={0.1}
                          filter="url(#wireGlow)"
                        />
                      )}
                      {/* Main wire */}
                      <path
                        d={path}
                        fill="none"
                        stroke={isHigh ? wireColor : 'url(#structGrad)'}
                        strokeWidth={dim ? 0.7 : isHigh ? 2 : 1.1}
                        opacity={dim ? 0.12 : isHigh ? 0.8 : 0.5}
                        strokeLinecap="round"
                        style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
                      />
                      {/* Animated flow dot when highlighted */}
                      {isHigh && (
                        <circle r={2.2} fill={wireColor} opacity={0.8}>
                          <animateMotion dur="2s" repeatCount="indefinite" path={path} />
                        </circle>
                      )}
                      {/* Endpoint dots */}
                      {isHigh && (
                        <>
                          <circle cx={stack.x} cy={stack.y + STACK_H} r={2} fill={wireColor} opacity={0.5} />
                          <circle cx={c.x} cy={c.y} r={2} fill={wireColor} opacity={0.5} />
                        </>
                      )}
                    </g>
                  )
                })}

                {/* =========== TIER 2: Container → Network wires =========== */}
                {layout.containers.flatMap((c) =>
                  c.node.networks.map((netName) => {
                    const net = layout.networks.find((n) => n.network.name === netName)
                    if (!net) return null
                    const path = containerToNetworkPath(c, net)
                    const gradIdx = netNames.indexOf(netName)
                    const gi = gradIdx >= 0 ? gradIdx % NETWORK_COLORS.length : 0
                    const isHigh =
                      highlightedContainers.has(c.node.id) && highlightedNetworks.has(netName)
                    const dim = hasHighlight && !isHigh
                    return (
                      <g key={`nw-${c.node.id}-${netName}`}>
                        {/* Glow layer (only when highlighted) */}
                        {isHigh && (
                          <path
                            d={path}
                            fill="none"
                            stroke={net.color}
                            strokeWidth={5}
                            strokeOpacity={0.12}
                            filter="url(#wireGlow)"
                          />
                        )}
                        {/* Main wire */}
                        <path
                          d={path}
                          fill="none"
                          stroke={`url(#netGrad${gi})`}
                          strokeWidth={isHigh ? 2.2 : 1.2}
                          opacity={dim ? 0.08 : isHigh ? 1 : 0.35}
                          strokeLinecap="round"
                          style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
                        />
                        {/* Animated flow dots when highlighted */}
                        {isHigh && (
                          <circle r={2.5} fill={net.color} opacity={0.9}>
                            <animateMotion dur="2.5s" repeatCount="indefinite" path={path} />
                          </circle>
                        )}
                        {/* Endpoint dots */}
                        <circle cx={c.x} cy={c.y + CONTAINER_H} r={dim ? 1 : 1.8} fill={net.color} opacity={dim ? 0.08 : 0.45} />
                        <circle cx={net.x} cy={net.y} r={dim ? 1 : 1.8} fill={net.color} opacity={dim ? 0.08 : 0.45} />
                      </g>
                    )
                  }),
                )}

                {/* =========== STACK CARDS (top tier) =========== */}
                {layout.stacks.map((s) => {
                  const isStandalone = s.name === 'Standalone'
                  const isStackHigh = highlightedStacks.has(s.name)
                  const stackDim = hasHighlight && !isStackHigh
                  const stackAccent = isStandalone ? '#475569' : '#8b5cf6'

                  return (
                    <g
                      key={`stack-${s.name}`}
                      data-node="true"
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                      opacity={stackDim ? 0.35 : 1}
                      onMouseEnter={() => setHoveredStack(s.name)}
                      onMouseLeave={() => setHoveredStack(null)}
                    >
                      {/* Outer glow ring on hover */}
                      {isStackHigh && (
                        <rect
                          x={s.x - s.width / 2 - 4}
                          y={s.y - 4}
                          width={s.width + 8}
                          height={STACK_H + 8}
                          rx={STACK_RX + 4}
                          fill="none"
                          stroke={stackAccent}
                          strokeWidth={1}
                          strokeOpacity={0.25}
                        />
                      )}
                      {/* Shadow */}
                      <rect
                        x={s.x - s.width / 2 + 1}
                        y={s.y + 2}
                        width={s.width}
                        height={STACK_H}
                        rx={STACK_RX}
                        fill="black"
                        fillOpacity={0.25}
                      />
                      {/* Background */}
                      <rect
                        x={s.x - s.width / 2}
                        y={s.y}
                        width={s.width}
                        height={STACK_H}
                        rx={STACK_RX}
                        fill="rgba(15, 23, 42, 0.88)"
                        stroke={stackAccent}
                        strokeWidth={isStackHigh ? 1.4 : 1}
                        strokeOpacity={isStackHigh ? 0.7 : 0.35}
                        strokeDasharray={isStandalone ? '4 3' : 'none'}
                      />
                      {/* Inner accent bar at top (inside card, below the rounded corner) */}
                      <rect
                        x={s.x - s.width / 2 + 4}
                        y={s.y + 4}
                        width={s.width - 8}
                        height={2}
                        rx={1}
                        fill={stackAccent}
                        fillOpacity={isStackHigh ? 0.6 : 0.4}
                      />
                      {/* Stack icon */}
                      <g transform={`translate(${s.x - s.width / 2 + 14}, ${s.y + STACK_H / 2 - 7})`}>
                        <rect width={14} height={14} rx={3} fill={isStandalone ? '#47556920' : '#8b5cf620'} />
                        {/* Simple layers icon */}
                        <line x1={3} y1={5} x2={11} y2={5} stroke={isStandalone ? '#64748b' : '#a78bfa'} strokeWidth={1.2} strokeLinecap="round" />
                        <line x1={3} y1={7.5} x2={11} y2={7.5} stroke={isStandalone ? '#64748b' : '#a78bfa'} strokeWidth={1.2} strokeLinecap="round" />
                        <line x1={3} y1={10} x2={11} y2={10} stroke={isStandalone ? '#64748b' : '#a78bfa'} strokeWidth={1.2} strokeLinecap="round" />
                      </g>
                      {/* Stack name */}
                      <text
                        x={s.x - s.width / 2 + 34}
                        y={s.y + STACK_H / 2 - 2}
                        dominantBaseline="central"
                        fill={isStandalone ? '#94a3b8' : '#c4b5fd'}
                        fontSize={12}
                        fontWeight={700}
                        fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                      >
                        {trunc(s.name, 28)}
                      </text>
                      {/* Count badge */}
                      <rect
                        x={s.x + s.width / 2 - 36}
                        y={s.y + STACK_H / 2 - 9}
                        width={24}
                        height={18}
                        rx={9}
                        fill={isStandalone ? '#47556925' : '#8b5cf618'}
                        stroke={isStandalone ? '#475569' : '#8b5cf6'}
                        strokeWidth={0.5}
                        strokeOpacity={0.3}
                      />
                      <text
                        x={s.x + s.width / 2 - 24}
                        y={s.y + STACK_H / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={isStandalone ? '#94a3b8' : '#a78bfa'}
                        fontSize={10}
                        fontWeight={700}
                      >
                        {s.count}
                      </text>
                    </g>
                  )
                })}

                {/* =========== CONTAINER CARDS (middle tier) =========== */}
                {layout.containers.map((c) => {
                  const stroke = healthColor(c.node.state, c.node.health)
                  const isHigh = highlightedContainers.has(c.node.id)
                  const dim = hasHighlight && !isHigh
                  const isSel = selectedNode?.id === c.node.id

                  return (
                    <g
                      key={`c-${c.node.id}`}
                      data-node="true"
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                      opacity={dim ? 0.35 : 1}
                      onClick={(e) => { e.stopPropagation(); setSelectedNode(c.node) }}
                      onMouseEnter={() => setHoveredContainer(c.node.id)}
                      onMouseLeave={() => setHoveredContainer(null)}
                    >
                      {/* Outer glow rings on hover */}
                      {(isHigh || isSel) && (
                        <>
                          <rect
                            x={c.x - CONTAINER_W / 2 - 5}
                            y={c.y - 5}
                            width={CONTAINER_W + 10}
                            height={CONTAINER_H + 10}
                            rx={CONTAINER_RX + 5}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={1}
                            strokeOpacity={0.12}
                          />
                          <rect
                            x={c.x - CONTAINER_W / 2 - 2}
                            y={c.y - 2}
                            width={CONTAINER_W + 4}
                            height={CONTAINER_H + 4}
                            rx={CONTAINER_RX + 2}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={1}
                            strokeOpacity={0.3}
                          />
                        </>
                      )}

                      {/* Shadow */}
                      <rect
                        x={c.x - CONTAINER_W / 2 + 1}
                        y={c.y + 2}
                        width={CONTAINER_W}
                        height={CONTAINER_H}
                        rx={CONTAINER_RX}
                        fill="black"
                        fillOpacity={0.3}
                      />

                      {/* Background */}
                      <rect
                        x={c.x - CONTAINER_W / 2}
                        y={c.y}
                        width={CONTAINER_W}
                        height={CONTAINER_H}
                        rx={CONTAINER_RX}
                        fill="rgba(15, 23, 42, 0.92)"
                        stroke={stroke}
                        strokeWidth={isHigh || isSel ? 1.6 : 0.8}
                        strokeOpacity={isHigh || isSel ? 1 : 0.5}
                      />

                      {/* Left accent bar */}
                      <rect
                        x={c.x - CONTAINER_W / 2}
                        y={c.y + 6}
                        width={3}
                        height={CONTAINER_H - 12}
                        rx={1.5}
                        fill={stroke}
                        fillOpacity={isHigh ? 0.9 : 0.5}
                      />

                      {/* Container name */}
                      <text
                        x={c.x - CONTAINER_W / 2 + 14}
                        y={c.y + CONTAINER_H / 2 - 5}
                        dominantBaseline="central"
                        fill={isHigh ? '#f8fafc' : '#e2e8f0'}
                        fontSize={11}
                        fontWeight={600}
                        fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace"
                      >
                        {trunc(c.node.id, 19)}
                      </text>

                      {/* Subtitle: first IP or image name */}
                      <text
                        x={c.x - CONTAINER_W / 2 + 14}
                        y={c.y + CONTAINER_H / 2 + 9}
                        dominantBaseline="central"
                        fill={c.node.ip_addresses?.length ? '#67e8f9' : '#64748b'}
                        fontSize={8}
                        fontFamily={c.node.ip_addresses?.length ? 'ui-monospace, SFMono-Regular, monospace' : 'ui-sans-serif, system-ui, sans-serif'}
                        fillOpacity={c.node.ip_addresses?.length ? 0.7 : 1}
                      >
                        {c.node.ip_addresses?.length
                          ? c.node.ip_addresses[0].ip
                          : trunc(c.node.image, 22)}
                      </text>

                      {/* Health dot with glow ring */}
                      <circle
                        cx={c.x + CONTAINER_W / 2 - 12}
                        cy={c.y + 12}
                        r={HEALTH_R + 2}
                        fill={stroke}
                        fillOpacity={0.15}
                      />
                      <circle
                        cx={c.x + CONTAINER_W / 2 - 12}
                        cy={c.y + 12}
                        r={HEALTH_R}
                        fill={stroke}
                      />
                    </g>
                  )
                })}

                {/* =========== NETWORK PILLS (bottom tier) =========== */}
                {layout.networks.map((n) => {
                  const isHigh = highlightedNetworks.has(n.network.name)
                  const dim = hasHighlight && !isHigh

                  return (
                    <g
                      key={`n-${n.network.name}`}
                      data-node="true"
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                      opacity={dim ? 0.3 : 1}
                      onMouseEnter={() => setHoveredNetwork(n.network.name)}
                      onMouseLeave={() => setHoveredNetwork(null)}
                    >
                      {/* Outer glow on hover */}
                      {isHigh && (
                        <rect
                          x={n.x - NETWORK_W / 2 - 3}
                          y={n.y - 3}
                          width={NETWORK_W + 6}
                          height={NETWORK_H + 6}
                          rx={NETWORK_RX + 3}
                          fill="none"
                          stroke={n.color}
                          strokeWidth={1}
                          strokeOpacity={0.35}
                        />
                      )}

                      {/* Shadow */}
                      <rect
                        x={n.x - NETWORK_W / 2 + 1}
                        y={n.y + 1.5}
                        width={NETWORK_W}
                        height={NETWORK_H}
                        rx={NETWORK_RX}
                        fill="black"
                        fillOpacity={0.2}
                      />

                      {/* Pill background */}
                      <rect
                        x={n.x - NETWORK_W / 2}
                        y={n.y}
                        width={NETWORK_W}
                        height={NETWORK_H}
                        rx={NETWORK_RX}
                        fill={`${n.color}10`}
                        stroke={n.color}
                        strokeWidth={isHigh ? 1.4 : 0.8}
                        strokeOpacity={isHigh ? 0.8 : 0.35}
                      />

                      {/* Color dot */}
                      <circle
                        cx={n.x - NETWORK_W / 2 + 16}
                        cy={n.y + NETWORK_H / 2}
                        r={3.5}
                        fill={n.color}
                        fillOpacity={isHigh ? 1 : 0.7}
                      />

                      {/* Network name */}
                      <text
                        x={n.x - NETWORK_W / 2 + 26}
                        y={n.y + NETWORK_H / 2 - (n.network.subnet ? 3 : 0)}
                        dominantBaseline="central"
                        fill={n.color}
                        fontSize={11}
                        fontWeight={600}
                        fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace"
                        opacity={isHigh ? 1 : 0.8}
                      >
                        {trunc(n.network.name, 17)}
                      </text>

                      {/* Subnet */}
                      {n.network.subnet && (
                        <text
                          x={n.x - NETWORK_W / 2 + 26}
                          y={n.y + NETWORK_H / 2 + 9}
                          dominantBaseline="central"
                          fill={n.color}
                          fontSize={8}
                          fontFamily="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace"
                          opacity={0.4}
                        >
                          {n.network.subnet}
                        </text>
                      )}

                      {/* Driver badge */}
                      <text
                        x={n.x + NETWORK_W / 2 - 12}
                        y={n.y + NETWORK_H / 2}
                        textAnchor="end"
                        dominantBaseline="central"
                        fill={n.color}
                        fontSize={7}
                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                        opacity={0.35}
                      >
                        {n.network.driver}
                      </text>
                    </g>
                  )
                })}

                {/* =========== TIER LABELS (above each tier) =========== */}
                {layout.stacks.length > 0 && (
                  <>
                    {/* Stacks label — above stack row */}
                    <text
                      x={PAD}
                      y={layout.stacks[0].y - 8}
                      fill="#8b5cf6"
                      fontSize={8}
                      fontWeight={700}
                      letterSpacing={2.5}
                      opacity={0.35}
                      fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                    >
                      STACKS
                    </text>
                    <line
                      x1={PAD}
                      y1={layout.stacks[0].y - 3}
                      x2={PAD + 44}
                      y2={layout.stacks[0].y - 3}
                      stroke="#8b5cf6"
                      strokeWidth={1}
                      strokeOpacity={0.15}
                      strokeLinecap="round"
                    />

                    {/* Containers label — above container row */}
                    {layout.containers.length > 0 && (
                      <>
                        <text
                          x={PAD}
                          y={layout.containers[0].y - 8}
                          fill="#10b981"
                          fontSize={8}
                          fontWeight={700}
                          letterSpacing={2.5}
                          opacity={0.35}
                          fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                        >
                          CONTAINERS
                        </text>
                        <line
                          x1={PAD}
                          y1={layout.containers[0].y - 3}
                          x2={PAD + 66}
                          y2={layout.containers[0].y - 3}
                          stroke="#10b981"
                          strokeWidth={1}
                          strokeOpacity={0.15}
                          strokeLinecap="round"
                        />
                      </>
                    )}

                    {/* Networks label — above connected network row */}
                    {layout.networks.length > 0 && (
                      <>
                        <text
                          x={PAD}
                          y={layout.connectedNetworkY - 8}
                          fill="#06b6d4"
                          fontSize={8}
                          fontWeight={700}
                          letterSpacing={2.5}
                          opacity={0.35}
                          fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                        >
                          NETWORKS
                        </text>
                        <line
                          x1={PAD}
                          y1={layout.connectedNetworkY - 3}
                          x2={PAD + 55}
                          y2={layout.connectedNetworkY - 3}
                          stroke="#06b6d4"
                          strokeWidth={1}
                          strokeOpacity={0.15}
                          strokeLinecap="round"
                        />
                      </>
                    )}

                    {/* Unused networks label — above unused network row */}
                    {layout.unusedNetworkY !== null && (
                      <>
                        <text
                          x={PAD}
                          y={layout.unusedNetworkY - 8}
                          fill="#64748b"
                          fontSize={8}
                          fontWeight={700}
                          letterSpacing={2.5}
                          opacity={0.3}
                          fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                        >
                          UNUSED NETWORKS
                        </text>
                        <line
                          x1={PAD}
                          y1={layout.unusedNetworkY - 3}
                          x2={PAD + 96}
                          y2={layout.unusedNetworkY - 3}
                          stroke="#64748b"
                          strokeWidth={1}
                          strokeOpacity={0.12}
                          strokeLinecap="round"
                        />
                      </>
                    )}
                  </>
                )}

              </g>
            </svg>
          </div>
        ) : null}

        {/* Legend */}
        {!isEmpty && layout && (
          <div className="mt-3 md:mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 md:gap-x-4 md:gap-y-2">
            <span className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-wider mr-1">Networks:</span>
            {layout.networks.map((n) => (
              <div key={n.network.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0" style={{ backgroundColor: n.color }} />
                <span className="text-[10px] md:text-[11px] text-slate-400 font-mono">{n.network.name}</span>
                <span className="text-[9px] md:text-[10px] text-slate-500">({n.network.container_count})</span>
              </div>
            ))}

            <span className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-wider ml-2 md:ml-4 mr-1">Health:</span>
            {[
              { label: 'Healthy', color: '#10b981' },
              { label: 'Running', color: '#06b6d4' },
              { label: 'Warning', color: '#f59e0b' },
              { label: 'Stopped', color: '#ef4444' },
            ].map((h) => (
              <div key={h.label} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                <span className="text-[9px] md:text-[10px] text-slate-500">{h.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
