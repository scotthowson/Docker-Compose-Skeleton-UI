// =============================================================================
// VmSizeControl — the size of a VM the hub builds: four presets and a stepper
// each for cores, memory and disk. The steppers walk through sizes people pick
// (1, 2, 4, 8 … GB) and the number can be typed; nothing goes past what the
// Proxmox node has, or below the disk of the template a VM is cloned from.
// =============================================================================

import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

export interface VmSize { cores: number; memGb: number; diskGb: number }
export interface VmSizeLimits { maxCores?: number; maxMemGb?: number; minDiskGb?: number }

const PRESETS: { id: string; label: string; size: VmSize }[] = [
  { id: 's', label: 'Small', size: { cores: 1, memGb: 2, diskGb: 16 } },
  { id: 'm', label: 'Medium', size: { cores: 2, memGb: 4, diskGb: 32 } },
  { id: 'l', label: 'Large', size: { cores: 4, memGb: 8, diskGb: 64 } },
  { id: 'xl', label: 'X-Large', size: { cores: 8, memGb: 16, diskGb: 128 } },
]
const CORE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64]
const MEM_STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512]
const DISK_STEPS = [8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192, 256, 320, 384, 512, 768, 1024, 1536, 2048, 3072, 4096]

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)
const next = (steps: number[], v: number) => steps.find((s) => s > v) ?? v
const prev = (steps: number[], v: number) => [...steps].reverse().find((s) => s < v) ?? v

/** "2 CPU · 4 GB RAM · 32 GB disk" */
export function vmSizeSummary(v: VmSize): string {
  return `${v.cores} CPU · ${v.memGb} GB RAM · ${v.diskGb} GB disk`
}

function limitsOf(l: VmSizeLimits) {
  return { maxCores: l.maxCores && l.maxCores > 0 ? l.maxCores : 64, maxMemGb: l.maxMemGb && l.maxMemGb > 0 ? l.maxMemGb : 512, minDiskGb: Math.max(8, l.minDiskGb ?? 8) }
}

function Stepper({ label, unit, value, steps, min, max, disabled, onChange }: {
  label: string; unit: string; value: number; steps: number[]; min: number; max: number; disabled?: boolean; onChange: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])
  // the box's own text: a blur can come before the render that stores the last keystroke
  const commit = (raw: string) => {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n)) { const v = clamp(n, min, max); onChange(v); setText(String(v)) } else setText(String(value))
  }
  const down = () => onChange(clamp(prev(steps, value), min, max))
  const up = () => onChange(clamp(next(steps, value), min, max))
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <div className={`flex items-center h-9 rounded-lg bg-slate-800/60 border border-white/10 overflow-hidden focus-within:border-amber-500/40 ${disabled ? 'opacity-50' : ''}`}>
        <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={down} disabled={disabled || value <= min}
          className="w-8 h-full shrink-0 grid place-items-center text-slate-400 hover:text-slate-100 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent">
          <Minus size={13} />
        </button>
        <div className="flex-1 min-w-0 flex items-baseline justify-center gap-1">
          <input inputMode="numeric" aria-label={label} value={text} disabled={disabled}
            onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            onBlur={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); up() }
              else if (e.key === 'ArrowDown') { e.preventDefault(); down() }
            }}
            className="w-9 bg-transparent text-right text-sm font-semibold text-slate-100 tabular-nums focus:outline-none" />
          <span className="text-[11px] text-slate-500 truncate">{unit}</span>
        </div>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={up} disabled={disabled || value >= max}
          className="w-8 h-full shrink-0 grid place-items-center text-slate-400 hover:text-slate-100 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent">
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}

export function VmSizeControl({ value, onChange, limits = {}, disabled }: {
  value: VmSize; onChange: (v: VmSize) => void; limits?: VmSizeLimits; disabled?: boolean
}) {
  const { maxCores, maxMemGb, minDiskGb } = limitsOf(limits)
  const fits = (s: VmSize) => s.cores <= maxCores && s.memGb <= maxMemGb
  const active = PRESETS.find((p) => p.size.cores === value.cores && p.size.memGb === value.memGb && Math.max(p.size.diskGb, minDiskGb) === value.diskGb)?.id
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {PRESETS.map((p) => {
          const ok = fits(p.size)
          return (
            <button key={p.id} type="button" disabled={disabled || !ok}
              title={ok ? undefined : `More than the Proxmox node has (${maxCores} cores, ${maxMemGb} GB)`}
              onClick={() => onChange({ ...p.size, diskGb: Math.max(p.size.diskGb, minDiskGb) })}
              className={`px-2 py-1.5 rounded-lg border text-left transition-colors disabled:opacity-35 ${active === p.id ? 'bg-amber-500/15 border-amber-500/40 text-amber-100' : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'}`}>
              <span className="block text-xs font-semibold">{p.label}</span>
              <span className="block text-[10px] text-slate-500 tabular-nums">{p.size.cores} CPU · {p.size.memGb} GB · {Math.max(p.size.diskGb, minDiskGb)} GB</span>
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stepper label="CPU" unit={value.cores === 1 ? 'core' : 'cores'} value={value.cores} steps={CORE_STEPS} min={1} max={maxCores} disabled={disabled}
          onChange={(n) => onChange({ ...value, cores: n })} />
        <Stepper label="Memory" unit="GB" value={value.memGb} steps={MEM_STEPS} min={1} max={maxMemGb} disabled={disabled}
          onChange={(n) => onChange({ ...value, memGb: n })} />
        <Stepper label="Disk" unit="GB" value={value.diskGb} steps={DISK_STEPS} min={minDiskGb} max={4096} disabled={disabled}
          onChange={(n) => onChange({ ...value, diskGb: n })} />
      </div>
    </div>
  )
}
