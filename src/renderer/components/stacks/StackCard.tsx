// =============================================================================
// StackCard — Stack card with status, annotations, priority, batch select, and actions
// =============================================================================

import {
  Play, Square, RotateCcw, Download, Loader2, Box,
  AlertTriangle, Tag, Pencil, Check, Shield, Trash2, Clock,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useStackStore } from '../../stores/stackStore'
import { CopyButton } from '../common/CopyButton'
import type { StackInfo } from '../../../shared/types'

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface Props {
  stack: StackInfo
  isActionLoading: boolean
  onAction: (stackName: string, action: 'start' | 'stop' | 'restart' | 'update') => void
  onSelect: (stackName: string) => void
  onEdit?: (stackName: string) => void
  onDelete?: (stackName: string) => void
  batchMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (name: string) => void
  isAdmin?: boolean
}

/** Pretty-print stack category names: "core-infrastructure" -> "Core Infrastructure" */
function formatStackName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const priorityConfig = {
  critical: { label: 'Critical', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: Shield },
  high: { label: 'High', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: AlertTriangle },
  normal: { label: 'Normal', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', icon: Tag },
  low: { label: 'Low', color: 'text-slate-500', bg: 'bg-slate-500/10 border-slate-500/20', icon: Tag },
}

export default function StackCard({ stack, isActionLoading, onAction, onSelect, onEdit, onDelete, batchMode, isSelected, onToggleSelect, isAdmin = false }: Props) {
  const isRunning = stack.status === 'running'
  const lastActionTimestamps = useStackStore((s) => s.lastActionTimestamps)
  const lastAction = lastActionTimestamps[stack.name]
  const stackAnnotations = useSettingsStore((s) => s.stackAnnotations) ?? {}
  const annotation = stackAnnotations[stack.name] ?? {}
  const hasPriority = annotation.priority && annotation.priority !== 'normal'
  const priorityCfg = annotation.priority ? priorityConfig[annotation.priority] : null

  const actionButtons: {
    action: 'start' | 'stop' | 'restart' | 'update'
    icon: typeof Play
    label: string
    color: string
    hoverColor: string
    disabled?: boolean
  }[] = [
    {
      action: 'start',
      icon: Play,
      label: isRunning ? 'Reload' : 'Start',
      color: 'text-emerald-400',
      hoverColor: 'hover:bg-emerald-500/15 hover:text-emerald-300',
    },
    {
      action: 'stop',
      icon: Square,
      label: 'Stop',
      color: 'text-rose-400',
      hoverColor: 'hover:bg-rose-500/15 hover:text-rose-300',
      disabled: !isRunning,
    },
    {
      action: 'restart',
      icon: RotateCcw,
      label: 'Restart',
      color: 'text-amber-400',
      hoverColor: 'hover:bg-amber-500/15 hover:text-amber-300',
      disabled: !isRunning,
    },
    {
      action: 'update',
      icon: Download,
      label: 'Update',
      color: 'text-cyan-400',
      hoverColor: 'hover:bg-cyan-500/15 hover:text-cyan-300',
    },
  ]

  // Border color based on priority (or selection in batch mode)
  const borderColor = batchMode && isSelected
    ? 'border-l-cyan-500/70'
    : annotation.priority === 'critical'
      ? 'border-l-rose-500/70'
      : annotation.priority === 'high'
        ? 'border-l-amber-500/70'
        : isRunning ? 'border-l-emerald-500/70' : 'border-l-slate-600/50'

  // Handle card click based on mode
  const handleCardClick = () => {
    if (batchMode && onToggleSelect) {
      onToggleSelect(stack.name)
    } else {
      onSelect(stack.name)
    }
  }

  return (
    <div
      className={`
        group relative glass glass-hover cursor-pointer overflow-hidden
        border-l-2 transition-all duration-300
        ${borderColor}
        ${isRunning && !batchMode ? 'glow-emerald' : ''}
        ${batchMode && isSelected ? 'ring-2 ring-cyan-500/40' : ''}
      `}
      onClick={handleCardClick}
    >
      {/* Subtle glow overlay for running stacks */}
      {isRunning && !batchMode && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] to-transparent pointer-events-none" />
      )}

      {/* Selected glow overlay in batch mode */}
      {batchMode && isSelected && (
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.05] to-transparent pointer-events-none" />
      )}

      {/* Critical/high priority indicator */}
      {annotation.priority === 'critical' && (
        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden pointer-events-none">
          <div className="absolute -right-6 -top-6 w-12 h-12 rounded-full bg-rose-500/10" />
        </div>
      )}

      {/* Card content */}
      <div className="relative p-5 pb-6">
        {/* Header row: checkbox (batch mode) + name + status + edit */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-3 flex-1 min-w-0 mr-3">
            {/* Batch mode checkbox */}
            {batchMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSelect?.(stack.name)
                }}
                className={`
                  shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center
                  transition-all duration-200
                  ${isSelected
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-500/50 hover:border-slate-400 bg-transparent'}
                `}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
              </button>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100 truncate group-hover:text-white transition-colors">
                  {annotation.label || formatStackName(stack.name)}
                </h3>
                {hasPriority && priorityCfg && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold border ${priorityCfg.bg} ${priorityCfg.color}`}
                    title={`Priority: ${priorityCfg.label} — affects sort order and visual emphasis`}
                  >
                    <priorityCfg.icon size={8} />
                    {priorityCfg.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5 font-mono flex items-center gap-1">
                {stack.name}
                <CopyButton text={stack.name} className="opacity-0 group-hover:opacity-100" size={10} />
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!batchMode && onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(stack.name) }}
                className="
                  flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold
                  bg-slate-700/60 border border-slate-600/50 text-slate-200
                  hover:bg-emerald-600 hover:border-emerald-500 hover:text-white
                  shadow-sm transition-all duration-200
                "
                title="Edit stack"
              >
                <Pencil size={10} />
                Edit
              </button>
            )}
            {!batchMode && onDelete && !isRunning && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(stack.name) }}
                className="
                  flex items-center justify-center w-7 h-7 rounded-md
                  bg-white/5 border border-white/5 text-slate-500
                  hover:bg-rose-500/15 hover:border-rose-500/25 hover:text-rose-400
                  opacity-0 group-hover:opacity-100
                  transition-all duration-200
                "
                title="Delete stack"
              >
                <Trash2 size={11} />
              </button>
            )}
            <span
              className={`
                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ml-1
                ${
                  isRunning
                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25'
                    : 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25'
                }
              `}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
                title={isRunning ? 'All containers are up' : 'Stack is not running'}
              />
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>

        {/* Notes (if set) */}
        {annotation.notes && (
          <p className="text-[10px] text-slate-500 italic mb-2 line-clamp-2">{annotation.notes}</p>
        )}

        {/* Container count */}
        <div className="flex items-center gap-2 mb-4">
          <Box className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">
            <span className={`font-semibold ${isRunning ? 'text-emerald-400' : 'text-slate-300'}`}>
              {stack.running_containers}
            </span>{' '}
            container{stack.running_containers !== 1 ? 's' : ''} running
          </span>
          {lastAction && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Clock size={10} />
              {formatRelativeTime(lastAction)}
            </span>
          )}
        </div>

        {/* Action buttons (hidden in batch mode) */}
        {!batchMode && (
          <div
            className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            {actionButtons.filter((b) => b.action !== 'update' || isAdmin).map(({ action, icon: Icon, label, color, hoverColor, disabled }) => {
              const isDisabled = disabled || isActionLoading

              return (
                <button
                  key={action}
                  onClick={() => onAction(stack.name, action)}
                  disabled={isDisabled}
                  title={label}
                  className={`
                    relative flex items-center justify-center w-8 h-8 rounded-lg
                    transition-all duration-200
                    ${
                      isDisabled
                        ? 'text-slate-500 cursor-not-allowed'
                        : `${color} ${hoverColor}`
                    }
                  `}
                >
                  {isActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </button>
              )
            })}

            {/* Compose file indicator */}
            {stack.has_env && (
              <span className="ml-auto text-[10px] text-slate-500 font-mono">.env</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
