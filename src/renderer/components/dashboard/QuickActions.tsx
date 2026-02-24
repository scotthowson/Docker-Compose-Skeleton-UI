// =============================================================================
// QuickActions — Dashboard panel with common server management actions
// =============================================================================

import React, { useState } from 'react'
import {
  Play, Square, RotateCw, Trash2, RefreshCw, Layers,
  HeartPulse, ScrollText, Monitor, Settings2, Loader2, Zap,
  HardDrive, Network, Cog, ChevronDown,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import type { PageId } from '../../../shared/types'

interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
  navigateTo?: PageId
}

const actions: QuickAction[] = [
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
    id: 'images',
    label: 'Images',
    icon: <HardDrive size={18} />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 group-hover:bg-orange-500/15',
    navigateTo: 'images',
  },
  {
    id: 'networks',
    label: 'Networks',
    icon: <Network size={18} />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10 group-hover:bg-pink-500/15',
    navigateTo: 'networks',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Cog size={18} />,
    color: 'text-slate-300',
    bgColor: 'bg-slate-500/10 group-hover:bg-slate-500/15',
    navigateTo: 'settings',
  },
]

export default function QuickActions({ collapsible = false }: { collapsible?: boolean }) {
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)
  const isConnected = useConnectionStore((s) => s.status) === 'connected'
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false
    try { return localStorage.getItem('dash-quickactions-collapsed') === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('dash-quickactions-collapsed', String(next)) } catch {}
  }

  return (
    <div className="glass-card p-6 animate-fade-in">
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
        <div className={`grid grid-cols-3 gap-2.5 ${collapsed ? '' : 'pt-0'}`}>
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => action.navigateTo && setCurrentPage(action.navigateTo)}
              disabled={!isConnected && action.id !== 'stacks'}
              className="
                group flex flex-col items-center gap-2.5 p-4
                rounded-xl bg-slate-800/30 border border-white/[0.03]
                hover:border-white/[0.08] hover:bg-slate-800/50
                disabled:opacity-40
                transition-all duration-200
                text-center
              "
            >
              <div className={`rounded-lg p-2.5 ${action.bgColor} ${action.color} transition-colors`}>
                {action.icon}
              </div>
              <span className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
