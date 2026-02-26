// =============================================================================
// SetupWizard — 5-step first-run configuration wizard
// Full-screen page (renders outside Sidebar/Header, like Login.tsx)
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Server, CheckCircle2, User, Lock, Shield, Eye, EyeOff,
  Settings, Globe, Clock, FolderOpen, Layers, ChevronUp, ChevronDown,
  Trash2, Plus, Pencil, Sparkles, Loader2, ArrowRight, ArrowLeft,
  Check, AlertCircle, Wifi, WifiOff, Link,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useConnectionStore } from '../stores/connectionStore'
import {
  fetchSetupDefaults, setupConfigure, setupComplete,
  authSetup,
} from '../api/endpoints'
import { apiClient, ApiNetworkError } from '../api/client'
import type { SetupDefaultsResponse } from '../../shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WizardProps {
  onComplete: () => void
}

interface StackEntry {
  name: string
  isDefault: boolean
  isNew: boolean
  editing: boolean
}

type Step = 1 | 2 | 3 | 4 | 5

// ---------------------------------------------------------------------------
// Common timezones for the searchable dropdown
// ---------------------------------------------------------------------------

const COMMON_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Toronto', 'America/Vancouver',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Mexico_City',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
  'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Moscow', 'Europe/Istanbul',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore',
  'Asia/Seoul', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Bangkok',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Pacific/Auckland', 'Pacific/Honolulu', 'Africa/Cairo',
  'Africa/Johannesburg', 'Africa/Lagos',
]

// ---------------------------------------------------------------------------
// Password strength calculator
// ---------------------------------------------------------------------------

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' }
  if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' }
  if (score <= 3) return { score: 3, label: 'Good', color: 'bg-yellow-500' }
  if (score <= 4) return { score: 4, label: 'Strong', color: 'bg-emerald-500' }
  return { score: 5, label: 'Excellent', color: 'bg-emerald-400' }
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: Step; total: number }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1)
  const labels = ['Connect', 'Admin', 'Server', 'Stacks', 'Review']

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => {
        const isActive = s === current
        const isComplete = s < current
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`
                flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold
                transition-all duration-300
                ${isComplete
                  ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/30'
                  : isActive
                    ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40'
                    : 'bg-slate-800/60 text-slate-600 ring-1 ring-white/[0.06]'
                }
              `}>
                {isComplete ? <Check size={14} /> : s}
              </div>
              <span className={`
                text-[10px] mt-1.5 font-medium transition-colors duration-300
                ${isActive ? 'text-emerald-400' : isComplete ? 'text-slate-400' : 'text-slate-600'}
              `}>
                {labels[i]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`
                w-10 md:w-16 h-px mx-1 mb-5 transition-colors duration-300
                ${s < current ? 'bg-emerald-500/50' : 'bg-white/[0.06]'}
              `} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SetupWizard
// ---------------------------------------------------------------------------

export default function SetupWizard({ onComplete }: WizardProps) {
  // Wizard state
  const [step, setStep] = useState<Step>(1)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminConfirm, setAdminConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [apiToken, setLocalApiToken] = useState<string | null>(null)

  // Server connection
  const [serverUrlInput, setServerUrlInput] = useState(apiClient.getBaseUrl() || 'http://')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Server config
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [stacks, setStacks] = useState<StackEntry[]>([])

  // Defaults from server
  const [defaults, setDefaults] = useState<SetupDefaultsResponse | null>(null)

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [complete, setComplete] = useState(false)

  // New stack input
  const [newStackName, setNewStackName] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  // Timezone filter
  const [tzFilter, setTzFilter] = useState('')
  const [tzDropdownOpen, setTzDropdownOpen] = useState(false)

  // Server URL from settings
  const { setServerUrl } = useConnectionStore()
  const { register, setApiToken: setStoreApiToken } = useAuthStore()

  // Connect to server and fetch defaults
  const handleConnect = async () => {
    setError(null)
    setConnecting(true)
    setConnected(false)
    setDefaults(null)

    // Normalize the URL
    let url = serverUrlInput.trim()
    if (!url) {
      setError('Please enter a server URL')
      setConnecting(false)
      return
    }
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`
    }
    // Add default port if none specified
    try {
      const parsed = new URL(url)
      if (!parsed.port && !url.includes(':9876')) {
        url = `${parsed.protocol}//${parsed.hostname}:9876`
      }
    } catch {
      setError('Invalid URL format')
      setConnecting(false)
      return
    }

    // Apply the URL
    apiClient.setBaseUrl(url)
    setServerUrl(url)
    useSettingsStore.getState().updateSetting('serverUrl', url)
    setServerUrlInput(url)

    // Test connection by fetching defaults
    try {
      const data = await fetchSetupDefaults()
      setDefaults(data)

      // Pre-populate env vars from defaults
      setEnvVars({
        SERVER_NAME: data.defaults.SERVER_NAME || 'Docker Server',
        TZ: data.system.timezone || data.defaults.TZ || 'UTC',
        PROXY_DOMAIN: data.defaults.PROXY_DOMAIN || 'example.com',
        APP_DATA_DIR: data.defaults.APP_DATA_DIR || './App-Data',
        PUID: String(data.system.puid || data.defaults.PUID || '1000'),
        PGID: String(data.system.pgid || data.defaults.PGID || '1000'),
      })

      // Pre-populate stacks
      setStacks(data.stacks.map((name) => ({
        name,
        isDefault: true,
        isNew: false,
        editing: false,
      })))

      setConnected(true)
    } catch (err) {
      if (err instanceof ApiNetworkError) {
        setError(`Cannot reach server at ${url} — is the API running?`)
      } else {
        setError(err instanceof Error ? err.message : 'Connection failed')
      }
    } finally {
      setConnecting(false)
    }
  }

  // Validation helpers
  const isStep2Valid = useCallback(() => {
    if (!adminUsername.trim() || adminUsername.length < 3) return false
    if (adminPassword.length < 8) return false
    if (!/[A-Z]/.test(adminPassword)) return false
    if (!/[0-9]/.test(adminPassword)) return false
    if (adminPassword !== adminConfirm) return false
    return true
  }, [adminUsername, adminPassword, adminConfirm])

  const isStep3Valid = useCallback(() => {
    return !!(envVars.SERVER_NAME?.trim() && envVars.TZ?.trim())
  }, [envVars])

  const isStep4Valid = useCallback(() => {
    return stacks.length >= 1 && stacks.every((s) => /^[a-z0-9][a-z0-9_-]*$/.test(s.name))
  }, [stacks])

  // Navigation
  const canNext = useCallback(() => {
    switch (step) {
      case 1: return connected && defaults !== null
      case 2: return isStep2Valid()
      case 3: return isStep3Valid()
      case 4: return isStep4Valid()
      case 5: return true
      default: return false
    }
  }, [step, connected, defaults, isStep2Valid, isStep3Valid, isStep4Valid])

  const handleNext = async () => {
    setError(null)

    // Step 2: Create admin account on the server
    if (step === 2) {
      setLoading(true)
      try {
        const res = await authSetup(adminUsername.trim(), adminPassword)
        if (res.success && res.token) {
          setLocalApiToken(res.token)
          apiClient.setAuthToken(res.token)
          setStoreApiToken(res.token)

          // Also register locally so the app has a local account
          await register(adminUsername.trim(), adminPassword)
        } else {
          setError('Failed to create admin account')
          setLoading(false)
          return
        }
      } catch (err) {
        if (err instanceof ApiNetworkError) {
          setError('Cannot reach the server. Check the connection.')
        } else {
          setError(err instanceof Error ? err.message : 'Failed to create admin account')
        }
        setLoading(false)
        return
      }
      setLoading(false)
    }

    if (step < 5) {
      setStep((step + 1) as Step)
    }
  }

  const handleBack = () => {
    setError(null)
    if (step > 1) {
      setStep((step - 1) as Step)
    }
  }

  const handleComplete = async () => {
    setError(null)
    setCompleting(true)

    try {
      // 1. Apply configuration
      await setupConfigure({
        env_vars: envVars,
        stacks: stacks.map((s) => s.name),
      })

      // 2. Mark setup as complete
      await setupComplete()

      // 3. Show success
      setComplete(true)

      // 4. Redirect after delay
      setTimeout(() => {
        onComplete()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
      setCompleting(false)
    }
  }

  // Stack management helpers
  const moveStack = (index: number, direction: 'up' | 'down') => {
    const newStacks = [...stacks]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newStacks.length) return
    ;[newStacks[index], newStacks[target]] = [newStacks[target], newStacks[index]]
    setStacks(newStacks)
  }

  const deleteStack = (index: number) => {
    if (stacks.length <= 1) return
    setStacks(stacks.filter((_, i) => i !== index))
  }

  const addStack = () => {
    const name = newStackName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    if (!name || !/^[a-z0-9][a-z0-9_-]*$/.test(name)) return
    if (stacks.some((s) => s.name === name)) return
    setStacks([...stacks, { name, isDefault: false, isNew: true, editing: false }])
    setNewStackName('')
  }

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(stacks[index].name)
  }

  const commitEdit = (index: number) => {
    const name = editValue.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    if (name && /^[a-z0-9][a-z0-9_-]*$/.test(name) && !stacks.some((s, i) => i !== index && s.name === name)) {
      const updated = [...stacks]
      updated[index] = { ...updated[index], name }
      setStacks(updated)
    }
    setEditingIndex(null)
    setEditValue('')
  }

  const filteredTimezones = COMMON_TIMEZONES.filter((tz) =>
    tz.toLowerCase().includes(tzFilter.toLowerCase()),
  )

  // ── Render ──

  // Success screen
  if (complete) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center animate-scale-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/30 mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Setup Complete!</h2>
          <p className="text-sm text-slate-500">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-emerald-500/[0.05] blur-3xl animate-float-slow" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-cyan-500/[0.05] blur-3xl animate-float-slow" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-500/[0.04] blur-3xl animate-float-slow" style={{ animationDelay: '6s' }} />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-2xl mx-4">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-3">
            <Layers className="w-7 h-7 text-emerald-400" />
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} total={5} />

        {/* Content card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/20">
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 mb-6 animate-fade-in">
              <AlertCircle size={14} className="text-rose-400 shrink-0" />
              <p className="text-xs text-rose-300">{error}</p>
            </div>
          )}

          {/* ── Step 1: Connect to Server ── */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-100">Welcome to Docker Compose Skeleton</h2>
                <p className="text-sm text-slate-500 mt-2">
                  Enter your server address to begin setup
                </p>
              </div>

              {/* Server URL input */}
              <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Link size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-300">Server Connection</h3>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Enter the IP or hostname shown by <span className="font-mono text-slate-400">./setup.sh</span> on your server
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={serverUrlInput}
                      onChange={(e) => { setServerUrlInput(e.target.value); setConnected(false) }}
                      onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                      placeholder="http://192.168.1.50:9876"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting || !serverUrlInput.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-30 press shrink-0"
                  >
                    {connecting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : connected ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Wifi size={14} />
                    )}
                    {connecting ? 'Connecting...' : connected ? 'Connected' : 'Connect'}
                  </button>
                </div>
              </div>

              {/* Connection status + System info (only shown after connecting) */}
              {connected && defaults ? (
                <>
                  {/* Connected banner */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/15 mb-4 animate-fade-in">
                    <Wifi size={12} className="text-emerald-400" />
                    <span className="text-[11px] text-emerald-400">
                      Connected to <span className="font-mono font-semibold">{defaults.system.hostname}</span>
                    </span>
                  </div>

                  {/* System info card */}
                  <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-5 animate-fade-in">
                    <div className="flex items-center gap-2 mb-4">
                      <Server size={16} className="text-emerald-400" />
                      <h3 className="text-sm font-semibold text-slate-300">Detected System</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Hostname', value: defaults.system.hostname },
                        { label: 'Timezone', value: defaults.system.timezone },
                        { label: 'Docker', value: defaults.system.docker_version },
                        { label: 'Compose', value: defaults.system.compose_version },
                        { label: 'User ID', value: String(defaults.system.puid) },
                        { label: 'Group ID', value: String(defaults.system.pgid) },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]">
                          <span className="text-[11px] text-slate-500">{item.label}</span>
                          <span className="text-[11px] font-mono text-slate-300">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : !connecting && !connected && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-white/[0.06]">
                  <WifiOff size={12} className="text-slate-500" />
                  <span className="text-[11px] text-slate-500">
                    Not connected — enter your server IP and click Connect
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Create Admin Account ── */}
          {step === 2 && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={16} className="text-emerald-400" />
                  <h2 className="text-lg font-semibold text-slate-100">Create Admin Account</h2>
                </div>
                <p className="text-xs text-slate-500">This account manages your DCS server</p>
              </div>

              <div className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>
                  {adminUsername && adminUsername.length < 3 && (
                    <p className="text-[10px] text-amber-400 mt-1">At least 3 characters required</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Min 8 chars, uppercase + number"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {adminPassword.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((level) => {
                          const strength = getPasswordStrength(adminPassword)
                          return (
                            <div
                              key={level}
                              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                                level <= strength.score ? strength.color : 'bg-slate-800'
                              }`}
                            />
                          )
                        })}
                      </div>
                      <p className={`text-[10px] ${
                        getPasswordStrength(adminPassword).score <= 2 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {getPasswordStrength(adminPassword).label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminConfirm}
                      onChange={(e) => setAdminConfirm(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>
                  {adminConfirm && adminPassword !== adminConfirm && (
                    <p className="text-[10px] text-rose-400 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Server Configuration ── */}
          {step === 3 && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Settings size={16} className="text-emerald-400" />
                  <h2 className="text-lg font-semibold text-slate-100">Server Configuration</h2>
                </div>
                <p className="text-xs text-slate-500">Pre-populated from your system — adjust as needed</p>
              </div>

              <div className="space-y-4">
                {/* Server Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Server Name</label>
                  <div className="relative">
                    <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={envVars.SERVER_NAME || ''}
                      onChange={(e) => setEnvVars({ ...envVars, SERVER_NAME: e.target.value })}
                      placeholder="My Docker Server"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Timezone</label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10" />
                    <input
                      type="text"
                      value={tzDropdownOpen ? tzFilter : (envVars.TZ || '')}
                      onChange={(e) => {
                        setTzFilter(e.target.value)
                        setTzDropdownOpen(true)
                      }}
                      onFocus={() => {
                        setTzFilter('')
                        setTzDropdownOpen(true)
                      }}
                      onBlur={() => setTimeout(() => setTzDropdownOpen(false), 200)}
                      placeholder="Select timezone..."
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                    {tzDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 scrollbar-thin">
                        {filteredTimezones.map((tz) => (
                          <button
                            key={tz}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setEnvVars({ ...envVars, TZ: tz })
                              setTzDropdownOpen(false)
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] transition-colors ${
                              envVars.TZ === tz ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-300'
                            }`}
                          >
                            {tz}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Domain */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Domain</label>
                  <div className="relative">
                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={envVars.PROXY_DOMAIN || ''}
                      onChange={(e) => setEnvVars({ ...envVars, PROXY_DOMAIN: e.target.value })}
                      placeholder="example.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>
                </div>

                {/* Data Directory */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Data Directory</label>
                  <div className="relative">
                    <FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={envVars.APP_DATA_DIR || ''}
                      onChange={(e) => setEnvVars({ ...envVars, APP_DATA_DIR: e.target.value })}
                      placeholder="./App-Data"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>
                </div>

                {/* PUID / PGID */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">User ID (PUID)</label>
                    <input
                      type="number"
                      value={envVars.PUID || ''}
                      onChange={(e) => setEnvVars({ ...envVars, PUID: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Group ID (PGID)</label>
                    <input
                      type="number"
                      value={envVars.PGID || ''}
                      onChange={(e) => setEnvVars({ ...envVars, PGID: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Stack Configuration ── */}
          {step === 4 && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Layers size={16} className="text-emerald-400" />
                  <h2 className="text-lg font-semibold text-slate-100">Stack Categories</h2>
                </div>
                <p className="text-xs text-slate-500">Define your stack categories and startup order</p>
              </div>

              {/* Stack list */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin mb-4">
                {stacks.map((stack, index) => (
                  <div
                    key={`${stack.name}-${index}`}
                    className="flex items-center gap-2 bg-slate-800/40 border border-white/[0.06] rounded-lg px-3 py-2 group"
                  >
                    {/* Order number */}
                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-white/[0.04] text-[10px] font-bold text-slate-500 shrink-0">
                      {index + 1}
                    </span>

                    {/* Name (editable) */}
                    {editingIndex === index ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(index)
                          if (e.key === 'Escape') { setEditingIndex(null); setEditValue('') }
                        }}
                        onBlur={() => commitEdit(index)}
                        autoFocus
                        className="flex-1 px-2 py-1 bg-slate-700/50 border border-emerald-500/30 rounded text-xs font-mono text-slate-200 focus:outline-none"
                      />
                    ) : (
                      <span className="flex-1 text-xs font-mono text-slate-300 truncate">
                        {stack.name}
                      </span>
                    )}

                    {/* Badges */}
                    {stack.isNew && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-500/15 text-cyan-400">
                        Custom
                      </span>
                    )}
                    {stack.isDefault && !stack.isNew && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-500/15 text-slate-500">
                        Default
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => startEdit(index)}
                        className="p-1 rounded hover:bg-white/[0.06] text-slate-500 hover:text-slate-300"
                        title="Rename"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStack(index, 'up')}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 disabled:opacity-20"
                        title="Move up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStack(index, 'down')}
                        disabled={index === stacks.length - 1}
                        className="p-1 rounded hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 disabled:opacity-20"
                        title="Move down"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStack(index)}
                        disabled={stacks.length <= 1}
                        className="p-1 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 disabled:opacity-20"
                        title="Remove"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add stack */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newStackName}
                  onChange={(e) => setNewStackName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  onKeyDown={(e) => e.key === 'Enter' && addStack()}
                  placeholder="new-stack-name"
                  className="flex-1 px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="button"
                  onClick={addStack}
                  disabled={!newStackName.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/20 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-30 transition-colors"
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>

              {stacks.length === 0 && (
                <p className="text-[10px] text-rose-400 mt-2">At least one stack is required</p>
              )}
            </div>
          )}

          {/* ── Step 5: Review & Complete ── */}
          {step === 5 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <Sparkles size={20} className="text-emerald-400 mx-auto mb-2" />
                <h2 className="text-lg font-semibold text-slate-100">Review Configuration</h2>
                <p className="text-xs text-slate-500 mt-1">Confirm your settings before completing setup</p>
              </div>

              <div className="space-y-4">
                {/* Admin Account */}
                <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={14} className="text-emerald-400" />
                    <h3 className="text-xs font-semibold text-slate-300">Admin Account</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                      {(adminUsername[0] || 'A').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{adminUsername}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold">admin</span>
                    </div>
                  </div>
                </div>

                {/* Server Config */}
                <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings size={14} className="text-emerald-400" />
                    <h3 className="text-xs font-semibold text-slate-300">Server Configuration</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(envVars).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                        <span className="text-[10px] text-slate-500">{key}</span>
                        <span className="text-[10px] font-mono text-slate-300 truncate ml-2 max-w-[120px]">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stack Order */}
                <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers size={14} className="text-emerald-400" />
                    <h3 className="text-xs font-semibold text-slate-300">Startup Order ({stacks.length} stacks)</h3>
                  </div>
                  <div className="space-y-1">
                    {stacks.map((stack, i) => (
                      <div key={stack.name} className="flex items-center gap-2 py-1">
                        <span className="w-5 h-5 flex items-center justify-center rounded bg-white/[0.04] text-[9px] font-bold text-slate-500">
                          {i + 1}
                        </span>
                        <span className="text-xs font-mono text-slate-300">{stack.name}</span>
                        {stack.isNew && (
                          <span className="text-[8px] px-1 rounded bg-cyan-500/15 text-cyan-400">new</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading || completing}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors disabled:opacity-30"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canNext() || loading}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-30 disabled:hover:bg-emerald-600 press"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-30 press"
              >
                {completing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Applying configuration...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Complete Setup
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
