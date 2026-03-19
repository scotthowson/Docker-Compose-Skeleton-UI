// =============================================================================
// Export — Server Data Export Center
// =============================================================================

import React, { useState, useCallback } from 'react'
import {
  Download, Layers, HeartPulse, Monitor, Settings2, Loader2, ShieldAlert,
} from 'lucide-react'
import { exportData } from '../api/endpoints'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useToast } from '../components/common/Toast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportCard {
  id: string
  type: 'health' | 'system' | 'config'
  title: string
  description: string
  icon: React.ElementType
  color: string
}

// ---------------------------------------------------------------------------
// Card definitions
// ---------------------------------------------------------------------------

const exportCards: ExportCard[] = [
  {
    id: 'stacks',
    type: 'config',
    title: 'Stack Configs',
    description: 'Export all compose files and environment configs',
    icon: Layers,
    color: 'emerald',
  },
  {
    id: 'health',
    type: 'health',
    title: 'Health Report',
    description: 'Export current health check results as JSON',
    icon: HeartPulse,
    color: 'cyan',
  },
  {
    id: 'system',
    type: 'system',
    title: 'System Info',
    description: 'Export system information and resource usage',
    icon: Monitor,
    color: 'amber',
  },
  {
    id: 'config',
    type: 'config',
    title: 'Configuration',
    description: 'Export server configuration and settings',
    icon: Settings2,
    color: 'violet',
  },
]

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const colorMap: Record<string, { iconBg: string; iconText: string; btnBg: string; btnHover: string; btnText: string; border: string }> = {
  emerald: {
    iconBg: 'bg-emerald-500/15',
    iconText: 'text-emerald-400',
    btnBg: 'bg-emerald-500/20',
    btnHover: 'hover:bg-emerald-500/30',
    btnText: 'text-emerald-400',
    border: 'hover:border-emerald-500/20',
  },
  cyan: {
    iconBg: 'bg-cyan-500/15',
    iconText: 'text-cyan-400',
    btnBg: 'bg-cyan-500/20',
    btnHover: 'hover:bg-cyan-500/30',
    btnText: 'text-cyan-400',
    border: 'hover:border-cyan-500/20',
  },
  amber: {
    iconBg: 'bg-amber-500/15',
    iconText: 'text-amber-400',
    btnBg: 'bg-amber-500/20',
    btnHover: 'hover:bg-amber-500/30',
    btnText: 'text-amber-400',
    border: 'hover:border-amber-500/20',
  },
  violet: {
    iconBg: 'bg-violet-500/15',
    iconText: 'text-violet-400',
    btnBg: 'bg-violet-500/20',
    btnHover: 'hover:bg-violet-500/30',
    btnText: 'text-violet-400',
    border: 'hover:border-violet-500/20',
  },
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

function triggerDownload(data: unknown, type: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `dcs-${type}-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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

  const handleExport = useCallback(async (card: ExportCard) => {
    setLoadingMap((prev) => ({ ...prev, [card.id]: true }))
    try {
      const res = await exportData(card.type)
      triggerDownload(res.data ?? res, card.id)
      addToast({ type: 'success', message: `${card.title} exported successfully` })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      addToast({ type: 'error', message: `Failed to export ${card.title}: ${message}` })
    } finally {
      setLoadingMap((prev) => ({ ...prev, [card.id]: false }))
    }
  }, [addToast])

  return (
    <div className="space-y-6 animate-fade-in">
      <DisconnectedBanner />

      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/15">
          <Download className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold"><span className="text-gradient">Export Center</span></h1>
          <p className="text-sm text-slate-400 mt-0.5">Download server data and reports</p>
        </div>
      </div>

      {/* Non-admin notice */}
      {!isAdmin && (
        <div className="glass rounded-xl p-4 border border-amber-500/20 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300/90">
            Admin privileges are required to export server data.
          </p>
        </div>
      )}

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exportCards.map((card) => {
          const colors = colorMap[card.color]
          const Icon = card.icon
          const isLoading = loadingMap[card.id] ?? false

          return (
            <div
              key={card.id}
              className={`glass rounded-xl p-6 border border-white/5 ${colors.border} transition-all`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`flex items-center justify-center w-11 h-11 rounded-lg ${colors.iconBg}`}>
                    <Icon className={`w-5 h-5 ${colors.iconText}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{card.description}</p>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => handleExport(card)}
                    disabled={isLoading || !isConnected}
                    className={`px-4 py-2 rounded-lg ${colors.btnBg} ${colors.btnText} ${colors.btnHover} text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 press`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting
                      </>
                    ) : (
                      'Export'
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
