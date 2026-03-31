// =============================================================================
// AppSettings — Polling intervals, appearance, and reset controls
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react'
import { Timer, Layout, RotateCcw } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import type { AppSettings as AppSettingsType } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Defaults (must match settingsStore defaults)
// ---------------------------------------------------------------------------

const DEFAULTS: Pick<
  AppSettingsType,
  'pollingInterval' | 'containerPollingInterval' | 'imagePollingInterval' | 'logPollingInterval' | 'sidebarCollapsed'
> = {
  pollingInterval: 10000,
  containerPollingInterval: 5000,
  imagePollingInterval: 60000,
  logPollingInterval: 3000,
  sidebarCollapsed: false,
}

// ---------------------------------------------------------------------------
// Interval input descriptor
// ---------------------------------------------------------------------------

interface IntervalField {
  key: keyof Pick<AppSettingsType, 'pollingInterval' | 'containerPollingInterval' | 'imagePollingInterval' | 'logPollingInterval'>
  label: string
  description: string
  min: number
  max: number
}

const intervalFields: IntervalField[] = [
  {
    key: 'pollingInterval',
    label: 'Dashboard Polling',
    description: 'How often the dashboard overview refreshes',
    min: 2,
    max: 120,
  },
  {
    key: 'containerPollingInterval',
    label: 'Container Polling',
    description: 'Refresh interval for container listings',
    min: 2,
    max: 120,
  },
  {
    key: 'imagePollingInterval',
    label: 'Image Polling',
    description: 'Refresh interval for image data',
    min: 10,
    max: 600,
  },
  {
    key: 'logPollingInterval',
    label: 'Log Polling',
    description: 'How often the log viewer fetches new entries',
    min: 1,
    max: 60,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AppSettingsForm({ onDirtyChange, onRegisterSave }: {
  onDirtyChange?: (dirty: boolean) => void
  onRegisterSave?: (save: () => void, discard: () => void) => void
} = {}) {
  const pollingInterval = useSettingsStore((s) => s.pollingInterval)
  const containerPollingInterval = useSettingsStore((s) => s.containerPollingInterval)
  const imagePollingInterval = useSettingsStore((s) => s.imagePollingInterval)
  const logPollingInterval = useSettingsStore((s) => s.logPollingInterval)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar)

  // Local state for interval inputs (display in seconds)
  const [localIntervals, setLocalIntervals] = useState<Record<string, number>>({
    pollingInterval: pollingInterval / 1000,
    containerPollingInterval: containerPollingInterval / 1000,
    imagePollingInterval: imagePollingInterval / 1000,
    logPollingInterval: logPollingInterval / 1000,
  })

  const [dirty, setDirty] = useState(false)

  // Sync from store when values change externally
  useEffect(() => {
    setLocalIntervals({
      pollingInterval: pollingInterval / 1000,
      containerPollingInterval: containerPollingInterval / 1000,
      imagePollingInterval: imagePollingInterval / 1000,
      logPollingInterval: logPollingInterval / 1000,
    })
  }, [pollingInterval, containerPollingInterval, imagePollingInterval, logPollingInterval])

  const handleIntervalChange = useCallback((key: string, value: number) => {
    setLocalIntervals((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }, [])

  const handleSave = useCallback(() => {
    for (const field of intervalFields) {
      const seconds = localIntervals[field.key] ?? DEFAULTS[field.key] / 1000
      const clamped = Math.max(field.min, Math.min(field.max, seconds))
      updateSetting(field.key, clamped * 1000)
    }
    setDirty(false)
  }, [localIntervals, updateSetting])

  const handleDiscard = useCallback(() => {
    setLocalIntervals({
      pollingInterval: pollingInterval / 1000,
      containerPollingInterval: containerPollingInterval / 1000,
      imagePollingInterval: imagePollingInterval / 1000,
      logPollingInterval: logPollingInterval / 1000,
    })
    setDirty(false)
  }, [pollingInterval, containerPollingInterval, imagePollingInterval, logPollingInterval])

  const handleReset = useCallback(() => {
    for (const field of intervalFields) {
      updateSetting(field.key, DEFAULTS[field.key])
    }
    if (sidebarCollapsed !== DEFAULTS.sidebarCollapsed) {
      toggleSidebar()
    }
    setLocalIntervals({
      pollingInterval: DEFAULTS.pollingInterval / 1000,
      containerPollingInterval: DEFAULTS.containerPollingInterval / 1000,
      imagePollingInterval: DEFAULTS.imagePollingInterval / 1000,
      logPollingInterval: DEFAULTS.logPollingInterval / 1000,
    })
    setDirty(false)
  }, [updateSetting, sidebarCollapsed, toggleSidebar])

  // Report dirty state to parent
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => { onRegisterSave?.(handleSave, handleDiscard) }, [handleSave, handleDiscard, onRegisterSave])

  return (
    <div className="space-y-6">
      {/* Polling intervals */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Timer size={16} className="text-cyan-400" />
          <h4 className="text-sm font-semibold text-slate-200">Polling Intervals</h4>
        </div>

        <div className="space-y-4">
          {intervalFields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-slate-300">{field.label}</label>
                  <p className="text-xs text-slate-500">{field.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={localIntervals[field.key] ?? field.min}
                    onChange={(e) => handleIntervalChange(field.key, Number(e.target.value))}
                    className="
                      w-20 rounded-lg px-3 py-1.5 text-right
                      text-sm text-slate-200 font-mono
                      bg-slate-900/60 border border-white/10
                      focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20
                      transition-all duration-200
                    "
                  />
                  <span className="text-xs text-slate-500 w-5">sec</span>
                </div>
              </div>
              {/* Range slider */}
              <input
                type="range"
                min={field.min}
                max={field.max}
                value={localIntervals[field.key] ?? field.min}
                onChange={(e) => handleIntervalChange(field.key, Number(e.target.value))}
                className="
                  w-full h-1.5 rounded-full appearance-none cursor-pointer
                  bg-slate-800
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:w-3.5
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-emerald-400
                  [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(52,211,153,0.4)]
                  [&::-webkit-slider-thumb]:cursor-pointer
                "
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{field.min}s</span>
                <span>{field.max}s</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Appearance */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Layout size={16} className="text-amber-400" />
          <h4 className="text-sm font-semibold text-slate-200">Appearance</h4>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-slate-300">Sidebar Collapsed</p>
            <p className="text-xs text-slate-500">Start with a compact sidebar</p>
          </div>
          <button
            onClick={toggleSidebar}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full
              transition-colors duration-200 focus:outline-none
              ${sidebarCollapsed ? 'bg-emerald-500' : 'bg-slate-700'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white shadow-sm
                transition-transform duration-200
                ${sidebarCollapsed ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      </div>

      {/* Reset to defaults */}
      <div className="flex items-center pt-2 border-t border-white/5">
        <button
          onClick={handleReset}
          className="
            flex items-center gap-2 rounded-lg px-4 py-2
            text-sm font-medium
            text-slate-400 bg-white/5 border border-white/10
            hover:bg-white/10 hover:text-slate-300
            transition-all duration-200
          "
        >
          <RotateCcw size={14} />
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
