// =============================================================================
// DashboardGrid — 24-column free-placement grid with x,y positioning
// =============================================================================

import React, { useCallback, useRef, useState, useEffect } from 'react'
import {
  X, RotateCcw, Settings2, Plus, Check, Move,
  LayoutDashboard, Layers, HeartPulse, Activity, Box, Server, HardDrive,
  TrendingUp, Zap, Download, Archive, FileText, Wrench, Bell, Clock, Rocket,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import type { DashboardCard } from '../../../shared/types'
import { getCardEntry, clampW, clampH, clampCardSize, getCardConstraints, H_UNIT, GRID_COLS } from './cardRegistry'

import { fetchPluginCards } from '../../api/endpoints'
import { apiClient } from '../../api/client'
import type { PluginCardMeta } from '../../../shared/types'
import { useConnectionStore } from '../../stores/connectionStore'

import OverviewCards from './OverviewCards'
import StackStatusGrid from './StackStatusGrid'
import HealthSummary from './HealthSummary'
import ResourceChart from './ResourceChart'
import ContainerOverview from './ContainerOverview'
import ServerInfoComp from './ServerInfo'
import DiskMonitor from './DiskMonitor'
import PersistentTrends from './PersistentTrends'
import TopResourceConsumers from './TopResourceConsumers'
import ImageUpdateAlert from './ImageUpdateAlert'
import BackupStatusCard from './BackupStatusCard'
import LogHealthSummary from './LogHealthSummary'
import MaintenanceSummary from './MaintenanceSummary'
import NotificationStatus from './NotificationStatus'
import ActiveAutomations from './ActiveAutomations'
import RecentEvents from './RecentEvents'
import QuickActions from './QuickActions'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Layers, HeartPulse, Activity, Box, Server, HardDrive,
  TrendingUp, Zap, Download, Archive, FileText, Wrench, Bell, Clock, Rocket,
}

const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  'overview': OverviewCards, 'stack-grid': StackStatusGrid,
  'health-summary': HealthSummary, 'resource-chart': ResourceChart,
  'container-overview': ContainerOverview, 'server-info': ServerInfoComp,
  'disk-monitor': DiskMonitor, 'trends': PersistentTrends,
  'top-consumers': TopResourceConsumers, 'image-updates': ImageUpdateAlert,
  'backup-status': BackupStatusCard, 'log-health': LogHealthSummary,
  'maintenance': MaintenanceSummary, 'notifications': NotificationStatus,
  'automations': ActiveAutomations, 'recent-events': RecentEvents,
  'quick-actions': QuickActions,
}

/** Plugin card iframe — fetches HTML from API and renders via srcdoc */
function PluginCardFrame({ pluginName, cardName, title }: { pluginName: string; cardName: string; title: string }) {
  const [src, setSrc] = useState<string>('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiClient.get<{ html: string }>(`/plugins/${pluginName}/cards/${cardName}`)
      .then((res) => {
        if (cancelled) return
        // Blob URL has null origin — CSP of parent page does NOT apply
        // Scripts execute freely inside blob URL iframes
        const blob = new Blob([res.html], { type: 'text/html' })
        setSrc(URL.createObjectURL(blob))
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [pluginName, cardName])

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '12px', color: '#f87171' }}>Failed to load card</span>
      </div>
    )
  }

  if (!src) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '20px', height: '20px', border: '2px solid rgba(139,92,246,0.3)', borderTop: '2px solid #8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <iframe
      src={src}
      title={title}
      // SECURITY: Sandbox plugin iframes — allow scripts (for dynamic cards) but block
      // top-navigation, forms, popups, and same-origin access to parent window.
      // This prevents malicious plugins from accessing the parent app's DOM, cookies, or auth tokens.
      sandbox="allow-scripts"
      // @ts-ignore — allowtransparency is a valid HTML attribute but not in React types
      allowtransparency="true"
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px', display: 'block', background: 'transparent' }}
    />
  )
}

interface Props {
  cards: DashboardCard[]
  editMode: boolean
  labels: Record<string, string>
  onToggleCard: (id: string) => void
  onResizeCard: (id: string, w: number, h: number) => void
  onMoveCard: (id: string, x: number, y: number) => void
  onExitEdit: () => void
  onDiscardEdit: () => void
  onResetLayout: () => void
  onAddSpecial: (type: 'spacer' | 'divider') => void
  onAddPluginCard: (id: string, w: number, h: number) => void
  onSetLabel: (id: string, title: string) => void
  cardProps?: Record<string, Record<string, unknown>>
}

export default function DashboardGrid({
  cards, editMode, labels, onToggleCard, onResizeCard, onMoveCard,
  onExitEdit, onDiscardEdit, onResetLayout, onAddSpecial, onAddPluginCard, onSetLabel, cardProps = {},
}: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [pluginCards, setPluginCards] = useState<PluginCardMeta[]>([])
  const gridRef = useRef<HTMLDivElement>(null)
  const isConnected = useConnectionStore((s) => s.status === 'connected')

  // Discover plugin cards from enabled plugins
  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    fetchPluginCards().then((res) => { if (!cancelled) setPluginCards(res.cards || []) }).catch(() => {})
    return () => { cancelled = true }
  }, [isConnected])

  // Escape key exits edit mode (discard)
  React.useEffect(() => {
    if (!editMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDiscardEdit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editMode, onDiscardEdit])

  // Calculate total grid height
  const visibleCards = cards.filter((c) => c.visible)
  const hiddenCards = cards.filter((c) => !c.visible)
  const maxRow = Math.max(...visibleCards.map((c) => c.y + c.h), 1)

  // ── Resize (mousedown → drag → mouseup) ──
  const handleResizeDown = useCallback((e: React.MouseEvent, id: string, startW: number, startH: number) => {
    if (!editMode || !gridRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const colPx = gridRef.current.offsetWidth / GRID_COLS
    setResizingId(id)

    function onMove(ev: MouseEvent) {
      ev.preventDefault()
      const dw = Math.round((ev.clientX - startX) / colPx)
      const dh = Math.round((ev.clientY - startY) / H_UNIT)
      const clamped = clampCardSize(id, startW + dw, startH + dh)
      onResizeCard(id, clamped.w, clamped.h)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setResizingId(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [editMode, onResizeCard])

  // ── Move (mousedown → drag → mouseup) — snaps to grid position ──
  const handleMoveDown = useCallback((e: React.MouseEvent, id: string, startCardX: number, startCardY: number) => {
    if (!editMode || !gridRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const colPx = gridRef.current.offsetWidth / GRID_COLS
    setMovingId(id)

    function onMove(ev: MouseEvent) {
      ev.preventDefault()
      const dx = Math.round((ev.clientX - startMouseX) / colPx)
      const dy = Math.round((ev.clientY - startMouseY) / H_UNIT)
      const newX = Math.max(0, Math.min(GRID_COLS - 1, startCardX + dx))
      const newY = Math.max(0, startCardY + dy)
      onMoveCard(id, newX, newY)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setMovingId(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [editMode, onMoveCard])

  return (
    <div>
      {/* ── Edit toolbar ── */}
      {editMode && (
        <div className="flex flex-wrap items-center justify-between px-4 py-3 mb-4 bg-slate-900/80 backdrop-blur-md border border-emerald-500/20 rounded-xl animate-fade-in sticky top-0 z-30 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <Settings2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-emerald-400">Edit Dashboard</span>
              <span className="text-[10px] text-slate-500 ml-2 hidden lg:inline">{visibleCards.length} cards · Esc to cancel</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowPicker(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all">
              <Plus size={12} /> Card
            </button>
            <button onClick={() => onAddSpecial('spacer')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">
              <Plus size={12} /> Spacer
            </button>
            <button onClick={() => onAddSpecial('divider')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">
              <Plus size={12} /> Divider
            </button>
            <div className="w-px h-5 bg-white/10" />
            <button onClick={onResetLayout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">
              <RotateCcw size={12} /> Reset
            </button>
            <button onClick={onDiscardEdit} title="Discard all changes (Esc)" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all">
              <X size={12} /> Discard
            </button>
            <button onClick={onExitEdit} className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40">
              <Check size={14} /> Save Layout
            </button>
          </div>
        </div>
      )}

      {/* ── Free-placement grid ── */}
      <div
        ref={gridRef}
        className="dashboard-grid relative"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridAutoRows: `${H_UNIT}px`,
          gap: '8px',
          minHeight: editMode ? `${(maxRow + 4) * H_UNIT}px` : undefined,
        }}
      >
        {/* Empty state */}
        {visibleCards.length === 0 && editMode && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center" style={{ gridColumn: '1 / -1', gridRow: '1 / span 6' }}>
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-white/5 flex items-center justify-center mb-4">
              <LayoutDashboard className="h-5 w-5 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-1">No cards on dashboard</p>
            <p className="text-xs text-slate-500">Click "Card" above to add widgets</p>
          </div>
        )}

        {/* Grid overlay in edit mode — subtle lines showing the grid structure */}
        {editMode && (
          <div
            className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(to right, white 1px, transparent 1px),
                linear-gradient(to bottom, white 1px, transparent 1px)
              `,
              backgroundSize: `calc(100% / ${GRID_COLS}) ${H_UNIT}px`,
            }}
          />
        )}
        {visibleCards.filter((c) => c.id).map((card) => {
          const isSpacer = card.id.startsWith('spacer-')
          const isDivider = card.id.startsWith('divider-')
          const isSpecial = isSpacer || isDivider
          const isMoving = movingId === card.id
          const isResizing = resizingId === card.id

          // ── Special cards (spacer/divider) ──
          if (isSpecial) {
            return (
              <div
                key={card.id}
                className={`relative transition-all duration-150 ${isMoving ? 'opacity-60 z-20 scale-[0.98]' : ''} ${isResizing ? 'ring-2 ring-cyan-500/30 rounded-xl z-10' : ''}`}
                style={{
                  gridColumn: `${card.x + 1} / span ${Math.min(card.w, GRID_COLS - card.x)}`,
                  gridRow: `${card.y + 1} / span ${card.h}`,
                }}
              >
                {editMode && (
                  <>
                    {/* Title label */}
                    <div className="absolute top-2 left-7 z-20 pointer-events-none">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-900/90 text-slate-400 border border-white/10 shadow-lg">
                        {isDivider ? 'Divider' : 'Spacer'}
                      </span>
                    </div>
                    {/* Remove */}
                    <button onClick={(e) => { e.stopPropagation(); onToggleCard(card.id) }}
                      className="absolute top-2 right-2 z-20 h-5 w-5 rounded-full flex items-center justify-center shadow-lg bg-slate-800/90 border border-white/10 text-rose-400 hover:bg-rose-500/30 transition-colors"><X size={8} /></button>
                    {/* Move handle */}
                    <div className="absolute -left-1 top-3 z-20 cursor-move" onMouseDown={(e) => handleMoveDown(e, card.id, card.x, card.y)}>
                      <div className="h-8 w-5 rounded-md bg-slate-800/90 border border-white/10 flex items-center justify-center shadow-lg hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-colors">
                        <Move size={9} className="text-slate-400" />
                      </div>
                    </div>
                    {/* Size badge */}
                    <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
                      <span className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold border shadow ${
                        isResizing || isMoving ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-slate-900/90 text-slate-500 border-white/[0.03]'
                      }`}>{card.w}×{card.h}</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 z-[40] w-6 h-6 cursor-nwse-resize bg-slate-800/80 border border-white/10 rounded-tl-lg rounded-br-xl hover:bg-cyan-500/20 hover:border-cyan-500/30 transition-all shadow-lg flex items-center justify-center"
                      onMouseDown={(e) => handleResizeDown(e, card.id, card.w, card.h)}>
                      <svg width="10" height="10" viewBox="0 0 10 10" className="text-slate-500 hover:text-cyan-400">
                        <path d="M8 2L2 8M8 5L5 8M8 8L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  </>
                )}
                {isDivider ? (
                  <div className="h-full flex items-center gap-3 px-4">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                    {editMode ? (
                      <input type="text" value={labels[card.id] || ''} onChange={(e) => onSetLabel(card.id, e.target.value)}
                        placeholder="Section Title" onClick={(e) => e.stopPropagation()}
                        className="bg-transparent border-none text-[11px] font-semibold uppercase tracking-widest text-slate-400 placeholder-slate-600 text-center outline-none w-40 pointer-events-auto" />
                    ) : labels[card.id] ? (
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{labels[card.id]}</span>
                    ) : null}
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                  </div>
                ) : editMode ? (
                  <div className="h-full border-2 border-dashed border-white/[0.03] rounded-xl flex items-center justify-center">
                    <span className="text-[9px] text-slate-700 uppercase tracking-wider">Spacer</span>
                  </div>
                ) : <div className="h-full" />}
              </div>
            )
          }

          // ── Plugin cards (sandboxed iframe via srcdoc) ──
          if (card.id.startsWith('plugin:')) {
            const parts = card.id.split(':')  // plugin:pluginName:cardName
            const pluginName = parts[1] || 'unknown'
            const cardName = parts[2] || 'default'
            const pluginMeta = pluginCards.find((p) => p.id === card.id)

            return (
              <div
                key={card.id}
                className={`relative transition-all duration-150 ${isMoving ? 'opacity-60 z-20 scale-[0.98]' : ''} ${isResizing ? 'ring-2 ring-cyan-500/30 rounded-xl z-10' : ''} ${editMode && !isMoving && !isResizing ? 'hover:ring-1 hover:ring-emerald-500/20 hover:rounded-xl' : ''}`}
                style={{
                  gridColumn: `${card.x + 1} / span ${Math.min(card.w, GRID_COLS - card.x)}`,
                  gridRow: `${card.y + 1} / span ${card.h}`,
                }}
              >
                {editMode && (
                  <>
                    <div className="absolute top-2 left-7 z-20 pointer-events-none">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-900/90 text-violet-400 border border-violet-500/20 shadow-lg truncate">
                        {pluginMeta?.title || cardName}
                      </span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onToggleCard(card.id) }}
                      className="absolute top-2 right-2 z-20 h-5 w-5 rounded-full flex items-center justify-center shadow-lg bg-slate-800/90 border border-white/10 text-rose-400 hover:bg-rose-500/30 transition-colors"><X size={8} /></button>
                    <div className="absolute -left-1 top-3 z-20 cursor-move" onMouseDown={(e) => handleMoveDown(e, card.id, card.x, card.y)}>
                      <div className="h-8 w-5 rounded-md bg-slate-800/90 border border-white/10 flex items-center justify-center shadow-lg hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-colors">
                        <Move size={9} className="text-slate-400" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
                      <span className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold border shadow ${
                        isResizing || isMoving ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-slate-900/90 text-slate-500 border-white/[0.03]'
                      }`}>{card.w}×{card.h}</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 z-[40] w-6 h-6 cursor-nwse-resize bg-slate-800/80 border border-white/10 rounded-tl-lg rounded-br-xl hover:bg-cyan-500/20 hover:border-cyan-500/30 transition-all shadow-lg flex items-center justify-center"
                      onMouseDown={(e) => handleResizeDown(e, card.id, card.w, card.h)}>
                      <svg width="10" height="10" viewBox="0 0 10 10" className="text-slate-500 hover:text-cyan-400">
                        <path d="M8 2L2 8M8 5L5 8M8 8L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  </>
                )}
                <div className={`rounded-xl overflow-hidden bg-slate-900/60 backdrop-blur-md border border-white/[0.05] ${editMode ? 'pointer-events-none select-none border-dashed border-violet-500/10' : ''}`} style={{ height: '100%' }}>
                  <PluginCardFrame pluginName={pluginName} cardName={cardName} title={pluginMeta?.title || cardName} />
                </div>
              </div>
            )
          }

          // ── Regular cards ──
          const entry = getCardEntry(card.id)
          if (!entry) return null
          const Comp = COMPONENT_MAP[card.id]
          if (!Comp) return null
          const props = cardProps[card.id] || {}

          return (
            <div
              key={card.id}
              className={`
                relative transition-all duration-150
                ${isMoving ? 'opacity-60 z-20 scale-[0.98]' : ''}
                ${isResizing ? 'ring-2 ring-cyan-500/30 rounded-xl z-10' : ''}
                ${editMode && !isMoving && !isResizing ? 'hover:ring-1 hover:ring-emerald-500/20 hover:rounded-xl' : ''}
              `}
              style={{
                gridColumn: `${card.x + 1} / span ${Math.min(card.w, GRID_COLS - card.x)}`,
                gridRow: `${card.y + 1} / span ${card.h}`,
              }}
            >
              {editMode && (
                <>
                  {/* Card title (top-left inside) */}
                  <div className="absolute top-2 left-7 z-20 pointer-events-none">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-900/90 text-emerald-400 border border-emerald-500/20 shadow-lg truncate">
                      {entry.title}
                    </span>
                  </div>
                  {/* Remove button (top-right inside card) */}
                  <button onClick={(e) => { e.stopPropagation(); onToggleCard(card.id) }}
                    className="absolute top-2 right-2 z-20 h-5 w-5 rounded-full flex items-center justify-center shadow-lg bg-slate-800/90 border border-white/10 text-rose-400 hover:bg-rose-500/30 transition-colors"><X size={8} /></button>
                  {/* Move handle */}
                  <div className="absolute -left-1 top-3 z-20 cursor-move" onMouseDown={(e) => handleMoveDown(e, card.id, card.x, card.y)}>
                    <div className="h-8 w-5 rounded-md bg-slate-800/90 border border-white/10 flex items-center justify-center shadow-lg hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-colors">
                      <Move size={9} className="text-slate-400" />
                    </div>
                  </div>
                  {/* Size + position badge */}
                  <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-mono font-bold border shadow ${
                      isResizing || isMoving ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-slate-900/90 text-slate-500 border-white/[0.03]'
                    }`}>{card.w}×{card.h}</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 z-[40] w-6 h-6 cursor-nwse-resize bg-slate-800/80 border border-white/10 rounded-tl-lg rounded-br-xl hover:bg-cyan-500/20 hover:border-cyan-500/30 transition-all shadow-lg flex items-center justify-center"
                    onMouseDown={(e) => handleResizeDown(e, card.id, card.w, card.h)}>
                    <svg width="10" height="10" viewBox="0 0 10 10" className="text-slate-500 hover:text-cyan-400">
                      <path d="M8 2L2 8M8 5L5 8M8 8L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </>
              )}
              <div className={`h-full rounded-xl overflow-hidden [&>*]:h-full [&>*]:overflow-y-auto [&>*]:scrollbar-thin ${
                editMode ? 'pointer-events-none select-none border border-dashed border-white/10' : ''
              }`}>
                <Comp {...props} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Card picker ── */}
      {showPicker && editMode && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowPicker(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md mx-4 animate-scale-in border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-400" /><h3 className="text-sm font-semibold text-slate-200">Add Cards</h3></div>
              <button onClick={() => setShowPicker(false)} className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5"><X size={14} /></button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {hiddenCards.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">All cards are visible</p>
              ) : hiddenCards.filter((c) => c.id).map((card) => {
                const entry = getCardEntry(card.id)
                if (!entry) return null
                const Icon = ICON_MAP[entry.iconName] || Box
                return (
                  <button key={card.id} onClick={() => { onToggleCard(card.id); if (hiddenCards.length <= 1) setShowPicker(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/5 hover:border-emerald-500/20 transition-all text-left">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Icon className="h-4 w-4 text-emerald-400" /></div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-medium text-slate-200">{entry.title}</p><p className="text-[10px] text-slate-500 truncate">{entry.description}</p></div>
                    <Plus size={14} className="text-emerald-400 shrink-0" />
                  </button>
                )
              })}

              {/* Plugin cards section — always show */}
              <div className="flex items-center gap-2 mt-4 mb-2">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[9px] font-semibold uppercase tracking-widest text-violet-400">Plugin Cards</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              {(() => {
                const availablePluginCards = pluginCards.filter((pc) => !visibleCards.some((vc) => vc.id === pc.id))
                if (availablePluginCards.length === 0) {
                  return (
                    <p className="text-[10px] text-slate-500 text-center py-4">
                      {pluginCards.length === 0
                        ? 'No plugin cards installed. Add plugins with cards/ directory to see them here.'
                        : 'All plugin cards are on the dashboard.'}
                    </p>
                  )
                }
                return availablePluginCards.map((pc) => (
                    <button
                      key={pc.id}
                      onClick={() => {
                        onAddPluginCard(pc.id, pc.defaultW, pc.defaultH)
                        setShowPicker(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/[0.03] border border-violet-500/10 hover:bg-violet-500/[0.08] hover:border-violet-500/20 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <Rocket className="h-4 w-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-slate-200">{pc.title}</p>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 font-medium">Plugin</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{pc.description}</p>
                      </div>
                      <Plus size={14} className="text-violet-400 shrink-0" />
                    </button>
                  ))
              })()}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
