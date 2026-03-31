// =============================================================================
// Config — Premium server configuration with toggles, dropdowns, NTFY, and more
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react'
import {
  Settings2,
  Globe,
  FolderOpen,
  ToggleRight,
  Radio,
  Bell,
  RefreshCw,
  Save,
  Undo2,
  Check,
  AlertCircle,
  AlertTriangle,
  Palette,
  Shield,
  Zap,
  Server,
  ChevronDown,
  ScrollText,
} from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import { fetchConfig, updateConfig } from '../api/endpoints'
import { useConfigStore } from '../stores/configStore'
import { useConnectionStore } from '../stores/connectionStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import type { ServerConfig } from '../../shared/types'

// ---------------------------------------------------------------------------
// Toggle Button
// ---------------------------------------------------------------------------

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${value ? 'bg-emerald-500' : 'bg-slate-700'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200
          ${value ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Editable Row Components
// ---------------------------------------------------------------------------

function ToggleRow({
  label,
  description,
  configKey,
  value,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  configKey: string
  value: boolean
  onChange: (key: string, val: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.03] last:border-b-0">
      <div className="flex-1 min-w-0 mr-4">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <Toggle value={value} onChange={(v) => onChange(configKey, v)} disabled={disabled} />
    </div>
  )
}

function SelectRow({
  label,
  description,
  configKey,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  configKey: string
  value: string
  options: string[]
  onChange: (key: string, val: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.03] last:border-b-0">
      <div className="flex-1 min-w-0 mr-4">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(configKey, e.target.value)}
        disabled={disabled}
        className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

function TextRow({
  label,
  description,
  configKey,
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
}: {
  label: string
  description?: string
  configKey: string
  value: string
  onChange: (key: string, val: string) => void
  disabled?: boolean
  readOnly?: boolean
  placeholder?: string
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.03] last:border-b-0">
      <div className="flex-1 min-w-0 mr-4">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {readOnly ? (
        <span className="text-sm text-slate-400 font-mono truncate max-w-[180px] md:max-w-[260px]" title={value}>{value}</span>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(configKey, e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-slate-200 font-mono w-40 md:w-48 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50 placeholder-slate-600"
        />
      )}
    </div>
  )
}

function NumberRow({
  label,
  description,
  configKey,
  value,
  onChange,
  disabled,
  min,
  max,
}: {
  label: string
  description?: string
  configKey: string
  value: number
  onChange: (key: string, val: number) => void
  disabled?: boolean
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.03] last:border-b-0">
      <div className="flex-1 min-w-0 mr-4">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(configKey, parseInt(e.target.value, 10))}
        disabled={disabled}
        min={min}
        max={max}
        className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-slate-200 font-mono w-28 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group Card
// ---------------------------------------------------------------------------

interface GroupCardProps {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
  accentColor?: 'emerald' | 'cyan' | 'amber' | 'rose' | 'violet'
  storageKey?: string
}

function GroupCard({ icon, title, description, children, storageKey }: GroupCardProps) {
  const key = storageKey || `cfg-card-${title.toLowerCase().replace(/\s+/g, '-')}`
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(key) === 'true' } catch { return false }
  })
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(key, String(next)) } catch {}
  }

  return (
    <div className="glass rounded-xl border border-white/5 overflow-hidden">
      <div
        className="px-5 py-4 border-b border-white/5 cursor-pointer select-none hover:bg-white/[0.03] transition-colors"
        onClick={toggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {icon}
            <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-500 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        </div>
        {description && !collapsed && (
          <p className="text-xs text-slate-500 mt-1 ml-[26px]">{description}</p>
        )}
      </div>
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${collapsed ? 'max-h-0' : 'max-h-[2000px]'}`}>
        <div className="px-5 py-2">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type EditableConfig = Record<string, string | boolean | number>

export default function Config() {
  const setStoreConfig = useConfigStore((s) => s.setConfig)
  const isConnected = useConnectionStore((s) => s.status) === 'connected'
  const connServerUrl = useConnectionStore((s) => s.serverUrl)

  const { data, loading, error, refresh } = usePolling<ServerConfig>(fetchConfig, 60000, {
    enabled: isConnected,
  })

  useEffect(() => {
    if (data) setStoreConfig(data)
  }, [data, setStoreConfig])

  // Local editable copy
  const [edits, setEdits] = useState<EditableConfig>({})
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)
  const [userIsEditing, setUserIsEditing] = useState(false)

  // Build edits from server data
  const buildEditsFromData = useCallback((d: ServerConfig): EditableConfig => ({
    ENVIRONMENT: d.environment,
    LOG_LEVEL: d.log_level,
    TZ: d.timezone,
    SERVER_NAME: d.server_name,
    SKIP_HEALTHCHECK_WAIT: d.skip_healthcheck_wait,
    CONTINUE_ON_FAILURE: d.continue_on_failure,
    REMOVE_VOLUMES_ON_STOP: d.remove_volumes_on_stop,
    AGGRESSIVE_IMAGE_PRUNE: d.aggressive_image_prune,
    UPDATE_NOTIFICATION: d.update_notification,
    SHOW_BANNERS: d.show_banners,
    API_PORT: d.api_port,
    API_BIND: d.api_bind,
    API_ENABLED: d.api_enabled ?? true,
    NTFY_URL: d.ntfy_url ?? '',
    NTFY_TOPIC: d.ntfy_topic ?? '',
    NTFY_PRIORITY: d.ntfy_priority ?? 'default',
    ENABLE_COLORS: d.enable_colors ?? true,
    COLOR_MODE: d.color_mode ?? 'auto',
    COLOR_THEME: d.color_theme ?? 'dark',
    FORCE_COLOR: d.force_color ?? false,
    VERBOSE_MODE: d.verbose_mode ?? false,
    SHOW_SYSTEM_INFO: d.show_system_info ?? true,
    PROGRESS_BAR_WIDTH: d.progress_bar_width ?? 50,
    ENABLE_LOG_DATE: d.enable_log_date ?? true,
    ENABLE_MILLISECONDS: d.enable_milliseconds ?? false,
    LOG_DATE_FORMAT: d.log_date_format ?? '%Y-%m-%d %H:%M:%S',
    ENABLE_LOG_MOOD: d.enable_log_mood ?? true,
    ENABLE_LOG_PID: d.enable_log_pid ?? false,
    ENABLE_LOG_HOSTNAME: d.enable_log_hostname ?? false,
  }), [])

  // Sync from server ONLY when user hasn't started editing
  useEffect(() => {
    if (data && !userIsEditing) {
      setEdits(buildEditsFromData(data))
    }
  }, [data, userIsEditing, buildEditsFromData])

  const handleChange = useCallback((key: string, val: string | boolean | number) => {
    setEdits((prev) => ({ ...prev, [key]: val }))
    setSaveResult(null)
    setUserIsEditing(true)
  }, [])

  const handleBoolChange = useCallback((key: string, val: boolean) => {
    handleChange(key, val)
  }, [handleChange])

  const handleStringChange = useCallback((key: string, val: string) => {
    handleChange(key, val)
  }, [handleChange])

  const handleNumberChange = useCallback((key: string, val: number) => {
    handleChange(key, val)
  }, [handleChange])

  // Check if anything changed from the original
  const hasChanges = data ? Object.keys(edits).some((key) => {
    const original = getOriginalValue(data, key)
    return edits[key] !== original
  }) : false

  const handleSave = async () => {
    if (!data || !hasChanges) return
    setSaving(true)
    setSaveResult(null)

    // Build diff — only send changed values
    const diff: Record<string, string | boolean | number> = {}
    for (const key of Object.keys(edits)) {
      const original = getOriginalValue(data, key)
      if (edits[key] !== original) {
        diff[key] = edits[key]
      }
    }

    try {
      const result = await updateConfig(diff)
      setSaveResult({ success: result.success, message: result.message })
      // Refresh to get updated values — clear editing flag so poll can sync
      setUserIsEditing(false)
      setTimeout(refresh, 500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setSaveResult({ success: false, message: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setUserIsEditing(false)
    if (data) {
      setEdits({
        ENVIRONMENT: data.environment,
        LOG_LEVEL: data.log_level,
        TZ: data.timezone,
        SERVER_NAME: data.server_name,
        SKIP_HEALTHCHECK_WAIT: data.skip_healthcheck_wait,
        CONTINUE_ON_FAILURE: data.continue_on_failure,
        REMOVE_VOLUMES_ON_STOP: data.remove_volumes_on_stop,
        AGGRESSIVE_IMAGE_PRUNE: data.aggressive_image_prune,
        UPDATE_NOTIFICATION: data.update_notification,
        SHOW_BANNERS: data.show_banners,
        API_PORT: data.api_port,
        API_BIND: data.api_bind,
        API_ENABLED: data.api_enabled ?? true,
        NTFY_URL: data.ntfy_url ?? '',
        NTFY_TOPIC: data.ntfy_topic ?? '',
        NTFY_PRIORITY: data.ntfy_priority ?? 'default',
        ENABLE_COLORS: data.enable_colors ?? true,
        COLOR_MODE: data.color_mode ?? 'auto',
        COLOR_THEME: data.color_theme ?? 'dark',
        FORCE_COLOR: data.force_color ?? false,
        VERBOSE_MODE: data.verbose_mode ?? false,
        SHOW_SYSTEM_INFO: data.show_system_info ?? true,
        PROGRESS_BAR_WIDTH: data.progress_bar_width ?? 50,
        ENABLE_LOG_DATE: data.enable_log_date ?? true,
        ENABLE_MILLISECONDS: data.enable_milliseconds ?? false,
        LOG_DATE_FORMAT: data.log_date_format ?? '%Y-%m-%d %H:%M:%S',
        ENABLE_LOG_MOOD: data.enable_log_mood ?? true,
        ENABLE_LOG_PID: data.enable_log_pid ?? false,
        ENABLE_LOG_HOSTNAME: data.enable_log_hostname ?? false,
      })
      setSaveResult(null)
    }
  }

  const cfg = data

  return (
    <div className="space-y-3 md:space-y-6">
      <DisconnectedBanner />
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/5">
            <Settings2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold"><span className="text-gradient">Server Configuration</span></h1>
            <p className="text-sm text-slate-400 mt-0.5">Environment variables, feature flags, and server settings</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="
                flex items-center gap-2 rounded-lg px-3.5 py-2
                text-sm font-medium text-slate-400
                bg-white/5 border border-white/10
                hover:bg-white/10 hover:text-slate-200
                transition-all duration-200
              "
            >
              <Undo2 size={15} />
              Reset
            </button>
          )}
          <button
            onClick={hasChanges ? handleSave : refresh}
            disabled={saving || (loading && !cfg)}
            className={`
              flex items-center gap-2 rounded-lg px-3.5 py-2
              text-sm font-medium transition-all duration-200
              ${hasChanges
                ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/15'
              }
              disabled:opacity-50
            `}
          >
            {saving ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : hasChanges ? (
              <Save size={15} />
            ) : (
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            )}
            {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Save result banner */}
      {saveResult && (
        <div className={`
          flex items-center gap-3 rounded-xl p-4 animate-fade-in
          ${saveResult.success
            ? 'bg-emerald-500/10 border border-emerald-500/20'
            : 'bg-rose-500/10 border border-rose-500/20'
          }
        `}>
          {saveResult.success ? (
            <Check size={18} className="text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-rose-400 flex-shrink-0" />
          )}
          <p className={`text-sm ${saveResult.success ? 'text-emerald-300' : 'text-rose-300'}`}>
            {saveResult.message}
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="glass rounded-xl p-4 border border-rose-500/20">
          <p className="text-sm text-rose-400">Failed to fetch config: {error.message}</p>
        </div>
      )}

      {/* Loading placeholder */}
      {loading && !cfg && (
        <div className="glass rounded-xl border border-white/5 p-8 text-center">
          <RefreshCw size={20} className="inline animate-spin text-slate-500 mr-2" />
          <span className="text-sm text-slate-500">Loading configuration...</span>
        </div>
      )}

      {cfg && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Environment */}
          <GroupCard
            icon={<Globe size={16} className="text-emerald-400" />}
            title="Environment"
            description="Runtime environment and server identity"
            accentColor="emerald"
          >
            <SelectRow
              label="Environment"
              description="Runtime environment profile"
              configKey="ENVIRONMENT"
              value={String(edits.ENVIRONMENT ?? cfg.environment)}
              options={['production', 'staging', 'testing', 'development']}
              onChange={handleStringChange}
            />
            <SelectRow
              label="Log Level"
              description="Logging verbosity"
              configKey="LOG_LEVEL"
              value={String(edits.LOG_LEVEL ?? cfg.log_level)}
              options={['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']}
              onChange={handleStringChange}
            />
            <TextRow
              label="Server Name"
              description="Display name for this server"
              configKey="SERVER_NAME"
              value={String(edits.SERVER_NAME ?? cfg.server_name)}
              onChange={handleStringChange}
              placeholder="Docker Server"
            />
            <TextRow
              label="Timezone"
              description="Server timezone (e.g. America/New_York)"
              configKey="TZ"
              value={String(edits.TZ ?? cfg.timezone)}
              onChange={handleStringChange}
              placeholder="UTC"
            />
          </GroupCard>

          {/* Paths (read-only) */}
          <GroupCard
            icon={<FolderOpen size={16} className="text-cyan-400" />}
            title="Paths"
            description="Server directory paths (read-only)"
            accentColor="cyan"
          >
            <TextRow label="Compose Dir" configKey="" value={cfg.compose_dir} onChange={() => {}} readOnly />
            <TextRow label="App Data Dir" configKey="" value={cfg.app_data_dir} onChange={() => {}} readOnly />
            <TextRow label="Base Dir" configKey="" value={cfg.base_dir} onChange={() => {}} readOnly />
            <TextRow label="Compose Command" configKey="" value={cfg.compose_command} onChange={() => {}} readOnly />
          </GroupCard>

          {/* Feature Flags */}
          <GroupCard
            icon={<Zap size={16} className="text-amber-400" />}
            title="Feature Flags"
            description="Toggle framework features on or off"
            accentColor="amber"
          >
            <ToggleRow
              label="Show Banners"
              description="Display ASCII art banners during startup and shutdown"
              configKey="SHOW_BANNERS"
              value={Boolean(edits.SHOW_BANNERS ?? cfg.show_banners)}
              onChange={handleBoolChange}
            />
            <ToggleRow
              label="Skip Healthcheck Wait"
              description="Don't wait for containers to pass health checks during startup"
              configKey="SKIP_HEALTHCHECK_WAIT"
              value={Boolean(edits.SKIP_HEALTHCHECK_WAIT ?? cfg.skip_healthcheck_wait)}
              onChange={handleBoolChange}
            />
            <ToggleRow
              label="Continue on Failure"
              description="Continue stack operations even if one stack fails"
              configKey="CONTINUE_ON_FAILURE"
              value={Boolean(edits.CONTINUE_ON_FAILURE ?? cfg.continue_on_failure)}
              onChange={handleBoolChange}
            />
            <ToggleRow
              label="Remove Volumes on Stop"
              description="Delete anonymous volumes when stopping stacks"
              configKey="REMOVE_VOLUMES_ON_STOP"
              value={Boolean(edits.REMOVE_VOLUMES_ON_STOP ?? cfg.remove_volumes_on_stop)}
              onChange={handleBoolChange}
            />
            <ToggleRow
              label="Aggressive Image Prune"
              description="Prune all unused images, not just dangling ones"
              configKey="AGGRESSIVE_IMAGE_PRUNE"
              value={Boolean(edits.AGGRESSIVE_IMAGE_PRUNE ?? cfg.aggressive_image_prune)}
              onChange={handleBoolChange}
            />
            <ToggleRow
              label="Update Notifications"
              description="Send NTFY notifications when stack images are updated"
              configKey="UPDATE_NOTIFICATION"
              value={Boolean(edits.UPDATE_NOTIFICATION ?? cfg.update_notification)}
              onChange={handleBoolChange}
            />
          </GroupCard>

          {/* Display & Colors */}
          <GroupCard
            icon={<Palette size={16} className="text-violet-400" />}
            title="Display & Colors"
            description="Terminal output appearance settings"
            accentColor="violet"
          >
            <ToggleRow
              label="Enable Colors"
              description="Enable colored terminal output for logs and banners"
              configKey="ENABLE_COLORS"
              value={Boolean(edits.ENABLE_COLORS ?? cfg.enable_colors ?? true)}
              onChange={handleBoolChange}
            />
            <SelectRow
              label="Color Mode"
              description="When to use color output"
              configKey="COLOR_MODE"
              value={String(edits.COLOR_MODE ?? cfg.color_mode ?? 'auto')}
              options={['auto', 'always', 'never']}
              onChange={handleStringChange}
            />
            <SelectRow
              label="Color Theme"
              description="Terminal color theme preset"
              configKey="COLOR_THEME"
              value={String(edits.COLOR_THEME ?? cfg.color_theme ?? 'dark')}
              options={['dark', 'light', 'high-contrast', 'minimal']}
              onChange={handleStringChange}
            />
            <ToggleRow
              label="Force Color"
              description="Force color output regardless of terminal type detection"
              configKey="FORCE_COLOR"
              value={Boolean(edits.FORCE_COLOR ?? cfg.force_color ?? false)}
              onChange={handleBoolChange}
            />
            <ToggleRow
              label="Verbose Mode"
              description="Show additional detail in command output"
              configKey="VERBOSE_MODE"
              value={Boolean(edits.VERBOSE_MODE ?? cfg.verbose_mode ?? false)}
              onChange={handleBoolChange}
            />
            <ToggleRow
              label="Show System Info"
              description="Display system information during startup"
              configKey="SHOW_SYSTEM_INFO"
              value={Boolean(edits.SHOW_SYSTEM_INFO ?? cfg.show_system_info ?? true)}
              onChange={handleBoolChange}
            />
            <NumberRow
              label="Progress Bar Width"
              description="Character width of progress bars in terminal output"
              configKey="PROGRESS_BAR_WIDTH"
              value={Number(edits.PROGRESS_BAR_WIDTH ?? cfg.progress_bar_width ?? 50)}
              onChange={handleNumberChange}
              min={20}
              max={120}
            />
          </GroupCard>

          {/* Log Formatting */}
          <GroupCard
            icon={<ScrollText size={16} className="text-cyan-400" />}
            title="Log Formatting"
            description="Customize log output format and metadata"
            accentColor="cyan"
          >
            <ToggleRow
              label="Log Timestamps"
              description="Include date/time in log entries"
              configKey="ENABLE_LOG_DATE"
              value={Boolean(edits.ENABLE_LOG_DATE ?? cfg.enable_log_date ?? true)}
              onChange={handleBoolChange}
            />
            <ToggleRow
              label="Milliseconds"
              description="Include millisecond precision in timestamps"
              configKey="ENABLE_MILLISECONDS"
              value={Boolean(edits.ENABLE_MILLISECONDS ?? cfg.enable_milliseconds ?? false)}
              onChange={handleBoolChange}
            />
            <TextRow
              label="Date Format"
              description="strftime format pattern for timestamps"
              configKey="LOG_DATE_FORMAT"
              value={String(edits.LOG_DATE_FORMAT ?? cfg.log_date_format ?? '%Y-%m-%d %H:%M:%S')}
              onChange={handleStringChange}
              placeholder="%Y-%m-%d %H:%M:%S"
            />
            <ToggleRow
              label="Log Level Indicators"
              description="Show colored log level labels (INFO, WARN, ERROR)"
              configKey="ENABLE_LOG_MOOD"
              value={Boolean(edits.ENABLE_LOG_MOOD ?? cfg.enable_log_mood ?? true)}
              onChange={handleBoolChange}
            />
            <ToggleRow
              label="Process ID"
              description="Include process ID (PID) in log entries"
              configKey="ENABLE_LOG_PID"
              value={Boolean(edits.ENABLE_LOG_PID ?? cfg.enable_log_pid ?? false)}
              onChange={handleBoolChange}
            />
            <ToggleRow
              label="Hostname"
              description="Include server hostname in log entries"
              configKey="ENABLE_LOG_HOSTNAME"
              value={Boolean(edits.ENABLE_LOG_HOSTNAME ?? cfg.enable_log_hostname ?? false)}
              onChange={handleBoolChange}
            />
          </GroupCard>

          {/* API Server */}
          <GroupCard
            icon={<Server size={16} className="text-emerald-400" />}
            title="API Server"
            description="REST API server settings"
            accentColor="emerald"
          >
            {/* Auto-detect: API is running since you're viewing this page */}
            {isConnected && (
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-emerald-400 font-medium">Connected</span>
                  <span className="text-[10px] text-slate-400 font-mono ml-1">{(connServerUrl || '').replace(/^https?:\/\//, '')}</span>
                </div>
                {!cfg.api_enabled && (
                  <span className="text-[10px] text-amber-400 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    Running manually
                  </span>
                )}
              </div>
            )}
            <ToggleRow
              label="API Enabled"
              description={isConnected && !cfg.api_enabled ? 'API is running manually — enable this to auto-start with ./start.sh' : 'Enable or disable the REST API server on startup'}
              configKey="API_ENABLED"
              value={Boolean(edits.API_ENABLED ?? cfg.api_enabled ?? true)}
              onChange={handleBoolChange}
            />
            <NumberRow
              label="Port"
              description="API server listen port"
              configKey="API_PORT"
              value={Number(edits.API_PORT ?? cfg.api_port)}
              onChange={handleNumberChange}
              min={1024}
              max={65535}
            />
            <TextRow
              label="Bind Address"
              description="Network interface to bind to (0.0.0.0 for all)"
              configKey="API_BIND"
              value={String(edits.API_BIND ?? cfg.api_bind)}
              onChange={handleStringChange}
              placeholder="0.0.0.0"
            />
          </GroupCard>

          {/* Push Notifications (NTFY) */}
          <GroupCard
            icon={<Bell size={16} className="text-amber-400" />}
            title="Push Notifications (NTFY)"
            description="Configure NTFY push notification service"
            accentColor="amber"
          >
            <div className="flex items-center gap-2 py-3 border-b border-white/[0.03]">
              <span className="text-sm font-medium text-slate-200">Status</span>
              <span className="ml-auto">
                {cfg.ntfy_configured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Not Configured
                  </span>
                )}
              </span>
            </div>
            <TextRow
              label="NTFY Server URL"
              description="URL of your NTFY server (e.g., https://ntfy.sh)"
              configKey="NTFY_URL"
              value={String(edits.NTFY_URL ?? cfg.ntfy_url ?? '')}
              onChange={handleStringChange}
              placeholder="https://ntfy.sh"
            />
            <TextRow
              label="Topic"
              description="NTFY topic name to publish notifications to"
              configKey="NTFY_TOPIC"
              value={String(edits.NTFY_TOPIC ?? cfg.ntfy_topic ?? '')}
              onChange={handleStringChange}
              placeholder="docker-updates"
            />
            <SelectRow
              label="Priority"
              description="Default notification priority level"
              configKey="NTFY_PRIORITY"
              value={String(edits.NTFY_PRIORITY ?? cfg.ntfy_priority ?? 'default')}
              options={['min', 'low', 'default', 'high', 'urgent']}
              onChange={handleStringChange}
            />
          </GroupCard>

          {/* Security */}
          <GroupCard
            icon={<Shield size={16} className="text-rose-400" />}
            title="Security"
            description="Access control and safety settings"
            accentColor="rose"
          >
            <div className="py-3 border-b border-white/[0.03]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-200">Config Protection</span>
                  <p className="text-xs text-slate-500 mt-0.5">Configuration changes are backed up before being applied</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-400">
                  <Check size={10} />
                  Active
                </span>
              </div>
            </div>
            <div className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-200">API Whitelist</span>
                  <p className="text-xs text-slate-500 mt-0.5">Only whitelisted configuration keys can be modified via API</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-400">
                  <Check size={10} />
                  Active
                </span>
              </div>
            </div>
          </GroupCard>
        </div>
      )}

      {/* Unsaved changes indicator — sticky to viewport bottom */}
      {hasChanges && (
        <div className="fixed bottom-6 inset-x-0 z-[100] flex justify-center pointer-events-none animate-fade-in-up">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800/95 backdrop-blur-lg border border-white/10 px-5 py-3 shadow-2xl shadow-black/40 pointer-events-auto">
            <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-slate-300">You have unsaved changes</span>
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Map config key to original data value
function getOriginalValue(data: ServerConfig, key: string): string | boolean | number {
  const map: Record<string, string | boolean | number> = {
    ENVIRONMENT: data.environment,
    LOG_LEVEL: data.log_level,
    TZ: data.timezone,
    SERVER_NAME: data.server_name,
    SKIP_HEALTHCHECK_WAIT: data.skip_healthcheck_wait,
    CONTINUE_ON_FAILURE: data.continue_on_failure,
    REMOVE_VOLUMES_ON_STOP: data.remove_volumes_on_stop,
    AGGRESSIVE_IMAGE_PRUNE: data.aggressive_image_prune,
    UPDATE_NOTIFICATION: data.update_notification,
    SHOW_BANNERS: data.show_banners,
    API_PORT: data.api_port,
    API_BIND: data.api_bind,
    API_ENABLED: data.api_enabled ?? true,
    NTFY_URL: data.ntfy_url ?? '',
    NTFY_TOPIC: data.ntfy_topic ?? '',
    NTFY_PRIORITY: data.ntfy_priority ?? 'default',
    ENABLE_COLORS: data.enable_colors ?? true,
    COLOR_MODE: data.color_mode ?? 'auto',
    COLOR_THEME: data.color_theme ?? 'dark',
    FORCE_COLOR: data.force_color ?? false,
    VERBOSE_MODE: data.verbose_mode ?? false,
    SHOW_SYSTEM_INFO: data.show_system_info ?? true,
    PROGRESS_BAR_WIDTH: data.progress_bar_width ?? 50,
    ENABLE_LOG_DATE: data.enable_log_date ?? true,
    ENABLE_MILLISECONDS: data.enable_milliseconds ?? false,
    LOG_DATE_FORMAT: data.log_date_format ?? '%Y-%m-%d %H:%M:%S',
    ENABLE_LOG_MOOD: data.enable_log_mood ?? true,
    ENABLE_LOG_PID: data.enable_log_pid ?? false,
    ENABLE_LOG_HOSTNAME: data.enable_log_hostname ?? false,
  }
  return map[key] ?? ''
}
