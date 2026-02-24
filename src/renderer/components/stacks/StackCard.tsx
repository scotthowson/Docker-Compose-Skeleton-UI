// =============================================================================
// StackCard — Stack card with status, annotations, priority, and actions
// =============================================================================

import { useState } from 'react'
import {
  Play, Square, RotateCcw, Download, Loader2, Box,
  AlertTriangle, Tag, Pencil, Check, X, Shield, Trash2,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import type { StackInfo, StackAnnotation } from '../../../shared/types'

interface Props {
  stack: StackInfo
  isActionLoading: boolean
  onAction: (stackName: string, action: 'start' | 'stop' | 'restart' | 'update') => void
  onSelect: (stackName: string) => void
  onDelete?: (stackName: string) => void
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

function AnnotationEditor({ stackName, annotation, onClose }: {
  stackName: string
  annotation: StackAnnotation
  onClose: () => void
}) {
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const stackAnnotations = useSettingsStore((s) => s.stackAnnotations) ?? {}

  const [label, setLabel] = useState(annotation.label ?? '')
  const [priority, setPriority] = useState(annotation.priority ?? 'normal')
  const [notes, setNotes] = useState(annotation.notes ?? '')

  const handleSave = () => {
    const newAnnotations = { ...stackAnnotations }
    const anno: StackAnnotation = {}
    if (label.trim()) anno.label = label.trim()
    if (priority !== 'normal') anno.priority = priority
    if (notes.trim()) anno.notes = notes.trim()

    if (Object.keys(anno).length > 0) {
      newAnnotations[stackName] = anno
    } else {
      delete newAnnotations[stackName]
    }
    updateSetting('stackAnnotations', newAnnotations)
    onClose()
  }

  return (
    <div
      className="absolute inset-0 z-10 bg-slate-950 rounded-xl animate-fade-in flex flex-col overflow-hidden border border-slate-700/50 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex-1 overflow-y-auto p-4 pb-2 scrollbar-thin">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Edit Stack</h4>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors rounded-md hover:bg-slate-800 p-1">
            <X size={14} />
          </button>
        </div>

        {/* Label */}
        <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Custom Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Custom label..."
          className="w-full bg-slate-900 border border-slate-600/50 rounded-lg px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 mb-3"
        />

        {/* Priority */}
        <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Priority</label>
        <div className="flex items-center gap-1.5 mb-3">
          {(['critical', 'high', 'normal', 'low'] as const).map((p) => {
            const cfg = priorityConfig[p]
            const isActive = priority === p
            return (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`
                  rounded-md px-2.5 py-1.5 text-[10px] font-medium border transition-all
                  ${isActive ? `${cfg.bg} ${cfg.color} ring-1 ring-current/20` : 'border-slate-600/50 text-slate-400 hover:text-slate-200 hover:border-slate-500'}
                `}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Notes */}
        <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes..."
          rows={2}
          className="w-full bg-slate-900 border border-slate-600/50 rounded-lg px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 resize-none"
        />
      </div>

      {/* Fixed save button at bottom */}
      <div className="p-3 pt-2 border-t border-slate-700/50 shrink-0 bg-slate-950">
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-1.5 w-full rounded-lg py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Check size={12} />
          Save Changes
        </button>
      </div>
    </div>
  )
}

export default function StackCard({ stack, isActionLoading, onAction, onSelect, onDelete }: Props) {
  const isRunning = stack.status === 'running'
  const [showEditor, setShowEditor] = useState(false)
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
      label: 'Start',
      color: 'text-emerald-400',
      hoverColor: 'hover:bg-emerald-500/15 hover:text-emerald-300',
      disabled: isRunning,
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

  // Border color based on priority
  const borderColor = annotation.priority === 'critical'
    ? 'border-l-rose-500/70'
    : annotation.priority === 'high'
      ? 'border-l-amber-500/70'
      : isRunning ? 'border-l-emerald-500/70' : 'border-l-slate-600/50'

  return (
    <div
      className={`
        group relative glass glass-hover cursor-pointer overflow-hidden
        border-l-2 transition-all duration-300
        ${borderColor}
      `}
      onClick={() => onSelect(stack.name)}
    >
      {/* Annotation editor overlay */}
      {showEditor && (
        <AnnotationEditor
          stackName={stack.name}
          annotation={annotation}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Subtle glow overlay for running stacks */}
      {isRunning && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] to-transparent pointer-events-none" />
      )}

      {/* Critical/high priority indicator */}
      {annotation.priority === 'critical' && (
        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden pointer-events-none">
          <div className="absolute -right-6 -top-6 w-12 h-12 rounded-full bg-rose-500/10" />
        </div>
      )}

      {/* Card content */}
      <div className="relative p-5 pb-6">
        {/* Header row: name + status + edit */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100 truncate group-hover:text-white transition-colors">
                {annotation.label || formatStackName(stack.name)}
              </h3>
              {hasPriority && priorityCfg && (
                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold border ${priorityCfg.bg} ${priorityCfg.color}`}>
                  <priorityCfg.icon size={8} />
                  {priorityCfg.label}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">
              {stack.name}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setShowEditor(true) }}
              className="
                flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold
                bg-slate-700/60 border border-slate-600/50 text-slate-200
                hover:bg-emerald-600 hover:border-emerald-500 hover:text-white
                shadow-sm transition-all duration-200
              "
              title="Edit annotations"
            >
              <Pencil size={10} />
              Edit
            </button>
            {onDelete && !isRunning && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(stack.name) }}
                className="
                  flex items-center justify-center w-7 h-7 rounded-md
                  bg-white/[0.04] border border-white/[0.06] text-slate-500
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
        </div>

        {/* Action buttons */}
        <div
          className="flex items-center gap-1.5 pt-3 border-t border-white/[0.06]"
          onClick={(e) => e.stopPropagation()}
        >
          {actionButtons.map(({ action, icon: Icon, label, color, hoverColor, disabled }) => {
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
                      ? 'text-slate-600 cursor-not-allowed'
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
            <span className="ml-auto text-[10px] text-slate-600 font-mono">.env</span>
          )}
        </div>
      </div>
    </div>
  )
}
