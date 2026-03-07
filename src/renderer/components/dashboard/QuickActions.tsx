// =============================================================================
// QuickActions — Dashboard panel with common server management actions
// =============================================================================

import React, { useState, useCallback } from 'react'
import {
  Trash2, RefreshCw, Layers,
  HeartPulse, ScrollText, Monitor, Settings2, Loader2, Zap,
  ChevronDown, Archive,
  TerminalSquare, Download, Wrench,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { useToast } from '../common/Toast'
import { runImagePrune, triggerLogRotate, fetchHealthReport, triggerBackup } from '../../api/endpoints'
import { useHealthStore } from '../../stores/healthStore'
import type { PageId } from '../../../shared/types'

interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  navigateTo?: PageId
  apiAction?: boolean
}

const navActions: QuickAction[] = [
  {
    id: 'stacks',
    label: 'Manage Stacks',
    icon: <Layers size={18} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 group-hover:bg-emerald-500/15',
    navigateTo: 'stacks',
  },
  {
    id: 'health',
    label: 'Health Monitor',
    icon: <HeartPulse size={18} />,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10 group-hover:bg-rose-500/15',
    navigateTo: 'health',
  },
  {
    id: 'logs',
    label: 'View Logs',
    icon: <ScrollText size={18} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 group-hover:bg-amber-500/15',
    navigateTo: 'logs',
  },
  {
    id: 'system',
    label: 'System Info',
    icon: <Monitor size={18} />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 group-hover:bg-cyan-500/15',
    navigateTo: 'system',
  },
  {
    id: 'config',
    label: 'Server Config',
    icon: <Settings2 size={18} />,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10 group-hover:bg-violet-500/15',
    navigateTo: 'config',
  },
  {
    id: 'containers',
    label: 'Containers',
    icon: <RefreshCw size={18} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 group-hover:bg-blue-500/15',
    navigateTo: 'containers',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: <TerminalSquare size={18} />,
    color: 'text-slate-300',
    bgColor: 'bg-slate-500/10 group-hover:bg-slate-500/15',
    navigateTo: 'terminal',
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    icon: <Wrench size={18} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 group-hover:bg-amber-500/15',
    navigateTo: 'maintenance',
  },
  {
    id: 'backup',
    label: 'Backup',
    icon: <Archive size={18} />,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10 group-hover:bg-teal-500/15',
    navigateTo: 'backup',
  },
]

const apiActions: QuickAction[] = [
  {
    id: 'prune-images',
    label: 'Prune Images',
    icon: <Trash2 size={18} />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 group-hover:bg-orange-500/15',
    apiAction: true,
  },
  {
    id: 'rotate-logs',
    label: 'Rotate Logs',
    icon: <Archive size={18} />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10 group-hover:bg-pink-500/15',
    apiAction: true,
  },
  {
    id: 'check-health',
    label: 'Check Health',
    icon: <HeartPulse size={18} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 group-hover:bg-emerald-500/15',
    apiAction: true,
  },
  {
    id: 'run-backup',
    label: 'Run Backup',
    icon: <Download size={18} />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 group-hover:bg-cyan-500/15',
    apiAction: true,
  },
]

const allActions = [...navActions, ...apiActions]

export default function QuickActions({ collapsible = false }: { collapsible?: boolean }) {
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const isConnected = useConnectionStore((s) => s.status) === 'connected'
  const setHealthReport = useHealthStore((s) => s.setReport)
  const { addToast } = useToast()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false
    try { return localStorage.getItem('dash-quickactions-collapsed') === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('dash-quickactions-collapsed', String(next)) } catch {}
  }

  const handleApiAction = useCallback(async (actionId: string) => {
    if (loadingAction) return
    setLoadingAction(actionId)
    try {
      switch (actionId) {
        case 'prune-images': {
          const result = await runImagePrune()
          addToast({
            type: result.success ? 'success' : 'error',
            message: result.success ? 'Stale images pruned successfully' : 'Image prune failed',
          })
          break
        }
        case 'rotate-logs': {
          const result = await triggerLogRotate()
          addToast({
            type: result.success ? 'success' : 'error',
            message: result.success
              ? `Logs rotated${result.archived_as ? ` — archived as ${result.archived_as}` : ''}`
              : 'Log rotation failed',
          })
          break
        }
        case 'check-health': {
          const report = await fetchHealthReport()
          setHealthReport(report)
          addToast({
            type: report.status === 'healthy' ? 'success' : report.status === 'degraded' ? 'warning' : 'error',
            message: `Health: ${report.status} — ${report.summary.healthy}/${report.summary.total} healthy`,
          })
          break
        }
        case 'run-backup': {
          const result = await triggerBackup()
          addToast({
            type: result.success ? 'success' : 'error',
            message: result.success ? `Backup started: ${result.filename}` : 'Backup failed',
          })
          break
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      addToast({ type: 'error', message: msg })
    } finally {
      setLoadingAction(null)
    }
  }, [loadingAction, addToast, setHealthReport])

  const handleClick = useCallback((action: QuickAction) => {
    if (action.navigateTo) {
      setCurrentPage(action.navigateTo)
    } else if (action.apiAction) {
      handleApiAction(action.id)
    }
  }, [setCurrentPage, handleApiAction])

  return (
    <div className="glass-card p-4 md:p-6 animate-fade-in">
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer select-none' : ''} ${collapsed ? '' : 'mb-4'}`}
        onClick={collapsible ? toggleCollapsed : undefined}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          Quick Actions
        </h3>
        {collapsible && (
          <ChevronDown
            size={16}
            className={`text-slate-500 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        )}
      </div>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${collapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100'}`}
      >
        <div className={`grid grid-cols-3 md:grid-cols-4 gap-2 stagger-children ${collapsed ? '' : 'pt-0'}`}>
          {allActions.map((action) => {
            const isLoading = loadingAction === action.id
            return (
              <button
                key={action.id}
                onClick={() => handleClick(action)}
                disabled={(!isConnected && !!action.apiAction) || isLoading}
                className="
                  group flex flex-col items-center gap-2.5 p-4
                  rounded-xl bg-slate-800/30 border border-white/[0.03]
                  hover:border-white/[0.08] hover:bg-slate-800/50
                  hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20
                  disabled:opacity-40
                  transition-all duration-200
                  text-center press
                "
              >
                <div className={`rounded-lg p-2.5 ${action.bgColor} ${action.color} transition-all duration-300 group-hover:scale-110`}>
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : action.icon}
                </div>
                <span className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors">
                  {action.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
