// =============================================================================
// DiskMonitor — Shows mounted filesystems with custom labels and usage bars
//               with disk warning banner and pulsing glow for near-capacity
// =============================================================================

import React, { useState, useCallback } from 'react'
import { HardDrive, Pencil, Check, X, FolderPlus, AlertTriangle, ShieldAlert } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import type { DiskInfo, CustomDiskEntry } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePercent(p: string): number {
  return parseInt(p.replace('%', ''), 10) || 0
}

function percentColor(pct: number): string {
  if (pct >= 90) return 'bg-rose-500'
  if (pct >= 75) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function percentTextColor(pct: number): string {
  if (pct >= 90) return 'text-rose-400'
  if (pct >= 75) return 'text-amber-400'
  return 'text-emerald-400'
}

// ---------------------------------------------------------------------------
// Disk Warning Banner
// ---------------------------------------------------------------------------

function DiskWarningBanner({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-rose-500/15 border border-rose-500/25 px-3.5 py-2.5 mb-4 animate-fade-in">
      <AlertTriangle size={16} className="text-rose-400 shrink-0" />
      <span className="text-xs font-medium text-rose-300">
        {count} disk{count !== 1 ? 's' : ''} above 85% capacity
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Disk Row
// ---------------------------------------------------------------------------

function DiskRow({ disk, label, onLabelChange }: {
  disk: DiskInfo
  label: string
  onLabelChange: (mount: string, label: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(label)
  const [barHovered, setBarHovered] = useState(false)
  const pct = parsePercent(disk.percent)
  const isNearCapacity = pct >= 90

  const handleSave = () => {
    onLabelChange(disk.mount, editValue.trim())
    setEditing(false)
  }

  const handleCancel = () => {
    setEditValue(label)
    setEditing(false)
  }

  const displayName = label || disk.mount

  return (
    <div className="group rounded-lg bg-slate-800/30 border border-white/[0.03] hover:border-white/5 p-3.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <HardDrive size={14} className={percentTextColor(pct)} />
          {editing ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' ? handleSave() : e.key === 'Escape' ? handleCancel() : null}
                autoFocus
                className="flex-1 bg-slate-900/60 border border-emerald-500/30 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                placeholder="Custom label..."
              />
              <button onClick={handleSave} className="text-emerald-400 hover:text-emerald-300">
                <Check size={12} />
              </button>
              <button onClick={handleCancel} className="text-slate-500 hover:text-slate-300">
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              <span className="text-xs font-semibold text-slate-200 truncate" title={disk.mount}>
                {displayName}
              </span>
              {isNearCapacity && (
                <ShieldAlert size={12} className="text-rose-400 shrink-0" title="Near capacity" />
              )}
              <button
                onClick={() => { setEditValue(label); setEditing(true) }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-400 transition-opacity"
                title="Rename"
              >
                <Pencil size={10} />
              </button>
            </>
          )}
        </div>
        <span className={`text-xs font-bold tabular-nums ${percentTextColor(pct)}`}>
          {disk.percent}
        </span>
      </div>

      {/* Progress bar with hover tooltip */}
      <div
        className="relative mb-2"
        onMouseEnter={() => setBarHovered(true)}
        onMouseLeave={() => setBarHovered(false)}
      >
        {/* Tooltip above the bar */}
        <div
          className={`
            absolute -top-9 z-20
            flex items-center gap-2
            px-2.5 py-1 rounded-lg
            bg-slate-800/95 border border-white/10 backdrop-blur-md
            shadow-lg shadow-black/30
            text-[11px] font-medium
            whitespace-nowrap pointer-events-none
            transition-all duration-150 origin-bottom
            ${barHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
          `}
          style={{ left: `clamp(0px, calc(${pct}% - 60px), calc(100% - 120px))` }}
        >
          <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${percentColor(pct)}`} />
          <span className="text-slate-200">{disk.used}</span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-400">{disk.total}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{disk.available} free</span>
        </div>

        <div className="h-2.5 rounded-full bg-slate-800/80 overflow-hidden">
          <div
            className={`h-full rounded-full ${percentColor(pct)} transition-all duration-700 ease-out ${isNearCapacity ? 'animate-pulse' : ''} ${barHovered ? 'brightness-125 shadow-lg' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Details row */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">
          <span className="text-slate-400 font-medium">{disk.used}</span>
          <span className="text-slate-600 mx-0.5">/</span>
          <span>{disk.total}</span>
        </span>
        <span className="text-slate-500">
          <span className="text-slate-400 font-medium">{disk.available}</span>
          <span className="ml-0.5">free</span>
        </span>
      </div>

      {/* Mount path — shown when custom label is set, or always as subtle mono text */}
      {label ? (
        <div className="mt-1.5 text-[9px] text-slate-600 font-mono truncate" title={disk.device}>
          {disk.mount}
        </div>
      ) : (
        <div className="mt-1.5 text-[9px] text-slate-600 font-mono truncate" title={disk.device}>
          {disk.device}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Disk Row — shows user-added locations that may or may not have data
// ---------------------------------------------------------------------------

function CustomDiskRow({ custom, serverDisk, label, onLabelChange }: {
  custom: CustomDiskEntry
  serverDisk: DiskInfo | null
  label: string
  onLabelChange: (mount: string, label: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(label)
  const [barHovered, setBarHovered] = useState(false)

  const handleSave = () => {
    onLabelChange(custom.mount, editValue.trim())
    setEditing(false)
  }

  const handleCancel = () => {
    setEditValue(label)
    setEditing(false)
  }

  const displayName = label || custom.label || custom.mount

  // If the server has data for this mount, render like a normal disk with usage
  if (serverDisk) {
    const pct = parsePercent(serverDisk.percent)
    const isNearCapacity = pct >= 90
    return (
      <div className="group rounded-lg bg-violet-500/[0.03] border border-violet-500/10 hover:border-violet-500/20 p-3.5 transition-all duration-200">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FolderPlus size={14} className={percentTextColor(pct)} />
            {editing ? (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' ? handleSave() : e.key === 'Escape' ? handleCancel() : null}
                  autoFocus
                  className="flex-1 bg-slate-900/60 border border-violet-500/30 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                  placeholder="Custom label..."
                />
                <button onClick={handleSave} className="text-violet-400 hover:text-violet-300"><Check size={12} /></button>
                <button onClick={handleCancel} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
              </div>
            ) : (
              <>
                <span className="text-xs font-semibold text-slate-200 truncate" title={custom.mount}>
                  {displayName}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400/70 border border-violet-500/10 shrink-0">
                  custom
                </span>
                {isNearCapacity && (
                  <ShieldAlert size={12} className="text-rose-400 shrink-0" title="Near capacity" />
                )}
                <button
                  onClick={() => { setEditValue(label); setEditing(true) }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-400 transition-opacity"
                  title="Rename"
                >
                  <Pencil size={10} />
                </button>
              </>
            )}
          </div>
          <span className={`text-xs font-bold tabular-nums ${percentTextColor(pct)}`}>{serverDisk.percent}</span>
        </div>
        <div
          className="relative mb-2"
          onMouseEnter={() => setBarHovered(true)}
          onMouseLeave={() => setBarHovered(false)}
        >
          <div
            className={`
              absolute -top-9 z-20
              flex items-center gap-2
              px-2.5 py-1 rounded-lg
              bg-slate-800/95 border border-white/10 backdrop-blur-md
              shadow-lg shadow-black/30
              text-[11px] font-medium
              whitespace-nowrap pointer-events-none
              transition-all duration-150 origin-bottom
              ${barHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
            `}
            style={{ left: `clamp(0px, calc(${pct}% - 60px), calc(100% - 120px))` }}
          >
            <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${percentColor(pct)}`} />
            <span className="text-slate-200">{serverDisk.used}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{serverDisk.total}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">{serverDisk.available} free</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-800/80 overflow-hidden">
            <div className={`h-full rounded-full ${percentColor(pct)} transition-all duration-700 ease-out ${isNearCapacity ? 'animate-pulse' : ''} ${barHovered ? 'brightness-125 shadow-lg' : ''}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500">
            <span className="text-slate-400 font-medium">{serverDisk.used}</span>
            <span className="text-slate-600 mx-0.5">/</span>
            <span>{serverDisk.total}</span>
          </span>
          <span className="text-slate-500">
            <span className="text-slate-400 font-medium">{serverDisk.available}</span>
            <span className="ml-0.5">free</span>
          </span>
        </div>
        {label ? (
          <div className="mt-1.5 text-[9px] text-slate-600 font-mono truncate" title={serverDisk.device}>{custom.mount}</div>
        ) : (
          <div className="mt-1.5 text-[9px] text-slate-600 font-mono truncate" title={serverDisk.device}>{serverDisk.device}</div>
        )}
      </div>
    )
  }

  // No server data — show placeholder
  return (
    <div className="group rounded-lg bg-violet-500/[0.03] border border-dashed border-violet-500/15 hover:border-violet-500/25 p-3.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FolderPlus size={14} className="text-violet-400/50" />
          {editing ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' ? handleSave() : e.key === 'Escape' ? handleCancel() : null}
                autoFocus
                className="flex-1 bg-slate-900/60 border border-violet-500/30 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                placeholder="Custom label..."
              />
              <button onClick={handleSave} className="text-violet-400 hover:text-violet-300"><Check size={12} /></button>
              <button onClick={handleCancel} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
            </div>
          ) : (
            <>
              <span className="text-xs font-semibold text-slate-300 truncate" title={custom.mount}>
                {displayName}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400/70 border border-violet-500/10 shrink-0">
                custom
              </span>
              <button
                onClick={() => { setEditValue(label); setEditing(true) }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-400 transition-opacity"
                title="Rename"
              >
                <Pencil size={10} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span className="font-mono">{custom.mount}</span>
        <span className="text-slate-700">—</span>
        <span className="italic">Not mounted or no data from server</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DiskMonitor({ disks }: { disks: DiskInfo[] }) {
  const diskLabels = useSettingsStore((s) => s.diskLabels) ?? {}
  const customDisks = useSettingsStore((s) => s.customDisks) ?? []
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const handleLabelChange = useCallback((mount: string, label: string) => {
    const newLabels = { ...diskLabels }
    if (label) {
      newLabels[mount] = label
    } else {
      delete newLabels[mount]
    }
    updateSetting('diskLabels', newLabels)
  }, [diskLabels, updateSetting])

  // Find custom disks that aren't already in the server list
  const customMountsNotInServer = customDisks.filter(
    (c) => !disks.some((d) => d.mount === c.mount),
  )
  // Find custom disks that ARE in the server list (to mark them as custom)
  const customMountSet = new Set(customDisks.map((c) => c.mount))

  const totalMounts = disks.length + customMountsNotInServer.length

  // Count disks above 85% for the warning banner
  const allDiskPercents = disks.map((d) => parsePercent(d.percent))
  const disksAbove85 = allDiskPercents.filter((p) => p > 85).length

  if (totalMounts === 0) {
    return (
      <div className="glass-card p-4 md:p-6 animate-fade-in">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
          <HardDrive size={14} className="text-cyan-400" />
          Disk Usage
        </h3>
        <p className="text-sm text-slate-500 text-center py-6">No disk data available</p>
      </div>
    )
  }

  return (
    <div className="glass-card p-4 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <HardDrive size={14} className="text-cyan-400" />
          Disk Usage
        </h3>
        <div className="flex items-center gap-2">
          {customDisks.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-400/70 border border-violet-500/10">
              {customDisks.length} custom
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500 border border-white/5">
            {totalMounts} drive{totalMounts !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Warning banner for disks above 85% */}
      <DiskWarningBanner count={disksAbove85} />

      <div className="grid grid-cols-1 gap-2.5">
        {/* Server-detected disks (non-custom ones render normally) */}
        {disks.map((disk) => {
          const isCustom = customMountSet.has(disk.mount)
          if (isCustom) {
            const custom = customDisks.find((c) => c.mount === disk.mount)
            if (!custom) return null
            return (
              <CustomDiskRow
                key={disk.mount}
                custom={custom}
                serverDisk={disk}
                label={diskLabels[disk.mount] ?? ''}
                onLabelChange={handleLabelChange}
              />
            )
          }
          return (
            <DiskRow
              key={disk.mount}
              disk={disk}
              label={diskLabels[disk.mount] ?? ''}
              onLabelChange={handleLabelChange}
            />
          )
        })}

        {/* Custom disks not found on server */}
        {customMountsNotInServer.map((custom) => (
          <CustomDiskRow
            key={custom.mount}
            custom={custom}
            serverDisk={null}
            label={diskLabels[custom.mount] ?? ''}
            onLabelChange={handleLabelChange}
          />
        ))}
      </div>
    </div>
  )
}
