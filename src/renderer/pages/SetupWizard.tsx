// =============================================================================
// SetupWizard — 5-step first-run configuration wizard
// Full-screen page (renders outside Sidebar/Header, like Login.tsx)
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Server, CheckCircle2, User, Lock, Shield, Eye, EyeOff,
  Settings, Globe, Clock, FolderOpen, Layers, ChevronUp, ChevronDown,
  Trash2, Plus, Pencil, Sparkles, Loader2, ArrowRight, ArrowLeft,
  Check, AlertCircle, Wifi, WifiOff, Link, Bell, Zap, HardDrive, ChevronRight, Palette,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useConnectionStore } from '../stores/connectionStore'
import {
  fetchSetupDefaults, fetchSetupStatus, setupConfigure, setupComplete,
  authSetup, authLogin,
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
  label: string
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

function StepIndicator({ current, total, needsAdmin = true }: { current: Step; total: number; needsAdmin?: boolean }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1)
  const labels = ['Connect', needsAdmin ? 'Admin' : 'Sign In', 'Server', 'Stacks', 'Review']

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
                w-6 sm:w-10 md:w-16 h-px mx-0.5 sm:mx-1 mb-5 transition-colors duration-300
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
// EnvToggle — inline toggle for boolean env vars
// ---------------------------------------------------------------------------

function EnvToggle({ label, helpText, envKey, envVars, setEnvVars }: {
  label: string
  helpText?: string
  envKey: string
  envVars: Record<string, string>
  setEnvVars: (v: Record<string, string>) => void
}) {
  const isOn = envVars[envKey] === 'true'
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-xs text-slate-300">{label}</p>
        {helpText && <p className="text-[10px] text-slate-500">{helpText}</p>}
      </div>
      <button
        type="button"
        onClick={() => setEnvVars({ ...envVars, [envKey]: isOn ? 'false' : 'true' })}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ${isOn ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
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
  const [labelEditIndex, setLabelEditIndex] = useState<number | null>(null)
  const [labelEditValue, setLabelEditValue] = useState('')

  // Timezone filter
  const [tzFilter, setTzFilter] = useState('')
  const [tzDropdownOpen, setTzDropdownOpen] = useState(false)

  // Collapsible advanced sections (Step 3)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showStartup, setShowStartup] = useState(false)
  const [showBackup, setShowBackup] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)

  // Client-side dashboard preferences
  const [prefTheme, setPrefTheme] = useState<'dark' | 'light'>('dark')
  const [prefSessionMinutes, setPrefSessionMinutes] = useState(240)
  const [prefAutoLock, setPrefAutoLock] = useState(0)
  const [prefAppName, setPrefAppName] = useState('DCS Manager')
  const [prefAppSubtitle, setPrefAppSubtitle] = useState('Docker Compose Skeleton')

  // Pre-flight validation
  const [alreadyConfigured, setAlreadyConfigured] = useState(false)
  const [needsAdmin, setNeedsAdmin] = useState(true)

  // Server URL from settings
  const { setServerUrl } = useConnectionStore()
  const { register, login, setApiToken: setStoreApiToken } = useAuthStore()

  // Override body overflow:hidden so the wizard page can scroll
  useEffect(() => {
    document.body.style.overflow = 'auto'
    return () => { document.body.style.overflow = '' }
  }, [])

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
        NTFY_URL: data.defaults.NTFY_URL || '',
        LOG_LEVEL: data.defaults.LOG_LEVEL || 'INFO',
        DOCKER_TIMEOUT: data.defaults.DOCKER_TIMEOUT || '300',
        BACKUP_SOURCE_DIR: data.defaults.BACKUP_SOURCE_DIR || '',
        BACKUP_DEST_DIR: data.defaults.BACKUP_DEST_DIR || '',
        CONTINUE_ON_FAILURE: data.defaults.CONTINUE_ON_FAILURE || 'true',
        SKIP_HEALTHCHECK_WAIT: data.defaults.SKIP_HEALTHCHECK_WAIT || 'false',
        SERVICE_START_DELAY: data.defaults.SERVICE_START_DELAY || '5',
        ENABLE_POST_STARTUP_HEALTH_CHECK: data.defaults.ENABLE_POST_STARTUP_HEALTH_CHECK || 'true',
        API_PORT: data.defaults.API_PORT || '9876',
        API_BIND: data.defaults.API_BIND || '127.0.0.1',
      })

      // Check if server is already initialized
      try {
        const status = await fetchSetupStatus()
        if (status.initialized) {
          setAlreadyConfigured(true)
        }
        // Track whether admin account still needs to be created
        if (status.needs_admin === false) {
          setNeedsAdmin(false)
        }
      } catch {
        // Setup status check is best-effort
      }

      // Pre-populate stacks
      setStacks(data.stacks.map((name) => ({
        name,
        label: '',
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
    if (needsAdmin) {
      // Creating new account — enforce strong password + confirmation
      if (!/[A-Z]/.test(adminPassword)) return false
      if (!/[0-9]/.test(adminPassword)) return false
      if (adminPassword !== adminConfirm) return false
    }
    return true
  }, [adminUsername, adminPassword, adminConfirm, needsAdmin])

  const isStep3Valid = useCallback(() => {
    return !!(envVars.SERVER_NAME?.trim() && envVars.TZ?.trim())
  }, [envVars])

  const isStep4Valid = useCallback(() => {
    return stacks.length >= 1 && stacks.every((s) => /^[a-z0-9][a-z0-9_-]*$/.test(s.name))
  }, [stacks])

  // Navigation
  const canNext = useCallback(() => {
    switch (step) {
      case 1: return connected && defaults !== null && !alreadyConfigured
      case 2: return isStep2Valid()
      case 3: return isStep3Valid()
      case 4: return isStep4Valid()
      case 5: return true
      default: return false
    }
  }, [step, connected, defaults, alreadyConfigured, isStep2Valid, isStep3Valid, isStep4Valid])

  const handleNext = async () => {
    setError(null)

    // Step 2: Create admin account or sign in to existing one
    if (step === 2) {
      setLoading(true)
      try {
        let res
        if (needsAdmin) {
          // First-time setup — create admin account
          res = await authSetup(adminUsername.trim(), adminPassword)
        } else {
          // Users already exist (interrupted setup) — sign in
          res = await authLogin(adminUsername.trim(), adminPassword)
        }
        if (res.success && res.token) {
          setLocalApiToken(res.token)
          apiClient.setAuthToken(res.token)
          setStoreApiToken(res.token)

          // Register locally so the app has a local account session
          const registered = await register(adminUsername.trim(), adminPassword)
          if (!registered) {
            // Account already exists locally (e.g. previous session) — log in instead
            await login(adminUsername.trim(), adminPassword, true)
          }
        } else {
          setError(needsAdmin ? 'Failed to create admin account' : 'Invalid credentials')
          setLoading(false)
          return
        }
      } catch (err) {
        if (err instanceof ApiNetworkError) {
          setError('Cannot reach the server. Check the connection.')
        } else {
          setError(err instanceof Error ? err.message : (needsAdmin ? 'Failed to create admin account' : 'Sign in failed'))
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

      // 3. Persist client-side dashboard preferences
      const settingsState = useSettingsStore.getState()
      settingsState.updateSetting('theme', prefTheme)
      settingsState.updateSetting('sessionDurationMinutes', prefSessionMinutes)
      settingsState.updateSetting('autoLockMinutes', prefAutoLock)
      settingsState.updateSetting('projectName', prefAppName)
      settingsState.updateSetting('projectSubtitle', prefAppSubtitle)

      // 3b. Persist stack labels as annotations
      const labelledStacks = stacks.filter((s) => s.label)
      if (labelledStacks.length > 0) {
        const annotations = { ...settingsState.stackAnnotations }
        for (const s of labelledStacks) {
          annotations[s.name] = { ...annotations[s.name], label: s.label }
        }
        settingsState.updateSetting('stackAnnotations', annotations)
      }

      // 4. Ensure authenticated before redirect (safety net)
      const authState = useAuthStore.getState()
      if (!authState.isAuthenticated && adminUsername && adminPassword) {
        const ok = await login(adminUsername.trim(), adminPassword, true)
        if (!ok) {
          // Last resort: force auth state so we reach dashboard
          useAuthStore.setState({ isAuthenticated: true, currentUser: adminUsername.trim(), hasAccount: true })
        }
      }

      // 5. Show success + set session flag for welcome toast
      setComplete(true)
      sessionStorage.setItem('dcs-just-setup', 'true')

      // 6. Redirect after brief delay
      setTimeout(() => {
        onComplete()
      }, 1500)
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
    setStacks([...stacks, { name, label: '', isDefault: false, isNew: true, editing: false }])
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

  const formatStackName = (name: string): string =>
    name.split(/[-_]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  const startLabelEdit = (index: number) => {
    setLabelEditIndex(index)
    setLabelEditValue(stacks[index].label)
  }

  const commitLabelEdit = (index: number) => {
    const updated = [...stacks]
    updated[index] = { ...updated[index], label: labelEditValue.trim() }
    setStacks(updated)
    setLabelEditIndex(null)
    setLabelEditValue('')
  }

  const filteredTimezones = COMMON_TIMEZONES.filter((tz) =>
    tz.toLowerCase().includes(tzFilter.toLowerCase()),
  )

  // ── Render ──

  // Success screen
  if (complete) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="text-center animate-scale-in max-w-sm w-full">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/30 mb-6 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Setup Complete!</h2>
          <p className="text-sm text-slate-400 mb-4">
            <span className="font-semibold text-slate-200">{envVars.SERVER_NAME || 'Your server'}</span> is configured and ready to manage
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 size={12} className="animate-spin text-emerald-400" />
            <span>Entering Dashboard...</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-6">
            Tip: Export your settings from Settings to back up this configuration
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 relative">
      {/* Animated background (fixed behind scroll) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-emerald-500/[0.05] blur-3xl animate-float-slow" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-cyan-500/[0.05] blur-3xl animate-float-slow" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-500/[0.04] blur-3xl animate-float-slow" style={{ animationDelay: '6s' }} />
      </div>

      {/* Grid pattern (fixed behind scroll) */}
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Scrollable content area */}
      <div
        className="relative z-10 min-h-screen flex items-start justify-center pt-12 pb-8 md:py-12 overflow-y-auto scrollbar-thin"
        style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}
      >
        <div className="w-full max-w-2xl mx-4 sm:mx-6">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-3">
              <Layers className="w-7 h-7 text-emerald-400" />
            </div>
          </div>

          {/* Step indicator */}
          <StepIndicator current={step} total={5} needsAdmin={needsAdmin} />

          {/* Content card */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl shadow-black/20">
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

                  {/* Already configured warning */}
                  {alreadyConfigured && (
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/15 mb-4 animate-fade-in">
                      <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-300">Server Already Configured</p>
                        <p className="text-[10px] text-amber-400/70 mt-0.5">
                          This server is already initialized. Use the Login screen to sign in, or Factory Reset from Diagnostics to start fresh.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* System info card */}
                  <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-5 animate-fade-in">
                    <div className="flex items-center gap-2 mb-4">
                      <Server size={16} className="text-emerald-400" />
                      <h3 className="text-sm font-semibold text-slate-300">Detected System</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {[
                        { label: 'Hostname', value: defaults.system.hostname },
                        { label: 'Timezone', value: defaults.system.timezone },
                        { label: 'Docker', value: defaults.system.docker_version },
                        { label: 'Compose', value: defaults.system.compose_version },
                        { label: 'User ID', value: String(defaults.system.puid) },
                        { label: 'Group ID', value: String(defaults.system.pgid) },
                        { label: 'Docker Status', value: defaults.system.docker_available ? 'Available' : 'Not Available', status: defaults.system.docker_available },
                      ].map((item) => (
                        <div key={item.label + (('status' in item) ? '-status' : '')} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]">
                          <span className="text-[11px] text-slate-500">{item.label}</span>
                          {'status' in item ? (
                            <span className={`text-[11px] font-mono flex items-center gap-1 ${item.status ? 'text-emerald-400' : 'text-rose-400'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${item.status ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              {item.value}
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-300">{item.value}</span>
                          )}
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

          {/* ── Step 2: Create Admin Account / Sign In ── */}
          {step === 2 && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={16} className="text-emerald-400" />
                  <h2 className="text-lg font-semibold text-slate-100">
                    {needsAdmin ? 'Create Admin Account' : 'Sign In to Continue'}
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  {needsAdmin
                    ? 'This account manages your DCS server'
                    : 'An admin account already exists — sign in to resume setup'}
                </p>
              </div>

              {!needsAdmin && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/15 mb-4">
                  <AlertCircle size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-cyan-400/80">
                    A previous setup was interrupted. Sign in with your admin credentials to pick up where you left off.
                  </p>
                </div>
              )}

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
                      placeholder={needsAdmin ? 'Min 8 chars, uppercase + number' : 'Enter your password'}
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
                  {/* Strength indicator — only for new account creation */}
                  {needsAdmin && adminPassword.length > 0 && (
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

                {/* Confirm Password — only for new account creation */}
                {needsAdmin && (
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
                )}
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
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
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

                {/* ── Advanced: Notifications ── */}
                <div className="border border-white/[0.06] rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-amber-400" />
                      <span className="text-xs font-semibold text-slate-300">Notifications</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-500 font-medium">Advanced</span>
                    </div>
                    <ChevronRight size={14} className={`text-slate-500 transition-transform duration-200 ${showNotifications ? 'rotate-90' : ''}`} />
                  </button>
                  {showNotifications && (
                    <div className="px-4 py-4 space-y-3 border-t border-white/[0.04] animate-fade-in">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">NTFY URL</label>
                        <input
                          type="text"
                          value={envVars.NTFY_URL || ''}
                          onChange={(e) => setEnvVars({ ...envVars, NTFY_URL: e.target.value })}
                          placeholder="https://ntfy.sh/your-topic"
                          className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                        />
                        <p className="text-[10px] text-slate-600 mt-1">Leave empty to disable push notifications</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Advanced: Startup & Health ── */}
                <div className="border border-white/[0.06] rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowStartup(!showStartup)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-cyan-400" />
                      <span className="text-xs font-semibold text-slate-300">Startup & Health</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-500 font-medium">Advanced</span>
                    </div>
                    <ChevronRight size={14} className={`text-slate-500 transition-transform duration-200 ${showStartup ? 'rotate-90' : ''}`} />
                  </button>
                  {showStartup && (
                    <div className="px-4 py-4 space-y-3 border-t border-white/[0.04] animate-fade-in">
                      {/* Log Level */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Log Level</label>
                        <select
                          value={envVars.LOG_LEVEL || 'INFO'}
                          onChange={(e) => setEnvVars({ ...envVars, LOG_LEVEL: e.target.value })}
                          className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                        >
                          <option value="ERROR">ERROR</option>
                          <option value="WARNING">WARNING</option>
                          <option value="INFO">INFO</option>
                          <option value="DEBUG">DEBUG</option>
                        </select>
                      </div>

                      {/* Toggle: Continue on failure */}
                      <EnvToggle
                        label="Continue on Failure"
                        helpText="Continue starting stacks if one fails"
                        envKey="CONTINUE_ON_FAILURE"
                        envVars={envVars}
                        setEnvVars={setEnvVars}
                      />

                      {/* Toggle: Skip health check wait */}
                      <EnvToggle
                        label="Skip Health Check Wait"
                        helpText="Skip waiting for health checks during startup"
                        envKey="SKIP_HEALTHCHECK_WAIT"
                        envVars={envVars}
                        setEnvVars={setEnvVars}
                      />

                      {/* Toggle: Post-startup health check */}
                      <EnvToggle
                        label="Post-Startup Health Check"
                        helpText="Run health check after all stacks start"
                        envKey="ENABLE_POST_STARTUP_HEALTH_CHECK"
                        envVars={envVars}
                        setEnvVars={setEnvVars}
                      />

                      {/* Number: Service start delay */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Delay (seconds)</label>
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={envVars.SERVICE_START_DELAY || '5'}
                            onChange={(e) => setEnvVars({ ...envVars, SERVICE_START_DELAY: e.target.value })}
                            className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5">Docker Timeout (seconds)</label>
                          <input
                            type="number"
                            min="30"
                            max="900"
                            value={envVars.DOCKER_TIMEOUT || '300'}
                            onChange={(e) => setEnvVars({ ...envVars, DOCKER_TIMEOUT: e.target.value })}
                            className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Advanced: Backup ── */}
                <div className="border border-white/[0.06] rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowBackup(!showBackup)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <HardDrive size={14} className="text-violet-400" />
                      <span className="text-xs font-semibold text-slate-300">Backup</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-500 font-medium">Advanced</span>
                    </div>
                    <ChevronRight size={14} className={`text-slate-500 transition-transform duration-200 ${showBackup ? 'rotate-90' : ''}`} />
                  </button>
                  {showBackup && (
                    <div className="px-4 py-4 space-y-3 border-t border-white/[0.04] animate-fade-in">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Backup Source Directory</label>
                        <input
                          type="text"
                          value={envVars.BACKUP_SOURCE_DIR || ''}
                          onChange={(e) => setEnvVars({ ...envVars, BACKUP_SOURCE_DIR: e.target.value })}
                          placeholder="/path/to/source"
                          className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Backup Destination Directory</label>
                        <input
                          type="text"
                          value={envVars.BACKUP_DEST_DIR || ''}
                          onChange={(e) => setEnvVars({ ...envVars, BACKUP_DEST_DIR: e.target.value })}
                          placeholder="/path/to/destination"
                          className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                        />
                      </div>
                      <p className="text-[10px] text-slate-600">Configure after setup if unsure</p>
                    </div>
                  )}
                </div>

                {/* ── Dashboard Preferences (collapsible) ── */}
                <div className="border border-white/[0.06] rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowPreferences(!showPreferences)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Palette size={14} className="text-cyan-400" />
                      <span className="text-xs font-semibold text-slate-300">Dashboard Preferences</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-500 font-medium">Advanced</span>
                    </div>
                    <ChevronRight size={14} className={`text-slate-500 transition-transform duration-200 ${showPreferences ? 'rotate-90' : ''}`} />
                  </button>
                  {showPreferences && (
                    <div className="px-4 py-4 space-y-3 border-t border-white/[0.04] animate-fade-in">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Theme</label>
                        <select
                          value={prefTheme}
                          onChange={(e) => setPrefTheme(e.target.value as 'dark' | 'light')}
                          className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                        >
                          <option value="dark">Dark</option>
                          <option value="light">Light</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Session Duration</label>
                        <select
                          value={prefSessionMinutes}
                          onChange={(e) => setPrefSessionMinutes(Number(e.target.value))}
                          className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                        >
                          <option value={60}>1 hour</option>
                          <option value={240}>4 hours</option>
                          <option value={480}>8 hours</option>
                          <option value={1440}>24 hours</option>
                          <option value={0}>Indefinite</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Auto-Lock</label>
                        <select
                          value={prefAutoLock}
                          onChange={(e) => setPrefAutoLock(Number(e.target.value))}
                          className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                        >
                          <option value={0}>Off</option>
                          <option value={5}>5 minutes</option>
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">App Name</label>
                        <input
                          type="text"
                          value={prefAppName}
                          onChange={(e) => setPrefAppName(e.target.value)}
                          placeholder="DCS Manager"
                          className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">App Subtitle</label>
                        <input
                          type="text"
                          value={prefAppSubtitle}
                          onChange={(e) => setPrefAppSubtitle(e.target.value)}
                          placeholder="Docker Compose Skeleton"
                          className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                        />
                      </div>
                      <p className="text-[10px] text-slate-600">These can be changed later in Settings</p>
                    </div>
                  )}
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
                <p className="text-xs text-slate-500">Define your stack categories, startup order, and display labels</p>
              </div>

              {/* Stack list */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin mb-4">
                {stacks.map((stack, index) => (
                  <div
                    key={`${stack.name}-${index}`}
                    className="bg-slate-800/40 border border-white/[0.06] rounded-lg px-3 py-2 group"
                  >
                    <div className="flex items-center gap-2">
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
                      {stack.label && labelEditIndex !== index && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-violet-500/15 text-violet-400 shrink-0">
                          {stack.label}
                        </span>
                      )}
                      {stack.isNew && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-500/15 text-cyan-400 shrink-0">
                          Custom
                        </span>
                      )}
                      {stack.isDefault && !stack.isNew && !stack.label && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-500/15 text-slate-500 shrink-0">
                          Default
                        </span>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={() => labelEditIndex === index ? commitLabelEdit(index) : startLabelEdit(index)}
                          className={`p-1 rounded hover:bg-white/[0.06] transition-colors ${labelEditIndex === index ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'}`}
                          title={stack.label ? 'Edit label' : 'Add label'}
                        >
                          <Palette size={11} />
                        </button>
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

                    {/* Inline label editor */}
                    {labelEditIndex === index && (
                      <div className="flex items-center gap-2 mt-2 ml-8">
                        <input
                          type="text"
                          value={labelEditValue}
                          onChange={(e) => setLabelEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitLabelEdit(index)
                            if (e.key === 'Escape') { setLabelEditIndex(null); setLabelEditValue('') }
                          }}
                          autoFocus
                          placeholder={formatStackName(stack.name)}
                          className="flex-1 px-2 py-1 bg-slate-700/50 border border-violet-500/30 rounded text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => commitLabelEdit(index)}
                          className="px-2 py-1 rounded text-[10px] font-medium bg-violet-600/20 border border-violet-500/20 text-violet-400 hover:bg-violet-600/30 transition-colors"
                        >
                          Save
                        </button>
                        {stack.label && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...stacks]
                              updated[index] = { ...updated[index], label: '' }
                              setStacks(updated)
                              setLabelEditIndex(null)
                              setLabelEditValue('')
                            }}
                            className="px-2 py-1 rounded text-[10px] font-medium text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
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

                {/* Server Config — grouped by category */}
                <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings size={14} className="text-emerald-400" />
                    <h3 className="text-xs font-semibold text-slate-300">Server Identity</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {['SERVER_NAME', 'TZ', 'PROXY_DOMAIN'].map((key) => (
                      <div key={key} className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                        <span className="text-[10px] text-slate-500 shrink-0">{key}</span>
                        <span className="text-[10px] font-mono text-slate-300 truncate ml-2">{envVars[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FolderOpen size={14} className="text-emerald-400" />
                    <h3 className="text-xs font-semibold text-slate-300">Storage & Permissions</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {['APP_DATA_DIR', 'PUID', 'PGID'].map((key) => (
                      <div key={key} className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                        <span className="text-[10px] text-slate-500 shrink-0">{key}</span>
                        <span className="text-[10px] font-mono text-slate-300 truncate ml-2">{envVars[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Advanced sections — only show if values differ from defaults */}
                {envVars.NTFY_URL && (
                  <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bell size={14} className="text-amber-400" />
                      <h3 className="text-xs font-semibold text-slate-300">Notifications</h3>
                    </div>
                    <div className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                      <span className="text-[10px] text-slate-500 shrink-0">NTFY_URL</span>
                      <span className="text-[10px] font-mono text-slate-300 truncate ml-2">{envVars.NTFY_URL}</span>
                    </div>
                  </div>
                )}

                {(() => {
                  const startupDefaults: Record<string, string> = { LOG_LEVEL: 'INFO', CONTINUE_ON_FAILURE: 'true', SKIP_HEALTHCHECK_WAIT: 'false', SERVICE_START_DELAY: '5', DOCKER_TIMEOUT: '300', ENABLE_POST_STARTUP_HEALTH_CHECK: 'true' }
                  const changed = Object.entries(startupDefaults).filter(([k, v]) => envVars[k] && envVars[k] !== v)
                  return changed.length > 0 ? (
                    <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap size={14} className="text-cyan-400" />
                        <h3 className="text-xs font-semibold text-slate-300">Startup & Health</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {changed.map(([key]) => (
                          <div key={key} className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                            <span className="text-[10px] text-slate-500 shrink-0">{key}</span>
                            <span className="text-[10px] font-mono text-slate-300 truncate ml-2">{envVars[key]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                })()}

                {(envVars.BACKUP_SOURCE_DIR || envVars.BACKUP_DEST_DIR) && (
                  <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <HardDrive size={14} className="text-violet-400" />
                      <h3 className="text-xs font-semibold text-slate-300">Backup</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {['BACKUP_SOURCE_DIR', 'BACKUP_DEST_DIR'].filter((k) => envVars[k]).map((key) => (
                        <div key={key} className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                          <span className="text-[10px] text-slate-500 shrink-0">{key}</span>
                          <span className="text-[10px] font-mono text-slate-300 truncate ml-2">{envVars[key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dashboard Preferences (only if non-default) */}
                {(prefTheme !== 'dark' || prefSessionMinutes !== 240 || prefAutoLock !== 0 || prefAppName !== 'DCS Manager' || prefAppSubtitle !== 'Docker Compose Skeleton') && (
                  <div className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Palette size={14} className="text-cyan-400" />
                      <h3 className="text-xs font-semibold text-slate-300">Dashboard</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {prefTheme !== 'dark' && (
                        <div className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                          <span className="text-[10px] text-slate-500 shrink-0">Theme</span>
                          <span className="text-[10px] font-mono text-slate-300 truncate ml-2">{prefTheme}</span>
                        </div>
                      )}
                      {prefSessionMinutes !== 240 && (
                        <div className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                          <span className="text-[10px] text-slate-500 shrink-0">Session</span>
                          <span className="text-[10px] font-mono text-slate-300 truncate ml-2">{prefSessionMinutes === 0 ? 'Indefinite' : `${prefSessionMinutes / 60}h`}</span>
                        </div>
                      )}
                      {prefAutoLock !== 0 && (
                        <div className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                          <span className="text-[10px] text-slate-500 shrink-0">Auto-Lock</span>
                          <span className="text-[10px] font-mono text-slate-300 truncate ml-2">{prefAutoLock}min</span>
                        </div>
                      )}
                      {prefAppName !== 'DCS Manager' && (
                        <div className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                          <span className="text-[10px] text-slate-500 shrink-0">App Name</span>
                          <span className="text-[10px] font-mono text-slate-300 truncate ml-2">{prefAppName}</span>
                        </div>
                      )}
                      {prefAppSubtitle !== 'Docker Compose Skeleton' && (
                        <div className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02]">
                          <span className="text-[10px] text-slate-500 shrink-0">Subtitle</span>
                          <span className="text-[10px] font-mono text-slate-300 truncate ml-2">{prefAppSubtitle}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                        {stack.label && (
                          <span className="text-[8px] px-1 rounded bg-violet-500/15 text-violet-400">{stack.label}</span>
                        )}
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
    </div>
  )
}
